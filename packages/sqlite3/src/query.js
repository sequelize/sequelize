'use strict';

import {
  AbstractQuery,
  DatabaseError,
  ForeignKeyConstraintError,
  QueryTypes,
  TimeoutError,
  UniqueConstraintError,
  ValidationErrorItem,
} from '@sequelize/core';
import { logger } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/logger.js';
import isEqual from 'lodash/isEqual';
import isPlainObject from 'lodash/isPlainObject';
import merge from 'lodash/merge';

const debug = logger.debugContext('sql:sqlite3');

// sqlite3 currently ignores bigint values, so we have to translate to string for now
// There's a WIP here: https://github.com/TryGhost/node-sqlite3/pull/1501
function stringifyIfBigint(value) {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  return value;
}

export class SqliteQuery extends AbstractQuery {
  getInsertIdField() {
    return 'lastID';
  }

  _collectModels(include, prefix) {
    const ret = {};

    if (include) {
      for (const _include of include) {
        let key;
        if (!prefix) {
          key = _include.as;
        } else {
          key = `${prefix}.${_include.as}`;
        }

        ret[key] = _include.model;

        if (_include.include) {
          merge(ret, this._collectModels(_include.include, key));
        }
      }
    }

    return ret;
  }

  _handleQueryResponse(metaData, results) {
    let result = this.instance;

    // add the inserted row id to the instance
    if (this.isInsertQuery(results, metaData) || this.isUpsertQuery()) {
      this.handleInsertQuery(results, metaData);
      if (!this.instance) {
        const modelDefinition = this.model?.modelDefinition;

        // handle bulkCreate AI primary key
        if (
          metaData.constructor.name === 'Statement' &&
          modelDefinition?.autoIncrementAttributeName &&
          modelDefinition?.autoIncrementAttributeName === this.model.primaryKeyAttribute
        ) {
          const startId = metaData[this.getInsertIdField()] - metaData.changes + 1;
          result = [];
          for (let i = startId; i < startId + metaData.changes; i++) {
            result.push({ [modelDefinition.getColumnName(this.model.primaryKeyAttribute)]: i });
          }
        } else {
          result = metaData[this.getInsertIdField()];
        }
      }
    }

    if (this.isShowConstraintsQuery()) {
      return result;
    }

    if (this.isSelectQuery()) {
      return this.handleSelectQuery(results);
    }

    if (this.isShowOrDescribeQuery()) {
      return results;
    }

    if (this.sql.includes('PRAGMA INDEX_LIST')) {
      return this.handleShowIndexesQuery(results);
    }

    if (this.sql.includes('PRAGMA INDEX_INFO')) {
      return results;
    }

    if (this.sql.includes('PRAGMA TABLE_INFO')) {
      // this is the sqlite way of getting the metadata of a table
      result = {};

      let defaultValue;
      for (const _result of results) {
        if (_result.dflt_value === null) {
          // Column schema omits any "DEFAULT ..."
          defaultValue = undefined;
        } else if (_result.dflt_value === 'NULL') {
          // Column schema is a "DEFAULT NULL"
          defaultValue = null;
        } else {
          defaultValue = _result.dflt_value;
        }

        result[_result.name] = {
          type: _result.type,
          allowNull: _result.notnull === 0,
          defaultValue,
          primaryKey: _result.pk !== 0,
        };

        if (result[_result.name].type === 'TINYINT(1)') {
          result[_result.name].defaultValue = { 0: false, 1: true }[
            result[_result.name].defaultValue
          ];
        }

        if (typeof result[_result.name].defaultValue === 'string') {
          result[_result.name].defaultValue = result[_result.name].defaultValue.replaceAll("'", '');
        }
      }

      return result;
    }

    if ([QueryTypes.BULKUPDATE, QueryTypes.DELETE].includes(this.options.type)) {
      return metaData.changes;
    }

    if (this.options.type === QueryTypes.RAW) {
      return [results, metaData];
    }

    if (this.isUpsertQuery()) {
      return [result, null];
    }

    if (this.isUpdateQuery() || this.isInsertQuery()) {
      return [result, metaData.changes];
    }

    return result;
  }

