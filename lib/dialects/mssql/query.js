'use strict';

const AbstractQuery = require('../abstract/query');
const sequelizeErrors = require('../../errors');
const parserStore = require('../parserStore')('mssql');
const _ = require('lodash');
const { logger } = require('../../utils/logger');

const debug = logger.debugContext('sql:mssql');

function getScale(aNum) {
  if (!Number.isFinite(aNum)) return 0;
  let e = 1;
  while (Math.round(aNum * e) / e !== aNum) e *= 10;
  return Math.log10(e);
}

class Query extends AbstractQuery {
  getInsertIdField() {
    return 'id';
  }

  getSQLTypeFromJsType(value, TYPES) {
    const paramType = { type: TYPES.VarChar, typeOptions: {} };
    paramType.type = TYPES.NVarChar;
    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        if (value >= -2147483648 && value <= 2147483647) {
          paramType.type = TYPES.Int;
        } else {
          paramType.type = TYPES.BigInt;
        }
      } else {
        paramType.type = TYPES.Numeric;
        //Default to a reasonable numeric precision/scale pending more sophisticated logic
        paramType.typeOptions = { precision: 30, scale: getScale(value) };
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
        return connection.beginTransaction(error => error ? reject(error) : resolve([]), options.transaction.name, connection.lib.ISOLATION_LEVEL[options.isolationLevel]);
      }
      if (sql.startsWith('COMMIT TRANSACTION')) {
        return connection.commitTransaction(error => error ? reject(error) : resolve([]));
      }
      if (sql.startsWith('ROLLBACK TRANSACTION')) {
        return connection.rollbackTransaction(error => error ? reject(error) : resolve([]), options.transaction.name);
      }
      if (sql.startsWith('SAVE TRANSACTION')) {
        return connection.saveTransaction(error => error ? reject(error) : resolve([]), options.transaction.name);
      }

      const rows = [];
      const request = new connection.lib.Request(sql, (err, rowCount) => err ? reject(err) : resolve([rows, rowCount]));

      if (parameters) {
        _.forOwn(parameters, (value, key) => {
          const paramType = this.getSQLTypeFromJsType(value, connection.lib.TYPES);
          request.addParameter(key, paramType.type, value, paramType.typeOptions);
        });
      }

      request.on('row', columns => {
        rows.push(columns);
      });

