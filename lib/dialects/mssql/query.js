'use strict';

const logger = require('../../utils/logger');
const Promise = require('../../promise');
const AbstractQuery = require('../abstract/query');
const sequelizeErrors = require('../../errors');
const parserStore = require('../parserStore')('mssql');
const _ = require('lodash');
const debug = logger.getLogger().debugContext('sql:mssql');

class Query extends AbstractQuery {
  getInsertIdField() {
    return 'id';
  }

  getSQLTypeFromJsType(value, TYPES) {
    const paramType = { type: TYPES.VarChar, typeOptions: {} };
    paramType.type = TYPES.NVarChar;
    if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        paramType.type = TYPES.Int;
      } else {
        paramType.type = TYPES.Numeric;
        //Default to a reasonable numeric precision/scale pending more sophisticated logic
        paramType.typeOptions = { precision: 30, scale: 15 };
      }
    }
    if (Buffer.isBuffer(value)) {
      paramType.type = TYPES.VarBinary;
    }
    return paramType;
  }

  _run(connection, sql, parameters) {
    this.sql = sql;

    //do we need benchmark for this query execution
    const benchmark = this.sequelize.options.benchmark || this.options.benchmark;
    let queryBegin;
    if (benchmark) {
      queryBegin = Date.now();
    } else {
      this.sequelize.log(`Executing (${this.connection.uuid || 'default'}): ${this.sql}`, this.options);
    }

    debug(`executing(${this.connection.uuid || 'default'}) : ${this.sql}`);

    return new Promise((resolve, reject) => {
      // TRANSACTION SUPPORT
      if (this.sql.startsWith('BEGIN TRANSACTION')) {
        return connection.beginTransaction(err => {
          if (err) {
            reject(this.formatError(err));
            return;
          }
          resolve(this.formatResults());
        }, this.options.transaction.name, connection.lib.ISOLATION_LEVEL[this.options.isolationLevel]);
      }
      if (this.sql.startsWith('COMMIT TRANSACTION')) {
        return connection.commitTransaction(err => {
          if (err) {
            reject(this.formatError(err));
            return;
          }
          resolve(this.formatResults());
        });
      }
      if (this.sql.startsWith('ROLLBACK TRANSACTION')) {
        return connection.rollbackTransaction(err => {
          if (err) {
            reject(this.formatError(err));
          }
          resolve(this.formatResults());
        }, this.options.transaction.name);
      }
      if (this.sql.startsWith('SAVE TRANSACTION')) {
        return connection.saveTransaction(err => {
          if (err) {
            reject(this.formatError(err));
            return;
          }
          resolve(this.formatResults());
        }, this.options.transaction.name);
      }
      const results = [];
      const request = new connection.lib.Request(this.sql, (err, rowCount) => {

        debug(`executed(${this.connection.uuid || 'default'}) : ${this.sql}`);

        if (benchmark) {
          this.sequelize.log(`Executed (${this.connection.uuid || 'default'}): ${this.sql}`, Date.now() - queryBegin, this.options);
        }

        if (err) {
          err.sql = sql;
          reject(this.formatError(err));
        } else {
          resolve(this.formatResults(results, rowCount));
        }
      });

      if (parameters) {
        _.forOwn(parameters, (value, key) => {
          const paramType = this.getSQLTypeFromJsType(value, connection.lib.TYPES);
          request.addParameter(key, paramType.type, value, paramType.typeOptions);
        });
      }

      request.on('row', columns => {
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

        results.push(row);
      });

      connection.execSql(request);
    });
  }

  run(sql, parameters) {
    return Promise.using(this.connection.lock(), connection => this._run(connection, sql, parameters));
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
    let result = this.instance;
    if (this.isInsertQuery(data)) {
      this.handleInsertQuery(data);

      if (!this.instance) {
        if (this.options.plain) {
          // NOTE: super contrived. This just passes the newly added query-interface
          //       test returning only the PK. There isn't a way in MSSQL to identify
          //       that a given return value is the PK, and we have no schema information
          //       because there was no calling Model.
          const record = data[0];
          result = record[Object.keys(record)[0]];
        } else {
          result = data;
        }
      }
    }

    if (this.isShowTablesQuery()) {
      return this.handleShowTablesQuery(data);
    }
    if (this.isDescribeQuery()) {
      result = {};
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
          result[_result.Name].type.includes('VARCHAR')
          && _result.Length
        ) {
          result[_result.Name].type += `(${_result.Length})`;
        }

      }
    }
    if (this.isSelectQuery()) {
      return this.handleSelectQuery(data);
    }
    if (this.isShowIndexesQuery()) {
      return this.handleShowIndexesQuery(data);
    }
    if (this.isUpsertQuery()) {
      return data[0];
    }
    if (this.isCallQuery()) {
      return data[0];
    }
    if (this.isBulkUpdateQuery()) {
      return data.length;
    }
    if (this.isBulkDeleteQuery()) {
      return data[0] && data[0].AFFECTEDROWS;
    }
    if (this.isVersionQuery()) {
      return data[0].version;
    }
    if (this.isForeignKeysQuery()) {
      return data;
    }
    if (this.isInsertQuery() || this.isUpdateQuery()) {
      return [result, rowCount];
    }
    if (this.isShowConstraintsQuery()) {
      return this.handleShowConstraintsQuery(data);
    }
    if (this.isRawQuery()) {
      // MSSQL returns row data and metadata (affected rows etc) in a single object - let's standarize it, sorta
      return [data, data];
    }

    return result;
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

  formatError(err) {
    let match;

    match = err.message.match(/Violation of (?:UNIQUE|PRIMARY) KEY constraint '((.|\s)*)'. Cannot insert duplicate key in object '.*'.(:? The duplicate key value is \((.*)\).)?/);
    match = match || err.message.match(/Cannot insert duplicate key row in object .* with unique index '(.*)'/);
    if (match && match.length > 1) {
      let fields = {};
      const uniqueKey = this.model && this.model.uniqueKeys[match[1]];
      let message = 'Validation error';

      if (uniqueKey && !!uniqueKey.msg) {
        message = uniqueKey.msg;
      }
      if (match[4]) {
        const values = match[4].split(',').map(part => part.trim());
        if (uniqueKey) {
          fields = _.zipObject(uniqueKey.fields, values);
        } else {
          fields[match[1]] = match[4];
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

      return new sequelizeErrors.UniqueConstraintError({ message, errors, parent: err, fields });
    }

    match = err.message.match(/Failed on step '(.*)'.Could not create constraint. See previous errors./) ||
      err.message.match(/The DELETE statement conflicted with the REFERENCE constraint "(.*)". The conflict occurred in database "(.*)", table "(.*)", column '(.*)'./) ||
      err.message.match(/The (?:INSERT|MERGE|UPDATE) statement conflicted with the FOREIGN KEY constraint "(.*)". The conflict occurred in database "(.*)", table "(.*)", column '(.*)'./);
    if (match && match.length > 0) {
      return new sequelizeErrors.ForeignKeyConstraintError({
        fields: null,
        index: match[1],
        parent: err
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
        parent: err
      });
    }

    return new sequelizeErrors.DatabaseError(err);
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

      if (this.model.rawAttributes.hasOwnProperty(autoIncrementAttribute) &&
        this.model.rawAttributes[autoIncrementAttribute].field !== undefined)
        autoIncrementAttributeAlias = this.model.rawAttributes[autoIncrementAttribute].field;

      id = id || results && results[0][this.getInsertIdField()];
      id = id || metaData && metaData[this.getInsertIdField()];
      id = id || results && results[0][autoIncrementAttribute];
      id = id || autoIncrementAttributeAlias && results && results[0][autoIncrementAttributeAlias];

      this.instance[autoIncrementAttribute] = id;
    }
  }
}

module.exports = Query;
module.exports.Query = Query;
module.exports.default = Query;
