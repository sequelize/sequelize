'use strict';

import assert from 'node:assert';
import util from 'node:util';
import { AbstractQuery } from '../abstract/query';
import { logger } from '../../utils/logger';
import dayjs from 'dayjs';

const sequelizeErrors = require('../../errors');
const _ = require('lodash');

const debug = logger.debugContext('sql:db2');

export class Db2Query extends AbstractQuery {
  getInsertIdField() {
    return 'id';
  }

  getSQLTypeFromJsType(value) {
    if (Buffer.isBuffer(value)) {
      return { ParamType: 'INPUT', DataType: 'BLOB', Data: value };
    }

    if (typeof value === 'bigint') {
      // The ibm_db module does not handle bigint, send as a string instead:
      return value.toString();
    }

    return value;
  }

  async _run(connection, sql, parameters) {
    assert(typeof sql === 'string', `sql parameter must be a string`);

    this.sql = sql;

    const complete = this._logQuery(sql, debug, parameters);

    const errStack = new Error().stack;

    return new Promise((resolve, reject) => {
      // TRANSACTION SUPPORT
      if (_.startsWith(this.sql, 'BEGIN TRANSACTION')) {
        connection.beginTransaction(err => {
          if (err) {
            reject(this.formatError(err, errStack));
          } else {
            resolve(this.formatResults());
          }
        });
      } else if (_.startsWith(this.sql, 'COMMIT TRANSACTION')) {
        connection.commitTransaction(err => {
          if (err) {
            reject(this.formatError(err, errStack));
          } else {
            resolve(this.formatResults());
          }
        });
      } else if (_.startsWith(this.sql, 'ROLLBACK TRANSACTION')) {
        connection.rollbackTransaction(err => {
          if (err) {
            reject(this.formatError(err, errStack));
          } else {
            resolve(this.formatResults());
          }
        });
      } else if (_.startsWith(this.sql, 'SAVE TRANSACTION')) {
        connection.commitTransaction(err => {
          if (err) {
            reject(this.formatError(err, errStack));
          } else {
            connection.beginTransaction(err => {
              if (err) {
                reject(this.formatError(err, errStack));
              } else {
                resolve(this.formatResults());
              }
            });
          }
        }, this.options.transaction.name);
      } else {
        const params = [];
        if (parameters) {
          _.forOwn(parameters, (value, key) => {
            const param = this.getSQLTypeFromJsType(value, key);
            params.push(param);
          });
        }

        const SQL = this.sql.toUpperCase();
        let newSql = this.sql;

        // TODO: move this to Db2QueryGenerator
        if ((this.isSelectQuery() || _.startsWith(SQL, 'SELECT '))
            && !SQL.includes(' FROM ', 8)) {
          if (this.sql.charAt(this.sql.length - 1) === ';') {
            newSql = this.sql.slice(0, -1);
          }

          newSql += ' FROM SYSIBM.SYSDUMMY1;';
        }

        connection.prepare(newSql, (err, stmt) => {
          if (err) {
            reject(this.formatError(err, errStack));
          }

          stmt.execute(params, (err, result, outparams) => {
            complete();

            // map the INOUT parameters to the name provided by the dev
            // this is an internal API, not yet ready for dev consumption, hence the _unsafe_ prefix.
            if (outparams && this.options.bindParameterOrder && this.options._unsafe_db2Outparams) {
              for (let i = 0; i < this.options.bindParameterOrder.length; i++) {
                const paramName = this.options.bindParameterOrder[i];
                const paramValue = outparams[i];

                this.options._unsafe_db2Outparams.set(paramName, paramValue);
              }
            }

            if (err && err.message) {
              err = this.filterSQLError(err, this.sql, connection);
              if (err === null) {
                stmt.closeSync();
                resolve(this.formatResults([], 0));
              }
            }

            if (err) {
              err.sql = sql;
              stmt.closeSync();
              reject(this.formatError(err, errStack, connection, parameters));
            } else {
              let data = [];
              let metadata = [];
              let affectedRows = 0;
              if (typeof result === 'object') {
                if (_.startsWith(this.sql, 'DELETE FROM ')) {
                  affectedRows = result.getAffectedRowsSync();
                } else {
                  data = result.fetchAllSync();
                  metadata = result.getColumnMetadataSync();
                }

                result.closeSync();
              }

              stmt.closeSync();
              const datalen = data.length;
              if (datalen > 0) {
                const coltypes = {};
                for (const metadatum of metadata) {
                  coltypes[metadatum.SQL_DESC_NAME]
                      = metadatum.SQL_DESC_TYPE_NAME;
                }

                for (let i = 0; i < datalen; i++) {
                  for (const column in data[i]) {
                    const value = data[i][column];
                    if (value === null) {
                      continue;
                    }

                    const parse = this.sequelize.dialect.getParserForDatabaseDataType(coltypes[column]);
                    if (parse) {
                      data[i][column] = parse(value);
                    }
                  }
                }

                if (outparams && outparams.length > 0) {
                  data.unshift(outparams);
                }

                resolve(this.formatResults(data, datalen, metadata, connection));
              } else {
                resolve(this.formatResults(data, affectedRows));
              }
            }
          });
        });
      }
    });
  }

