'use strict';

import { getAttributeName } from '../../utils/format';

const { AbstractQuery } = require('../abstract/query');
const sequelizeErrors = require('../../errors');
const _ = require('lodash');
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

  async _run(connection, sql, parameters, errStack) {
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
          _.forOwn(parameters, (parameter, parameterName) => {
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

      throw this.formatError(error, errStack);
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

    const errForStack = new Error();

    return this.connection.queue.enqueue(() => this._run(this.connection, sql, parameters, errForStack.stack));
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
          _result.Default = _result.Default.replace('(\'', '').replace('\')', '').replace(/'/g, '');
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

    if (this.isVersionQuery()) {
      return data[0].version;
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
      return this.handleShowConstraintsQuery(data);
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

  handleShowConstraintsQuery(data) {
    // Convert snake_case keys to camelCase as it's generated by stored procedure
    return data.slice(1).map(result => {
      const constraint = {};
      for (const key in result) {
        constraint[_.camelCase(key)] = result[key];
      }

      return constraint;
    });
  }

  formatError(err, errStack) {
    let match;

    // TODO: err can be an AggregateError. When that happens, we must throw an AggregateError too instead of throwing only the second error,
    //  or we lose important information

    match = err.message.match(/Violation of (?:UNIQUE|PRIMARY) KEY constraint '([^']*)'. Cannot insert duplicate key in object '.*'\.(:? The duplicate key value is \((.*)\).)?/s);
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
          fields = _.zipObject(uniqueKey.fields, values);
        } else {
          fields[match[1]] = match[3];
        }
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

    match = err.message.match(/Failed on step '(.*)'.Could not create constraint. See previous errors./)
      || err.message.match(/The DELETE statement conflicted with the REFERENCE constraint "(.*)". The conflict occurred in database "(.*)", table "(.*)", column '(.*)'./)
      || err.message.match(/The (?:INSERT|MERGE|UPDATE) statement conflicted with the FOREIGN KEY constraint "(.*)". The conflict occurred in database "(.*)", table "(.*)", column '(.*)'./);
    if (match && match.length > 0) {
      return new sequelizeErrors.ForeignKeyConstraintError({
        fields: null,
        index: match[1],
        cause: err,
        stack: errStack,
      });
    }

    if (err.errors) {
      for (const error of err.errors) {
        match = error.message.match(/Could not create constraint or index. See previous errors./);
        if (match && match.length > 0) {
          return new sequelizeErrors.ForeignKeyConstraintError({
            fields: null,
            index: match[1],
            cause: error,
            stack: errStack,
          });
        }
      }
    }

    match = err.message.match(/Could not drop constraint. See previous errors./);
    if (match && match.length > 0) {
      let constraint = err.sql.match(/(?:constraint|index) \[(.+?)]/i);
      constraint = constraint ? constraint[1] : undefined;
      let table = err.sql.match(/table \[(.+?)]/i);
      table = table ? table[1] : undefined;

      return new sequelizeErrors.UnknownConstraintError({
        message: match[1],
        constraint,
        table,
        cause: err,
        stack: errStack,
      });
    }

    if (err.errors) {
      for (const error of err.errors) {
        match = error.message.match(/Could not drop constraint. See previous errors./);
        if (match && match.length > 0) {
          let constraint = err.sql.match(/(?:constraint|index) \[(.+?)]/i);
          constraint = constraint ? constraint[1] : undefined;
          let table = err.sql.match(/table \[(.+?)]/i);
          table = table ? table[1] : undefined;

          return new sequelizeErrors.UnknownConstraintError({
            message: match[1],
            constraint,
            table,
            cause: error,
            stack: errStack,
          });
        }
      }
    }

    return new sequelizeErrors.DatabaseError(err, { stack: errStack });
  }

  isShowOrDescribeQuery() {
    let result = false;

    result = result || this.sql.toLowerCase().startsWith('select c.column_name as \'name\', c.data_type as \'type\', c.is_nullable as \'isnull\'');
    result = result || this.sql.toLowerCase().startsWith('select tablename = t.name, name = ind.name,');
    result = result || this.sql.toLowerCase().startsWith('exec sys.sp_helpindex @objname');

    return result;
  }

  isShowIndexesQuery() {
    return this.sql.toLowerCase().startsWith('exec sys.sp_helpindex @objname');
  }

  handleShowIndexesQuery(data) {
    // Group by index name, and collect all fields
    data = data.reduce((acc, item) => {
      if (!(item.index_name in acc)) {
        acc[item.index_name] = item;
        item.fields = [];
      }

      for (const column of item.index_keys.split(',')) {
        let columnName = column.trim();
        if (columnName.includes('(-)')) {
          columnName = columnName.replace('(-)', '');
        }

        acc[item.index_name].fields.push({
          attribute: columnName,
          length: undefined,
          order: column.includes('(-)') ? 'DESC' : 'ASC',
          collate: undefined,
        });
      }

      delete item.index_keys;

      return acc;
    }, {});

    return _.map(data, item => ({
      primary: item.index_name.toLowerCase().startsWith('pk'),
      fields: item.fields,
      name: item.index_name,
      tableName: undefined,
      unique: item.index_description.toLowerCase().includes('unique'),
      type: undefined,
    }));
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