  async run(sql, parameters) {
    const conn = this.connection;
    this.sql = sql;
    const method = this.getDatabaseMethod();
    const complete = this._logQuery(sql, debug, parameters);

    // TODO: remove sql type based parsing for SQLite.
    //  It is extremely inefficient (requires a series of DESCRIBE TABLE query, which slows down all queries).
    //  and is very unreliable.
    //  Use Sequelize DataType parsing instead, until sqlite3 provides a clean API to know the DB type.
    const columnTypes = {};

    const executeSql = async () => {
      if (!parameters) {
        parameters = [];
      }

      if (isPlainObject(parameters)) {
        const newParameters = Object.create(null);

        for (const key of Object.keys(parameters)) {
          newParameters[`$${key}`] = stringifyIfBigint(parameters[key]);
        }

        parameters = newParameters;
      } else {
        parameters = parameters.map(stringifyIfBigint);
      }

      let response;
      try {
        if (method === 'run') {
          response = await this.#runSeries(conn, sql, parameters);
        } else {
          response = await this.#allSeries(conn, sql, parameters);
        }
      } catch (error) {
        error.sql = this.sql;
        throw this.formatError(error);
      }

      complete();

      return this._handleQueryResponse(response.statement, response.results);
    };

    if (method === 'all') {
      let tableNames = [];
      if (this.options && this.options.tableNames) {
        tableNames = this.options.tableNames;
      } else if (/from `(.*?)`/i.test(this.sql)) {
        tableNames.push(/from `(.*?)`/i.exec(this.sql)[1]);
      }

      // If we already have the metadata for the table, there's no need to ask for it again
      tableNames = tableNames.filter(
        tableName => !(tableName in columnTypes) && tableName !== 'sqlite_master',
      );

      if (tableNames.length === 0) {
        return executeSql();
      }

      await Promise.all(
        tableNames.map(async tableName => {
          tableName = tableName.replaceAll('`', '');
          columnTypes[tableName] = {};

          const { results } = await this.#allSeries(conn, `PRAGMA table_info(\`${tableName}\`)`);
          for (const result of results) {
            columnTypes[tableName][result.name] = result.type;
          }
        }),
      );
    }

    return executeSql();
  }

  #allSeries(connection, query, parameters) {
    return new Promise((resolve, reject) => {
      connection.serialize(() => {
        connection.all(query, parameters, function (err, results) {
          if (err) {
            reject(err);

            return;
          }

          // node-sqlite3 passes the statement object as `this` to the callback
          // eslint-disable-next-line no-invalid-this
          resolve({ statement: this, results });
        });
      });
    });
  }

  #runSeries(connection, query, parameters) {
    return new Promise((resolve, reject) => {
      connection.serialize(() => {
        connection.run(query, parameters, function (err, results) {
          if (err) {
            reject(err);

            return;
          }

          // node-sqlite3 passes the statement object as `this` to the callback
          // eslint-disable-next-line no-invalid-this
          resolve({ statement: this, results });
        });
      });
    });
  }

  formatError(err) {
    switch (err.code) {
      case 'SQLITE_CONSTRAINT_UNIQUE':
      case 'SQLITE_CONSTRAINT_PRIMARYKEY':
      case 'SQLITE_CONSTRAINT_TRIGGER':
      case 'SQLITE_CONSTRAINT_FOREIGNKEY':
      case 'SQLITE_CONSTRAINT': {
        if (err.message.includes('FOREIGN KEY constraint failed')) {
          return new ForeignKeyConstraintError({
            cause: err,
          });
        }

        let fields = [];

        // Sqlite pre 2.2 behavior - Error: SQLITE_CONSTRAINT: columns x, y are not unique
        let match = err.message.match(/columns (.*?) are/);
        if (match !== null && match.length >= 2) {
          fields = match[1].split(', ');
        } else {
          // Sqlite post 2.2 behavior - Error: SQLITE_CONSTRAINT: UNIQUE constraint failed: table.x, table.y
          match = err.message.match(/UNIQUE constraint failed: (.*)/);
          if (match !== null && match.length >= 2) {
            fields = match[1].split(', ').map(columnWithTable => columnWithTable.split('.')[1]);
          }
        }

        const errors = [];
        let message = 'Validation error';

        for (const field of fields) {
          errors.push(
            new ValidationErrorItem(
              this.getUniqueConstraintErrorMessage(field),
              'unique violation', // ValidationErrorItem.Origins.DB,
              field,
              this.instance && this.instance[field],
              this.instance,
              'not_unique',
            ),
          );
        }

        if (this.model) {
          for (const index of this.model.getIndexes()) {
            if (index.unique && isEqual(index.fields, fields) && index.msg) {
              message = index.msg;
              break;
            }
          }
        }

        return new UniqueConstraintError({ message, errors, cause: err, fields });
      }

      case 'SQLITE_BUSY':
        return new TimeoutError(err);

      default:
        return new DatabaseError(err);
    }
  }

  async handleShowIndexesQuery(data) {
    // Sqlite returns indexes so the one that was defined last is returned first. Lets reverse that!
    return Promise.all(
      data.reverse().map(async item => {
        item.fields = [];
        item.primary = false;
        item.unique = Boolean(item.unique);
        item.constraintName = item.name;
        const columns = await this.run(`PRAGMA INDEX_INFO(\`${item.name}\`)`);
        for (const column of columns) {
          item.fields[column.seqno] = {
            attribute: column.name,
            length: undefined,
            order: undefined,
          };
        }

        return item;
      }),
    );
  }

  getDatabaseMethod() {
    if (
      this.isInsertQuery() ||
      this.isUpdateQuery() ||
      this.isUpsertQuery() ||
      this.isBulkUpdateQuery() ||
      this.sql.toLowerCase().includes('CREATE TEMPORARY TABLE'.toLowerCase()) ||
      this.isDeleteQuery()
    ) {
      return 'run';
    }

    return 'all';
  }
}