  async run(sql, parameters) {
    return await this._run(this.connection, sql, parameters);
  }

  filterSQLError(err, sql, connection) {
    // This error is safe to ignore:
    // [IBM][CLI Driver][DB2/LINUXX8664] SQL0605W  The index was not created because an index "x" with a matching definition already exists.  SQLSTATE=01550
    if (err.message.search('SQL0605W') !== -1) {
      return null;
    }

    return err;
  }

  /**
   * High level function that handles the results of a query execution.
   *
   *
   * Example:
   *  query.formatResults([
   *    {
   *      id: 1,              // this is from the main table
   *      attr2: 'snafu',     // this is from the main table
   *      Tasks.id: 1,        // this is from the associated table
   *      Tasks.title: 'task' // this is from the associated table
   *    }
   *  ])
   *
   * @param {Array} data - The result of the query execution.
   * @param {Integer} rowCount - The number of affected rows.
   * @param {Array} metadata - Metadata of the returned result set.
   * @param {object} conn - The connection object.
   * @private
   */
  formatResults(data, rowCount, metadata, conn) {
    let result = this.instance;
    if (this.isInsertQuery(data, metadata)) {
      this.handleInsertQuery(data, metadata);

      if (!this.instance) {
        if (this.options.plain) {
          const record = data[0];
          result = record[Object.keys(record)[0]];
        } else {
          result = data;
        }
      }
    }

    if (this.isShowTablesQuery()) {
      result = data;
    } else if (this.isDescribeQuery()) {
      result = {};
      for (const _result of data) {
        if (_result.Default) {
          _result.Default = _result.Default.replace('(\'', '').replace('\')', '').replace(/'/g, '');
        }

        result[_result.Name] = {
          type: _result.Type.toUpperCase(),
          allowNull: _result.IsNull === 'Y',
          defaultValue: _result.Default,
          primaryKey: _result.KeySeq > 0,
          autoIncrement: _result.IsIdentity === 'Y',
          comment: _result.Comment,
        };
      }
    } else if (this.isShowIndexesQuery()) {
      result = this.handleShowIndexesQuery(data);
    } else if (this.isSelectQuery()) {
      result = this.handleSelectQuery(data);
    } else if (this.isUpsertQuery()) {
      result = data;
    } else if (this.isDropSchemaQuery()) {
      result = data[0];
      if (conn) {
        const query = 'DROP TABLE ERRORSCHEMA.ERRORTABLE';
        conn.querySync(query);
      }
    } else if (this.isCallQuery()) {
      result = data;
    } else if (this.isBulkUpdateQuery()) {
      result = data.length;
    } else if (this.isBulkDeleteQuery()) {
      result = rowCount;
    } else if (this.isVersionQuery()) {
      result = data[0].VERSION;
    } else if (this.isForeignKeysQuery()) {
      result = data;
    } else if (this.isInsertQuery() || this.isUpdateQuery()) {
      result = [result, rowCount];
    } else if (this.isShowConstraintsQuery()) {
      result = this.handleShowConstraintsQuery(data);
    } else if (this.isRawQuery()) {
      // Db2 returns row data and metadata (affected rows etc) in a single object - let's standarize it, sorta
      result = [data, metadata];
    } else {
      result = data;
    }

    return result;
  }

  handleShowTablesQuery(results) {
    return results.map(resultSet => {
      return {
        tableName: resultSet.TABLE_NAME,
        schema: resultSet.TABLE_SCHEMA,
      };
    });
  }

  handleShowConstraintsQuery(data) {
    // Remove SQL Contraints from constraints list.
    return _.remove(data, constraint => {
      return !_.startsWith(constraint.constraintName, 'SQL');
    });
  }

  formatError(err, errStack, conn, parameters) {
    let match;

    if (!(err && err.message)) {
      err.message = 'No error message found.';
    }

    match = err.message.match(/SQL0803N {2}One or more values in the INSERT statement, UPDATE statement, or foreign key update caused by a DELETE statement are not valid because the primary key, unique constraint or unique index identified by "(\d)+" constrains table "(.*)\.(.*)" from having duplicate values for the index key./);
    if (match && match.length > 0) {
      let uniqueIndexName = '';
      let uniqueKey = '';
      const fields = {};
      let message = err.message;
      const query = `SELECT INDNAME FROM SYSCAT.INDEXES  WHERE IID = ${match[1]} AND TABSCHEMA = '${match[2]}' AND TABNAME = '${match[3]}'`;

      if (Boolean(conn) && match.length > 3) {
        uniqueIndexName = conn.querySync(query);
        uniqueIndexName = uniqueIndexName[0].INDNAME;
      }

      if (this.model && Boolean(uniqueIndexName)) {
        uniqueKey = this.model.getIndexes().find(index => index.unique && index.name === uniqueIndexName);
      }

      if (!uniqueKey && this.options.fields) {
        uniqueKey = this.options.fields[match[1] - 1];
      }

      if (uniqueKey) {
        // TODO: DB2 uses a custom "column" property, but it should use "fields" instead, so column can be removed
        if (this.options.where
          && this.options.where[uniqueKey.column] !== undefined) {
          fields[uniqueKey.column] = this.options.where[uniqueKey.column];
        } else if (this.options.instance && this.options.instance.dataValues
          && this.options.instance.dataValues[uniqueKey.column]) {
          fields[uniqueKey.column] = this.options.instance.dataValues[uniqueKey.column];
        } else if (parameters) {
          fields[uniqueKey.column] = parameters['0'];
        }
      }

      if (uniqueKey && Boolean(uniqueKey.msg)) {
        message = uniqueKey.msg;
      }

      const errors = [];
      _.forOwn(fields, (value, field) => {
        errors.push(new sequelizeErrors.ValidationErrorItem(
          this.getUniqueConstraintErrorMessage(field),
          'unique violation', // sequelizeErrors.ValidationErrorItem.Origins.DB,
          field,
          value,
          this.instance,
          'not_unique',
        ));
      });

      return new sequelizeErrors.UniqueConstraintError({ message, errors, cause: err, fields, stack: errStack });
    }

    match = err.message.match(/SQL0532N {2}A parent row cannot be deleted because the relationship "(.*)" restricts the deletion/)
      || err.message.match(/SQL0530N/)
      || err.message.match(/SQL0531N/);
    if (match && match.length > 0) {
      return new sequelizeErrors.ForeignKeyConstraintError({
        fields: null,
        index: match[1],
        cause: err,
        stack: errStack,
      });
    }

    match = err.message.match(/SQL0204N {2}"(.*)" is an undefined name./);
    if (match && match.length > 1) {
      const constraint = match[1];
      let table = err.sql.match(/table "(.+?)"/i);
      table = table ? table[1] : undefined;

      return new sequelizeErrors.UnknownConstraintError({
        message: match[0],
        constraint,
        table,
        cause: err,
        stack: errStack,
      });
    }

    return new sequelizeErrors.DatabaseError(err, { stack: errStack });
  }

  isDropSchemaQuery() {
    let result = false;

    if (_.startsWith(this.sql, 'CALL SYSPROC.ADMIN_DROP_SCHEMA')) {
      result = true;
    }

    return result;
  }

  isShowOrDescribeQuery() {
    let result = false;

    result = result || this.sql.toLowerCase().startsWith('select c.column_name as \'name\', c.data_type as \'type\', c.is_nullable as \'isnull\'');
    result = result || this.sql.toLowerCase().startsWith('select tablename = t.name, name = ind.name,');
    result = result || this.sql.toLowerCase().startsWith('exec sys.sp_helpindex @objname');

    return result;
  }

  isShowIndexesQuery() {
    let result = false;

    result = result || this.sql.toLowerCase().startsWith('exec sys.sp_helpindex @objname');
    result = result || this.sql.startsWith('SELECT NAME AS "name", TBNAME AS "tableName", UNIQUERULE AS "keyType", COLNAMES, INDEXTYPE AS "type" FROM SYSIBM.SYSINDEXES');

    return result;
  }

  handleShowIndexesQuery(data) {
    let currItem;
    const result = [];
    for (const item of data) {
      if (!currItem || currItem.name !== item.Key_name) {
        currItem = {
          primary: item.keyType === 'P',
          fields: [],
          name: item.name,
          tableName: item.tableName,
          unique: item.keyType === 'U',
          type: item.type,
        };

        _.forEach(item.COLNAMES.replace(/\+|-/g, x => {
          return ` ${x}`;
        }).split(' '), column => {
          let columnName = column.trim();
          if (columnName) {
            columnName = columnName.replace(/\+|-/, '');
            currItem.fields.push({
              attribute: columnName,
              length: undefined,
              order: !column.includes('-') ? 'ASC' : 'DESC',
              collate: undefined,
            });
          }
        });
        result.push(currItem);
      }
    }

    return result;
  }

  handleInsertQuery(results, metaData) {
    if (!this.instance) {
      return;
    }

    const modelDefinition = this.model.modelDefinition;
    if (!modelDefinition.autoIncrementAttributeName) {
      return;
    }

    const autoIncrementAttribute = modelDefinition.attributes.get(modelDefinition.autoIncrementAttributeName);

    const id = (results?.[0][this.getInsertIdField()])
      ?? (metaData?.[this.getInsertIdField()])
      ?? (results?.[0][autoIncrementAttribute.columnName]);

    this.instance[autoIncrementAttribute.attributeName] = id;
  }
}
