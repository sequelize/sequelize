'use strict';

import { getAttributeName } from '../../utils/format';

import forOwn from 'lodash/forOwn';
import zipObject from 'lodash/zipObject';

const { AbstractQuery } = require('../abstract/query');
const sequelizeErrors = require('../../errors');
const { logger } = require('../../utils/logger');

const debug = logger.debugContext('sql:mssql');

const minSafeIntegerAsBigInt = BigInt(Number.MIN_SAFE_INTEGER);
const maxSafeIntegerAsBigInt = BigInt(Number.MAX_SAFE_INTEGER);

function getScale(aNum) {
  if (!Number.isFinite(aNum)) {
    return 0;
  }

  let e = 1;
  while (Math.round(aNum * e) / e !== aNum) {
    e *= 10;
  }

  return Math.log10(e);
}

export class MsSqlQuery extends AbstractQuery {
  getInsertIdField() {
    return 'id';
  }

  getSQLTypeFromJsType(value, TYPES) {
    const paramType = { type: TYPES.NVarChar, typeOptions: {}, value };
    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        if (value >= -2_147_483_648 && value <= 2_147_483_647) {
          paramType.type = TYPES.Int;
        } else {
          paramType.type = TYPES.BigInt;
        }
      } else {
        paramType.type = TYPES.Numeric;
        // Default to a reasonable numeric precision/scale pending more sophisticated logic
        paramType.typeOptions = { precision: 30, scale: getScale(value) };
      }
    } else if (typeof value === 'bigint') {
      if (value < minSafeIntegerAsBigInt || value > maxSafeIntegerAsBigInt) {
        paramType.type = TYPES.VarChar;
        paramType.value = value.toString();
      } else {
        return this.getSQLTypeFromJsType(Number(value), TYPES);
      }
    } else if (typeof value === 'boolean') {
      paramType.type = TYPES.Bit;
    }

    if (Buffer.isBuffer(value)) {
      paramType.type = TYPES.VarBinary;
    }

    return paramType;
  }

  async _run(connection, sql, parameters) {
    this.sql = sql;
    const { options } = this;

    const complete = this._logQuery(sql, debug, parameters);

    const query = new Promise((resolve, reject) => {
      // TRANSACTION SUPPORT
      if (sql.startsWith('BEGIN TRANSACTION')) {
        connection.beginTransaction(error => (error ? reject(error) : resolve([])), options.transaction.name, connection.lib.ISOLATION_LEVEL[options.isolationLevel]);

        return;
      }

      if (sql.startsWith('COMMIT TRANSACTION')) {
        connection.commitTransaction(error => (error ? reject(error) : resolve([])));

        return;
      }

      if (sql.startsWith('ROLLBACK TRANSACTION')) {
        connection.rollbackTransaction(error => (error ? reject(error) : resolve([])), options.transaction.name);

        return;
      }

      if (sql.startsWith('SAVE TRANSACTION')) {
        connection.saveTransaction(error => (error ? reject(error) : resolve([])), options.transaction.name);

        return;
      }

      const rows = [];
      const request = new connection.lib.Request(sql, (err, rowCount) => (err ? reject(err) : resolve([rows, rowCount])));

      if (parameters) {
        if (Array.isArray(parameters)) {
          // eslint-disable-next-line unicorn/no-for-loop
          for (let i = 0; i < parameters.length; i++) {
            const paramType = this.getSQLTypeFromJsType(parameters[i], connection.lib.TYPES);
            request.addParameter(String(i + 1), paramType.type, paramType.value, paramType.typeOptions);
          }
        } else {
          forOwn(parameters, (parameter, parameterName) => {
            const paramType = this.getSQLTypeFromJsType(parameter, connection.lib.TYPES);
            request.addParameter(parameterName, paramType.type, paramType.value, paramType.typeOptions);
          });
        }

      }

      request.on('row', columns => {
        rows.push(columns);
      });

      connection.execSql(request);
    });

    let rows;
    let rowCount;

    try {
      [rows, rowCount] = await query;
    } catch (error) {
      error.sql = sql;
      error.parameters = parameters;

      throw this.formatError(error);
    }

    complete();

    if (Array.isArray(rows)) {
      const dialect = this.sequelize.dialect;
      rows = rows.map(columns => {
        const row = {};
        for (const column of columns) {
          const parser = dialect.getParserForDatabaseDataType(column.metadata.type.type);
          let value = column.value;

          if (value != null && parser) {
            value = parser(value);
          }

          row[column.metadata.colName] = value;
        }

        return row;
      });
    }

    return this.formatResults(rows, rowCount);
  }

  run(sql, parameters) {
    return this.connection.queue.enqueue(() => this._run(this.connection, sql, parameters));
  }

  /**
   * High level function that handles the results of a query execution.
   *
   * @param {Array} data - The result of the query execution.
   * @param {number} rowCount
   * @private
   * @example
   * Example:
   *  query.formatResults([
   *    {
   *      id: 1,              // this is from the main table
   *      attr2: 'snafu',     // this is from the main table
   *      Tasks.id: 1,        // this is from the associated table
   *      Tasks.title: 'task' // this is from the associated table
   *    }
   *  ])
   */
  formatResults(data, rowCount) {
    if (this.isInsertQuery(data)) {
      this.handleInsertQuery(data);

      return [this.instance || data, rowCount];
    }

    if (this.isShowTablesQuery()) {
      return this.handleShowTablesQuery(data);
    }

    if (this.isDescribeQuery()) {
      const result = {};
      for (const _result of data) {
        if (_result.Default) {
          _result.Default = _result.Default.replace('(\'', '').replace('\')', '').replaceAll('\'', '');
        }

        result[_result.Name] = {
          type: _result.Type.toUpperCase(),
          allowNull: _result.IsNull === 'YES',
          defaultValue: _result.Default,
          primaryKey: _result.Constraint === 'PRIMARY KEY',
          autoIncrement: _result.IsIdentity === 1,
          comment: _result.Comment,
        };

        if (
          result[_result.Name].type.includes('CHAR')
          && _result.Length
        ) {
          if (_result.Length === -1) {
            result[_result.Name].type += '(MAX)';
          } else {
            result[_result.Name].type += `(${_result.Length})`;
          }
        }
      }

      return result;
    }

    if (this.isSelectQuery()) {
      return this.handleSelectQuery(data);
    }

    if (this.isShowIndexesQuery()) {
      return this.handleShowIndexesQuery(data);
    }

    if (this.isCallQuery()) {
      return data[0];
    }

    if (this.isBulkUpdateQuery()) {
      if (this.options.returning) {
        return this.handleSelectQuery(data);
      }

      return rowCount;
    }

    if (this.isBulkDeleteQuery()) {
      return data[0] ? data[0].AFFECTEDROWS : 0;
    }

    if (this.isForeignKeysQuery()) {
      return data;
    }

    if (this.isUpsertQuery()) {
      // if this was an upsert and no data came back, that means the record exists, but the update was a noop.
      // return the current instance and mark it as an "not an insert".
      if (data && data.length === 0) {
        return [this.instance || data, false];
      }

      this.handleInsertQuery(data);

      return [this.instance || data, data[0].$action === 'INSERT'];
    }

    if (this.isUpdateQuery()) {
      return [this.instance || data, rowCount];
    }

    if (this.isShowConstraintsQuery()) {
      return data;
    }

    if (this.isRawQuery()) {
      return [data, rowCount];
    }

    return data;
  }

  handleShowTablesQuery(results) {
    return results.map(resultSet => {
      return {
        tableName: resultSet.TABLE_NAME,
        schema: resultSet.TABLE_SCHEMA,
      };
    });
  }

  formatError(err) {
    let match;

    match = err.message.match(/Violation of (?:UNIQUE|PRIMARY) KEY constraint '([^']*)'\. Cannot insert duplicate key in object '.*'\.(:? The duplicate key value is \((.*)\).)?/s);
    match = match || err.message.match(/Cannot insert duplicate key row in object .* with unique index '(.*)'\.(:? The duplicate key value is \((.*)\).)?/s);
    if (match && match.length > 1) {
      let fields = {};
      const uniqueKey = this.model && this.model.getIndexes().find(index => index.unique && index.name === match[1]);

      let message = 'Validation error';

      if (uniqueKey && Boolean(uniqueKey.msg)) {
        message = uniqueKey.msg;
      }

      if (match[3]) {
        const values = match[3].split(',').map(part => part.trim());
        if (uniqueKey) {
          fields = zipObject(uniqueKey.fields, values);
        } else {
          fields[match[1]] = match[3];
        }
      }

      const errors = [];
      forOwn(fields, (value, field) => {
        errors.push(new sequelizeErrors.ValidationErrorItem(
          this.getUniqueConstraintErrorMessage(field),
          'unique violation', // sequelizeErrors.ValidationErrorItem.Origins.DB,
          field,
          value,
          this.instance,
          'not_unique',
        ));
      });

      const uniqueConstraintError = new sequelizeErrors.UniqueConstraintError({ message, errors, cause: err, fields });
      if (err.errors?.length > 0) {
        return new sequelizeErrors.AggregateError([...err.errors, uniqueConstraintError]);
      }

      return uniqueConstraintError;
    }

    match = err.message.match(/The (?:DELETE|INSERT|MERGE|UPDATE) statement conflicted with the (?:FOREIGN KEY|REFERENCE) constraint "(.*)"\. The conflict occurred in database "(.*)", table "(.*)", column '(.*)'\./);
    if (match && match.length > 1) {
      const fkConstraintError = new sequelizeErrors.ForeignKeyConstraintError({
        index: match[1],
        cause: err,
        table: match[3],
        fields: [match[4]],
      });

      if (err.errors?.length > 0) {
        return new sequelizeErrors.AggregateError([...err.errors, fkConstraintError]);
      }

      return fkConstraintError;
    }

    if (err.errors?.length > 0) {
      let firstError;
      for (const [index, error] of err.errors.entries()) {
        match = error.message.match(/Could not (?:create|drop) constraint(?: or index)?\. See previous errors\./);
        if (match && match.length > 0) {
          let constraint = err.sql.match(/(?:constraint|index) \[(.+?)]/i);
          constraint = constraint ? constraint[1] : undefined;
          let table = err.sql.match(/table \[(.+?)]/i);
          table = table ? table[1] : undefined;

          firstError = new sequelizeErrors.UnknownConstraintError({
            message: err.errors[index - 1].message,
            constraint,
            table,
            cause: err,
          });
        }
      }

      if (firstError) {
        return new sequelizeErrors.AggregateError([...err.errors, firstError]);
      }

      return new sequelizeErrors.AggregateError(err.errors);
    }

    return new sequelizeErrors.DatabaseError(err);
  }

  isShowOrDescribeQuery() {
    let result = false;

    result = result || this.sql.toLowerCase().startsWith('select c.column_name as \'name\', c.data_type as \'type\', c.is_nullable as \'isnull\'');
    result = result || this.sql.toLowerCase().startsWith('select tablename = t.name, name = ind.name,');
    result = result || this.sql.toLowerCase().startsWith('exec sys.sp_helpindex @objname');

    return result;
  }

  handleShowIndexesQuery(data) {
    // Group by index name, and collect all fields
    const indexes = data.reduce((acc, curr) => {
      if (acc.has(curr.index_name)) {
        const index = acc.get(curr.index_name);
        if (curr.is_included_column) {
          index.includes.push(curr.column_name);
        } else {
          index.fields.push({
            attribute: curr.column_name,
            length: undefined,
            order: curr.is_descending_key ? 'DESC' : 'ASC',
            collate: undefined,
          });
        }

        return acc;
      }

      acc.set(curr.index_name, {
        primary: curr.is_primary_key,
        fields: curr.is_included_column
          ? []
          : [
            {
              attribute: curr.column_name,
              length: undefined,
              order: curr.is_descending_key ? 'DESC' : 'ASC',
              collate: undefined,
            },
          ],
        includes: curr.is_included_column ? [curr.column_name] : [],
        name: curr.index_name,
        tableName: undefined,
        unique: curr.is_unique,
        type: null,
      });

      return acc;
    }, new Map());

    return Array.from(indexes.values());
  }

  handleInsertQuery(insertedRows, metaData) {
    if (!this.instance?.dataValues) {
      return;
    }

    // map column names to attribute names
    insertedRows = insertedRows.map(row => {
      const attributes = Object.create(null);

      for (const columnName of Object.keys(row)) {
        const attributeName = getAttributeName(this.model, columnName) ?? columnName;

        attributes[attributeName] = row[columnName];
      }

      return attributes;
    });

    insertedRows = this._parseDataArrayByType(insertedRows, this.model, this.options.includeMap);

    const autoIncrementAttributeName = this.model.autoIncrementAttribute;
    let id = null;

    id = id || insertedRows && insertedRows[0][this.getInsertIdField()];
    id = id || metaData && metaData[this.getInsertIdField()];
    id = id || insertedRows && insertedRows[0][autoIncrementAttributeName];

    // assign values to existing instance
    this.instance[autoIncrementAttributeName] = id;
    for (const attributeName of Object.keys(insertedRows[0])) {
      this.instance.dataValues[attributeName] = insertedRows[0][attributeName];
    }
  }
}
