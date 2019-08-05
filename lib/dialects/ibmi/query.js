'use strict';

// const _ = require('lodash');
// const Utils = require('../../utils');
const Promise = require('../../promise');
const AbstractQuery = require('../abstract/query');
const parserStore = require('../parserStore')('ibmi');
// const QueryTypes = require('../../query-types');
const sequelizeErrors = require('../../errors');
const { logger } = require('../../utils/logger');

const debug = logger.debugContext('sql:ibmi');


class Query extends AbstractQuery {
  getInsertIdField() {
    return 'id';
  }

  static formatBindParameters(sql, values) {
    return [sql, values];
  }


  run(sql, parameters) {
    // console.log(sql);
    // console.log(parameters);
    this.sql = sql.replace(/;$/, '');
    return new Promise((resolve, reject) => {
      this.connection.query(this.sql, parameters, (error, results) => {
        this._logQuery(sql, debug);

        if (error) {
          const formattedError = this.formatError(error);
          reject(formattedError);
          return;
        }

        // parse the results to the format sequelize expects
        for (const result of results) {
          for (const column of results.columns) {
            const typeId = column.dataType;
            const parse = parserStore.get(typeId);
            const value = result[column.name];
            if (value !== null && parse) {
              result[column.name] = parse(value);
            }
          }
        }
        resolve(results);
      });
    })
      .then(results => this.formatResults(results));
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
   * @private
   */
  formatResults(data) {
    let result = this.instance;

    if (this.isInsertQuery(data)) {
      this.handleInsertQuery(data[0]);

      if (!this.instance) {
        // handle bulkCreate AI primiary key
        if (
          data.constructor.name === 'ResultSetHeader'
          && this.model
          && this.model.autoIncrementAttribute
          && this.model.autoIncrementAttribute === this.model.primaryKeyAttribute
          && this.model.rawAttributes[this.model.primaryKeyAttribute]
        ) {
          const startId = data[this.getInsertIdField()];
          result = [];
          for (let i = startId; i < startId + data.affectedRows; i++) {
            result.push({ [this.model.rawAttributes[this.model.primaryKeyAttribute].field]: i });
          }
        } else {
          result = data[this.getInsertIdField()];
        }
      }
    }

    if (this.isSelectQuery()) {
      return this.handleSelectQuery(data);
    }
    if (this.isShowTablesQuery()) {
      return this.handleShowTablesQuery(data);
    }
    if (this.isDescribeQuery()) {
      result = {};

      for (const _result of data) {
        const enumRegex = /^enum/i;
        result[_result.Field] = {
          type: enumRegex.test(_result.Type) ? _result.Type.replace(enumRegex, 'ENUM') : _result.Type.toUpperCase(),
          allowNull: _result.Null === 'YES',
          defaultValue: _result.Default,
          primaryKey: _result.Key === 'PRI',
          autoIncrement: Object.prototype.hasOwnProperty.call(_result, 'Extra') && _result.Extra.toLowerCase() === 'auto_increment',
          comment: _result.Comment ? _result.Comment : null
        };
      }
      return result;
    }
    if (this.isCallQuery()) {
      return data[0];
    }
    if (this.isBulkUpdateQuery() || this.isBulkDeleteQuery() || this.isUpsertQuery()) {
      return data.count;
    }
    if (this.isVersionQuery()) {
      return data[0].version;
    }
    if (this.isForeignKeysQuery()) {
      return data;
    }
    if (this.isInsertQuery() || this.isUpdateQuery()) {
      return [result, data.count];
    }
    if (this.isShowConstraintsQuery()) {
      return data;
    }
    if (this.isRawQuery()) {
      // MySQL returns row data and metadata (affected rows etc) in a single object - let's standarize it, sorta
      return [data, data];
    }
    if (this.isShowIndexesQuery()) {
      return data;
    }

    return result;
  }

  handleInsertQuery(results, metaData) {
    if (this.instance) {
      // add the inserted row id to the instance
      const autoIncrementAttribute = this.model.autoIncrementAttribute;
      let id = null;

      id = id || results && results[autoIncrementAttribute];
      id = id || metaData && metaData[autoIncrementAttribute];

      this.instance[autoIncrementAttribute] = id;
    }
  }

  formatError(err) {

    const error = err.toString();

    if (error.includes('SQL0532') || error.includes('SQL0530') || error.includes('SQL0531')) {
      return new sequelizeErrors.ForeignKeyConstraintError({
        parent: err
      });
    }
    return new sequelizeErrors.UniqueConstraintError({
      parent: err
    });
    // if (error.includes('SQL0803')) {
    //   return new sequelizeErrors.UniqueConstraintError({
    //     parent: err
    //   });
    // }

    // return err;

    // switch (err.code) {
    //   case 'SQLITE_CONSTRAINT': {
    //     if (err.message.includes('FOREIGN KEY constraint failed')) {
    //       return new sequelizeErrors.ForeignKeyConstraintError({
    //         parent: err
    //       });
    //     }

    //     let fields = [];

    //     // Sqlite pre 2.2 behavior - Error: SQLITE_CONSTRAINT: columns x, y are not unique
    //     let match = err.message.match(/columns (.*?) are/);
    //     if (match !== null && match.length >= 2) {
    //       fields = match[1].split(', ');
    //     } else {

    //       // Sqlite post 2.2 behavior - Error: SQLITE_CONSTRAINT: UNIQUE constraint failed: table.x, table.y
    //       match = err.message.match(/UNIQUE constraint failed: (.*)/);
    //       if (match !== null && match.length >= 2) {
    //         fields = match[1].split(', ').map(columnWithTable => columnWithTable.split('.')[1]);
    //       }
    //     }

    //     const errors = [];
    //     let message = 'Validation error';

    //     for (const field of fields) {
    //       errors.push(new sequelizeErrors.ValidationErrorItem(
    //         this.getUniqueConstraintErrorMessage(field),
    //         'unique violation', // sequelizeErrors.ValidationErrorItem.Origins.DB,
    //         field,
    //         this.instance && this.instance[field],
    //         this.instance,
    //         'not_unique'
    //       ));
    //     }

    //     if (this.model) {
    //       _.forOwn(this.model.uniqueKeys, constraint => {
    //         if (_.isEqual(constraint.fields, fields) && !!constraint.msg) {
    //           message = constraint.msg;
    //           return false;
    //         }
    //       });
    //     }

    //     return new sequelizeErrors.UniqueConstraintError({ message, errors, parent: err, fields });
    //   }
    //   case 'SQLITE_BUSY':
    //     return new sequelizeErrors.TimeoutError(err);

    //   default:
    //     return new sequelizeErrors.DatabaseError(err);
    // }
  }
}

module.exports = Query;
module.exports.Query = Query;
module.exports.default = Query;