      connection.execSql(request);
    });

    let rows, rowCount;

    try {
      [rows, rowCount] = await query;
    } catch (err) {
      err.sql = sql;
      err.parameters = parameters;

      throw this.formatError(err, errStack);
    }

    complete();

    if (Array.isArray(rows)) {
      rows = rows.map(columns => {
        const row = {};
        for (const column of columns) {
          const typeid = column.metadata.type.id;
          const parse = parserStore.get(typeid);
          let value = column.value;

          if (value !== null & !!parse) {
            value = parse(value);
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
    return this.connection.queue.enqueue(() =>
      this._run(this.connection, sql, parameters, errForStack.stack)
    );
  }

  static formatBindParameters(sql, values, dialect) {
    const bindParam = {};
    const replacementFunc = (match, key, values) => {
      if (values[key] !== undefined) {
        bindParam[key] = values[key];
        return `@${key}`;
      }
      return undefined;
    };
    sql = AbstractQuery.formatBindParameters(sql, values, dialect, replacementFunc)[0];

    return [sql, bindParam];
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
          _result.Default = _result.Default.replace("('", '').replace("')", '').replace(/'/g, '');
        }

        result[_result.Name] = {
          type: _result.Type.toUpperCase(),
          allowNull: _result.IsNull === 'YES' ? true : false,
          defaultValue: _result.Default,
          primaryKey: _result.Constraint === 'PRIMARY KEY',
          autoIncrement: _result.IsIdentity === 1,
          comment: _result.Comment
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
        schema: resultSet.TABLE_SCHEMA
      };
    });
  }

  handleShowConstraintsQuery(data) {
    //Convert snake_case keys to camelCase as it's generated by stored procedure
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

    match = err.message.match(/Violation of (?:UNIQUE|PRIMARY) KEY constraint '([^']*)'. Cannot insert duplicate key in object '.*'.(:? The duplicate key value is \((.*)\).)?/);
    match = match || err.message.match(/Cannot insert duplicate key row in object .* with unique index '(.*)'/);
    if (match && match.length > 1) {
      let fields = {};
      const uniqueKey = this.model && this.model.uniqueKeys[match[1]];
      let message = 'Validation error';

      if (uniqueKey && !!uniqueKey.msg) {
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
          'not_unique'
        ));
      });

      return new sequelizeErrors.UniqueConstraintError({ message, errors, parent: err, fields, stack: errStack });
    }

    match = err.message.match(/Failed on step '(.*)'.Could not create constraint. See previous errors./) ||
      err.message.match(/The DELETE statement conflicted with the REFERENCE constraint "(.*)". The conflict occurred in database "(.*)", table "(.*)", column '(.*)'./) ||
      err.message.match(/The (?:INSERT|MERGE|UPDATE) statement conflicted with the FOREIGN KEY constraint "(.*)". The conflict occurred in database "(.*)", table "(.*)", column '(.*)'./);
    if (match && match.length > 0) {
      return new sequelizeErrors.ForeignKeyConstraintError({
        fields: null,
        index: match[1],
        parent: err,
        stack: errStack
      });
    }

    match = err.message.match(/Could not drop constraint. See previous errors./);
    if (match && match.length > 0) {
      let constraint = err.sql.match(/(?:constraint|index) \[(.+?)\]/i);
      constraint = constraint ? constraint[1] : undefined;
      let table = err.sql.match(/table \[(.+?)\]/i);
      table = table ? table[1] : undefined;

      return new sequelizeErrors.UnknownConstraintError({
        message: match[1],
        constraint,
        table,
        parent: err,
        stack: errStack
      });
    }

    return new sequelizeErrors.DatabaseError(err, { stack: errStack });
  }

  isShowOrDescribeQuery() {
    let result = false;

    result = result || this.sql.toLowerCase().startsWith("select c.column_name as 'name', c.data_type as 'type', c.is_nullable as 'isnull'");
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

      item.index_keys.split(',').forEach(column => {
        let columnName = column.trim();
        if (columnName.includes('(-)')) {
          columnName = columnName.replace('(-)', '');
        }

        acc[item.index_name].fields.push({
          attribute: columnName,
          length: undefined,
          order: column.includes('(-)') ? 'DESC' : 'ASC',
          collate: undefined
        });
      });
      delete item.index_keys;
      return acc;
    }, {});

    return _.map(data, item => ({
      primary: item.index_name.toLowerCase().startsWith('pk'),
      fields: item.fields,
      name: item.index_name,
      tableName: undefined,
      unique: item.index_description.toLowerCase().includes('unique'),
      type: undefined
    }));
  }

  handleInsertQuery(results, metaData) {
    if (this.instance) {
      // add the inserted row id to the instance
      const autoIncrementAttribute = this.model.autoIncrementAttribute;
      let id = null;
      let autoIncrementAttributeAlias = null;

      if (Object.prototype.hasOwnProperty.call(this.model.rawAttributes, autoIncrementAttribute) &&
        this.model.rawAttributes[autoIncrementAttribute].field !== undefined)
        autoIncrementAttributeAlias = this.model.rawAttributes[autoIncrementAttribute].field;

      id = id || results && results[0][this.getInsertIdField()];
      id = id || metaData && metaData[this.getInsertIdField()];
      id = id || results && results[0][autoIncrementAttribute];
      id = id || autoIncrementAttributeAlias && results && results[0][autoIncrementAttributeAlias];

      this.instance[autoIncrementAttribute] = id;

      if (this.instance.dataValues) {
        for (const key in results[0]) {
          if (Object.prototype.hasOwnProperty.call(results[0], key)) {
            const record = results[0][key];

            const attr = _.find(this.model.rawAttributes, attribute => attribute.fieldName === key || attribute.field === key);

            this.instance.dataValues[attr && attr.fieldName || key] = record;
          }
        }
      }

    }
  }
}

module.exports = Query;
module.exports.Query = Query;
module.exports.default = Query;
