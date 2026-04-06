'use strict';

import {
  AbstractQuery,
  DatabaseError,
  EmptyResultError,
  ForeignKeyConstraintError,
  UniqueConstraintError,
  UnknownConstraintError,
  ValidationErrorItem,
} from '@sequelize/core';
import { logger } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/logger.js';
import forOwn from 'lodash/forOwn';
import assert from 'node:assert';

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

    const params = [];
    if (parameters) {
      forOwn(parameters, (value, key) => {
        const param = this.getSQLTypeFromJsType(value, key);
        params.push(param);
      });
    }

    const SQL = this.sql.toUpperCase();
    let newSql = this.sql;

    // TODO: move this to Db2QueryGenerator
    if ((this.isSelectQuery() || SQL.startsWith('SELECT ')) && !SQL.includes(' FROM ', 8)) {
      if (this.sql.at(-1) === ';') {
        newSql = this.sql.slice(0, -1);
      }

      newSql += ' FROM SYSIBM.SYSDUMMY1;';
    }

    let stmt;
    try {
      stmt = await connection.prepare(newSql);
    } catch (error) {
      throw this.formatError(error);
    }

    let res;
    try {
      // Warning: the promise version stmt.execute() does not return the same thing as stmt.execute(callback), despite the documentation.
      res = await this.#execute(stmt, params);
    } catch (error) {
      if (error.message) {
        // eslint-disable-next-line no-ex-assign -- legacy code. TODO: reformat
        error = this.filterSQLError(error, this.sql, connection);
        if (error === null) {
          stmt.closeSync();

          return this.formatResults([], 0);
        }
      }

      error.sql = sql;
      stmt.closeSync();
      throw this.formatError(error, connection, parameters);
    }

    const { outparams, result } = res;

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

    let data = [];
    let metadata = [];
    let affectedRows = 0;
    if (typeof result === 'object') {
      if (this.sql.startsWith('DELETE FROM ')) {
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
        coltypes[metadatum.SQL_DESC_NAME] = metadatum.SQL_DESC_TYPE_NAME;
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

      return this.formatResults(data, datalen, metadata);
    }

    return this.formatResults(data, affectedRows);
  }

  async run(sql, parameters) {
    return await this._run(this.connection, sql, parameters);
  }

  #execute(stmt, params) {
    return new Promise((resolve, reject) => {
      stmt.execute(params, (err, result, outparams) => {
        if (err) {
          reject(err);
        } else {
          resolve({ result, outparams });
        }
      });
    });
  }

  filterSQLError(err, _sql, _connection) {
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
   * @private
   */
  formatResults(data, rowCount, metadata) {
    if (this.isInsertQuery() || this.isUpdateQuery() || this.isUpsertQuery()) {
      if (this.instance && this.instance.dataValues) {
        // If we are creating an instance, and we get no rows, the create failed but did not throw.
        // This probably means a conflict happened and was ignored, to avoid breaking a transaction.
        if (this.isInsertQuery() && !this.isUpsertQuery() && data.length === 0) {
          throw new EmptyResultError();
        }

        // Due to Db2 returning values with every insert or update,
        // we only want to map the returned values to the instance if the user wants it.
        // TODO: This is a hack, and should be fixed in the future.
        if (this.options.returning && Array.isArray(data) && data[0]) {
          for (const attributeOrColumnName of Object.keys(data[0])) {
            const modelDefinition = this.model.modelDefinition;
            const attribute = modelDefinition.columns.get(attributeOrColumnName);
            const updatedValue = this._parseDatabaseValue(
              data[0][attributeOrColumnName],
              attribute?.type,
            );

            this.instance.set(attribute?.attributeName ?? attributeOrColumnName, updatedValue, {
              raw: true,
              comesFromDatabase: true,
            });
          }
        }
      }

      if (this.isUpsertQuery()) {
        return [this.instance, null];
      }

      return [
        this.instance || (data && ((this.options.plain && data[0]) || data)) || undefined,
        this.options.returning ? data.length : rowCount,
      ];
    }

    if (this.isBulkUpdateQuery()) {
      return this.options.returning ? this.handleSelectQuery(data) : rowCount;
    }

    let result = this.instance;
    if (this.isDescribeQuery()) {
      result = {};
      for (const _result of data) {
        if (_result.Default) {
          _result.Default = _result.Default.replace("('", '').replace("')", '').replaceAll("'", '');
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
    } else if (this.isCallQuery()) {
      result = data;
    } else if (this.isDeleteQuery()) {
      result = rowCount;
    } else if (this.isShowConstraintsQuery()) {
      result = data;
    } else if (this.isRawQuery()) {
      // Db2 returns row data and metadata (affected rows etc) in a single object - let's standarize it, sorta
      result = [data, metadata];
    } else {
      result = data;
    }

    return result;
  }

  formatError(err, conn, parameters) {
    let match;

    if (!(err && err.message)) {
      err.message = 'No error message found.';
    }

    match = err.message.match(
      /SQL0803N {2}An error or warning occurred. {2}One or more values in the INSERT statement, UPDATE statement, or foreign key update caused by a DELETE statement are not valid because the primary key, unique constraint or unique index identified by "(\d)+" constrains table "(.*)\.(.*)" from having duplicate values for the index key./,
    );
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
        uniqueKey = this.model
          .getIndexes()
          .find(index => index.unique && index.name === uniqueIndexName);
      }

      if (!uniqueKey && this.options.fields) {
        uniqueKey = this.options.fields[match[1] - 1];
      }

      if (uniqueKey) {
        // TODO: DB2 uses a custom "column" property, but it should use "fields" instead, so column can be removed
        if (this.options.where && this.options.where[uniqueKey.column] !== undefined) {
          fields[uniqueKey.column] = this.options.where[uniqueKey.column];
        } else if (
          this.options.instance &&
          this.options.instance.dataValues &&
          this.options.instance.dataValues[uniqueKey.column]
        ) {
          fields[uniqueKey.column] = this.options.instance.dataValues[uniqueKey.column];
        } else if (parameters) {
          fields[uniqueKey.column] = parameters['0'];
        }
      }

      if (uniqueKey && Boolean(uniqueKey.msg)) {
        message = uniqueKey.msg;
      }

      const errors = [];
      forOwn(fields, (value, field) => {
        errors.push(
          new ValidationErrorItem(
            this.getUniqueConstraintErrorMessage(field),
            'unique violation', // ValidationErrorItem.Origins.DB,
            field,
            value,
            this.instance,
            'not_unique',
          ),
        );
      });

      return new UniqueConstraintError({ message, errors, cause: err, fields });
    }

    match =
      err.message.match(
        /SQL0532N {2}A parent row cannot be deleted because the relationship "(.*)" restricts the deletion/,
      ) ||
      err.message.match(/SQL0530N/) ||
      err.message.match(/SQL0531N/);
    if (match && match.length > 0) {
      const data = err.message.match(/(?:"([\w.]+)")/);
      const constraintData = data && data.length > 0 ? data[1] : undefined;
      const [, table, constraint] = constraintData.split('.');

      return new ForeignKeyConstraintError({
        fields: null,
        index: constraint,
        cause: err,
        table,
      });
    }

    match = err.message.match(/SQL0204N {2}"(.*)" is an undefined name./);
    if (match && match.length > 1) {
      const constraint = match[1];
      let table = err.sql.match(/table "(.+?)"/i);
      table = table ? table[1] : undefined;

      return new UnknownConstraintError({
        message: match[0],
        constraint,
        table,
        cause: err,
      });
    }

    return new DatabaseError(err);
  }

  isShowOrDescribeQuery() {
    let result = false;

    result ||= this.sql
      .toLowerCase()
      .startsWith(
        "select c.column_name as 'name', c.data_type as 'type', c.is_nullable as 'isnull'",
      );
    result ||= this.sql.toLowerCase().startsWith('select tablename = t.name, name = ind.name,');
    result ||= this.sql.toLowerCase().startsWith('exec sys.sp_helpindex @objname');

    return result;
  }

  handleShowIndexesQuery(data) {
    const indexes = data.reduce((acc, curr) => {
      if (acc.has(curr.name)) {
        const index = acc.get(curr.name);
        if (curr.columnOrder === 'I') {
          index.includes.push(curr.columnName);
        } else {
          index.fields.push({
            attribute: curr.columnName,
            length: undefined,
            order: curr.columnOrder === 'D' ? 'DESC' : curr.columnOrder === 'A' ? 'ASC' : undefined,
            collate: undefined,
          });
        }

        return acc;
      }

      acc.set(curr.name, {
        primary: curr.keyType === 'P',
        fields:
          curr.columnOrder === 'I'
            ? []
            : [
                {
                  attribute: curr.columnName,
                  length: undefined,
                  order: curr.columnOrder === 'D' ? 'DESC' : 'ASC',
                  collate: undefined,
                },
              ],
        includes: curr.columnOrder === 'I' ? [curr.columnName] : [],
        name: curr.name,
        tableName: curr.tableName,
        unique: curr.keyType === 'U',
        type: curr.type,
      });

      return acc;
    }, new Map());

    return Array.from(indexes.values());
  }
}
