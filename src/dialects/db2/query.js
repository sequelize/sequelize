'use strict';

const util = require('util');

const AbstractQuery = require('../abstract/query');
const sequelizeErrors = require('../../errors');
const parserStore = require('../parserStore')('db2');
const _ = require('lodash');
const { logger } = require('../../utils/logger');
const moment = require('moment');
const debug = logger.debugContext('sql:db2');

class Query extends AbstractQuery {
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
    this.sql = sql;
    const benchmark = this.sequelize.options.benchmark || this.options.benchmark;
    let queryBegin;
    if (benchmark) {
      queryBegin = Date.now();
    } else {
      this.sequelize.log(`Executing (${ this.connection.uuid || 'default' }): ${ this.sql}`, this.options);
    }

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
        if ((this.isSelectQuery() || _.startsWith(SQL, 'SELECT ')) &&
            SQL.indexOf(' FROM ', 8) === -1 ) {
          if (this.sql.charAt(this.sql.length - 1) === ';') {
            newSql = this.sql.slice(0, this.sql.length - 1);
          }
          newSql += ' FROM SYSIBM.SYSDUMMY1;';
        }

        connection.prepare(newSql, (err, stmt) => {
          if (err) {
            reject(this.formatError(err, errStack));
          }

          stmt.execute(params, (err, result, outparams) => {
            debug(`executed(${this.connection.uuid || 'default'}):${newSql} ${parameters ? util.inspect(parameters, { compact: true, breakLength: Infinity }) : ''}`);

            if (benchmark) {
              this.sequelize.log(`Executed (${this.connection.uuid || 'default'}): ${newSql} ${parameters ? util.inspect(parameters, { compact: true, breakLength: Infinity }) : ''}`, Date.now() - queryBegin, this.options);
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
                for (let i = 0; i < metadata.length; i++) {
                  coltypes[metadata[i].SQL_DESC_NAME] =
                      metadata[i].SQL_DESC_TYPE_NAME;
                }
                for (let i = 0; i < datalen; i++) {
                  for (const column in data[i]) {
                    const parse = parserStore.get(coltypes[column]);
                    const value = data[i][column];
                    if (value !== null) {
                      if (parse) {
                        data[i][column] = parse(value);
                      } else if (coltypes[column] === 'TIMESTAMP') {
                        data[i][column] = new Date(moment.utc(value));
                      } else if (coltypes[column] === 'BLOB') {
                        data[i][column] = new Buffer.from(value);
                      } else if (coltypes[column].indexOf('FOR BIT DATA') > 0) {
                        data[i][column] = new Buffer.from(value, 'hex');
                      }
                    }
                  }
                }
                if (outparams && outparams.length) {
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

  static formatBindParameters(sql, values, dialect) {
    let bindParam = {};
    const replacementFunc = (match, key, values) => {
      if (values[key] !== undefined) {
        bindParam[key] = values[key];
        return '?';
      }
      return undefined;
    };
    sql = AbstractQuery.formatBindParameters(sql, values, dialect, replacementFunc)[0];
    if (Array.isArray(values) && typeof values[0] === 'object') {
      bindParam = values;
    }

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
      result = data;
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

  formatError(err, errStack, conn, parameters) {
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

      return new sequelizeErrors.UniqueConstraintError({ message, errors, parent: err, fields, stack: errStack });
    }

    match = err.message.match(/SQL0532N {2}A parent row cannot be deleted because the relationship "(.*)" restricts the deletion/) ||
      err.message.match(/SQL0530N/) ||
      err.message.match(/SQL0531N/);
    if (match && match.length > 0) {
      return new sequelizeErrors.ForeignKeyConstraintError({
        fields: null,
        index: match[1],
        parent: err,
        stack: errStack
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
        parent: err,
        stack: errStack
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

    result = result || this.sql.toLowerCase().startsWith("select c.column_name as 'name', c.data_type as 'type', c.is_nullable as 'isnull'");
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
    data.forEach(item => {
      if (!currItem || currItem.name !== item.Key_name) {
        currItem = {
          primary: item.keyType === 'P',
          fields: [],
          name: item.name,
          tableName: item.tableName,
          unique: item.keyType === 'U',
          type: item.type
        };

        _.forEach(item.COLNAMES.replace(/\+|-/g, x => { return ` ${ x}`; }).split(' '), column => {
          let columnName = column.trim();
          if ( columnName ) {
            columnName = columnName.replace(/\+|-/, '');
            currItem.fields.push({
              attribute: columnName,
              length: undefined,
              order: column.indexOf('-') === -1 ? 'ASC' : 'DESC',
              collate: undefined
            });
          }
        });
        result.push(currItem);
      }
    });
    return result;
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
    }
  }
}

module.exports = Query;
module.exports.Query = Query;
module.exports.default = Query;
