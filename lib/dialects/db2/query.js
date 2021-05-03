'use strict';

const AbstractQuery = require('../abstract/query');
const sequelizeErrors = require('../../errors');
const parserStore = require('../parserStore')('db2');
const _ = require('lodash');
const { logger } = require('../../utils/logger');

const debug = logger.debugContext('sql:db2');

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

  async _run(connection, sql, parameters) {
    
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

      throw this.formatError(err);
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
    return this._run(this.connection, sql, parameters);
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

  filterSQLError(err, sql, connection) {
    if (err.message.search('SQL0204N') != -1 && _.startsWith(sql, 'DROP ')) {
      err = null; // Ignore table not found error for drop table.
    } else if (err.message.search('SQL0443N') != -1) {
      if (this.isDropSchemaQuery()) {
        // Delete ERRORSCHEMA.ERRORTABLE if it exist.
        connection.querySync('DROP TABLE ERRORSCHEMA.ERRORTABLE;');
        // Retry deleting the schema
        connection.querySync(this.sql);
      }
      err = null; // Ignore drop schema error.
    } else if (err.message.search('SQL0601N') != -1) {
      const match = err.message.match(/SQL0601N {2}The name of the object to be created is identical to the existing name "(.*)" of type "(.*)"./);
      if (match && match.length > 1 && match[2] === 'TABLE') {
        let table;
        const mtarray = match[1].split('.');
        if (mtarray[1]) {
          table = `"${mtarray[0]}"."${mtarray[1]}"`;
        } else {
          table = `"${mtarray[0]}"`;
        }
        if (connection.dropTable !== false) {
          connection.querySync(`DROP TABLE ${table}`);
          err = connection.querySync(sql);
        }
        else {
          err = null;
        }
      } else {
        err = null; // Ignore create schema error.
      }
    } else if (err.message.search('SQL0911N') != -1) {
      if (err.message.search('Reason code "2"') != -1) {
        err = null; // Ignore deadlock error due to program logic.
      }
    } else if (err.message.search('SQL0605W') != -1) {
      err = null; // Ignore warning.
    } else if (err.message.search('SQL0668N') != -1 &&
      _.startsWith(sql, 'ALTER TABLE ')) {
      connection.querySync(`CALL SYSPROC.ADMIN_CMD('REORG TABLE ${sql.substring(12).split(' ')[0]}')`);
      err = connection.querySync(sql);
    }
    if (err && err.length === 0) { err = null; }
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
      result = this.handleShowTablesQuery(data);
    } else if (this.isDescribeQuery()) {
      result = {};
      for (const _result of data) {
        if (_result.Default) {
          _result.Default = _result.Default.replace("('", '').replace("')", '').replace(/'/g, '');
        }

        result[_result.Name] = {
          type: _result.Type.toUpperCase(),
          allowNull: _result.IsNull === 'Y' ? true : false,
          defaultValue: _result.Default,
          primaryKey: _result.KeySeq > 0,
          autoIncrement: _result.IsIdentity === 'Y' ? true : false,
          comment: _result.Comment
        };
      }
    } else if (this.isShowIndexesQuery()) {
      result = this.handleShowIndexesQuery(data);
    } else if (this.isSelectQuery()) {
      result = this.handleSelectQuery(data);
    } else if (this.isUpsertQuery()) {
      result = data[0];
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
    // Remove SQL Contraints from constraints list.
    return _.remove(data, constraint => {
      return !_.startsWith(constraint.constraintName, 'SQL');
    });
  }

  formatError(err, conn, parameters) {
    let match;

    if (!(err && err.message)) {
      err['message'] = 'No error message found.';
    }

    match = err.message.match(/SQL0803N {2}One or more values in the INSERT statement, UPDATE statement, or foreign key update caused by a DELETE statement are not valid because the primary key, unique constraint or unique index identified by "(\d)+" constrains table "(.*)\.(.*)" from having duplicate values for the index key./);
    if (match && match.length > 0) {
      let uniqueIndexName = '';
      let uniqueKey = '';
      const fields = {};
      let message = err.message;
      const query = `SELECT INDNAME FROM SYSCAT.INDEXES  WHERE IID = ${match[1]} AND TABSCHEMA = '${match[2]}' AND TABNAME = '${match[3]}'`;

      if (!!conn && match.length > 3) {
        uniqueIndexName = conn.querySync(query);
        uniqueIndexName = uniqueIndexName[0]['INDNAME'];
      }

      if (this.model && !!uniqueIndexName) {
        uniqueKey = this.model.uniqueKeys[uniqueIndexName];
      }

      if (!uniqueKey && this.options.fields) {
        uniqueKey = this.options.fields[match[1] - 1];
      }

      if (uniqueKey) {
        if (this.options.where &&
          this.options.where[uniqueKey.column] !== undefined) {
          fields[uniqueKey.column] = this.options.where[uniqueKey.column];
        } else if (this.options.instance && this.options.instance.dataValues &&
          this.options.instance.dataValues[uniqueKey.column]) {
          fields[uniqueKey.column] = this.options.instance.dataValues[uniqueKey.column];
        } else if (parameters) {
          fields[uniqueKey.column] = parameters['0'];
        }
      }

      if (uniqueKey && !!uniqueKey.msg) {
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
          'not_unique'
        ));
      });

      return new sequelizeErrors.UniqueConstraintError({ message, errors, parent: err, fields });
    }

    match = err.message.match(/SQL0532N {2}A parent row cannot be deleted because the relationship "(.*)" restricts the deletion/) ||
      err.message.match(/SQL0530N/) ||
      err.message.match(/SQL0531N/);
    if (match && match.length > 0) {
      return new sequelizeErrors.ForeignKeyConstraintError({
        fields: null,
        index: match[1],
        parent: err
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
        parent: err
      });
    }

    return new sequelizeErrors.DatabaseError(err);
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
      primary: item.keyType === 'P' ? true : false,
      fields: item.fields,
      name: item.name,
      tableName: item.tableName,
      unique: item.keyType === 'U' ? true : false,
      type: item.type
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
