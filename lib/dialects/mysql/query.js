'use strict';

const Utils = require('../../utils');
const debug = Utils.getLogger().debugContext('sql:mysql');
const AbstractQuery = require('../abstract/query');
const uuid = require('uuid');
const sequelizeErrors = require('../../errors.js');
const _ = require('lodash');

class Query extends AbstractQuery {
  constructor(connection, sequelize, options) {
    super();
    this.connection = connection;
    this.instance = options.instance;
    this.model = options.model;
    this.sequelize = sequelize;
    this.uuid = uuid.v4();
    this.options = Utils._.extend({
      logging: console.log,
      plain: false,
      raw: false,
      showWarnings: false
    }, options || {});

    this.checkLoggingOption();
  }

  run(sql) {
    this.sql = sql;

    //do we need benchmark for this query execution
    const benchmark = this.sequelize.options.benchmark || this.options.benchmark;
    const showWarnings = this.sequelize.options.showWarnings || this.options.showWarnings;

    let queryBegin;
    if (benchmark) {
      queryBegin = Date.now();
    } else {
      this.sequelize.log('Executing (' + (this.connection.uuid || 'default') + '): ' + this.sql, this.options);
    }

    debug(`executing(${this.connection.uuid || 'default'}) : ${this.sql}`);

    return new Utils.Promise((resolve, reject) => {
      this.connection.query({ sql: this.sql }, (err, results) => {
        debug(`executed(${this.connection.uuid || 'default'}) : ${this.sql}`);

        if (benchmark) {
          this.sequelize.log('Executed (' + (this.connection.uuid || 'default') + '): ' + this.sql, Date.now() - queryBegin, this.options);
        }

        if (err) {
          err.sql = sql;

          reject(this.formatError(err));
        } else {
          resolve(results);
        }
      }).setMaxListeners(100);
    })
    // Log warnings if we've got them.
      .then(results => {
        if (showWarnings && results && results.warningStatus > 0) {
          return this.logWarnings(results);
        }
        return results;
      })
    // Return formatted results...
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
      this.handleInsertQuery(data);

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
      result = this.handleSelectQuery(data);
    } else if (this.isShowTablesQuery()) {
      result = this.handleShowTablesQuery(data);
    } else if (this.isDescribeQuery()) {
      result = {};

      for (const _result of data) {
        const enumRegex = /^enum/i;
        result[_result.Field] = {
          type: enumRegex.test(_result.Type) ? _result.Type.replace(enumRegex, 'ENUM') : _result.Type.toUpperCase(),
          allowNull: _result.Null === 'YES',
          defaultValue: _result.Default,
          primaryKey: _result.Key === 'PRI'
        };
      }
    } else if (this.isShowIndexesQuery()) {
      result = this.handleShowIndexesQuery(data);

    } else if (this.isCallQuery()) {
      result = data[0];
    } else if (this.isBulkUpdateQuery() || this.isBulkDeleteQuery() || this.isUpsertQuery()) {
      result = data.affectedRows;
    } else if (this.isVersionQuery()) {
      result = data[0].version;
    } else if (this.isForeignKeysQuery()) {
      result = data;
    } else if (this.isInsertQuery() || this.isUpdateQuery()) {
      result = [result, data.affectedRows];
    } else if (this.isShowConstraintsQuery()) {
      result = data;
    } else if (this.isRawQuery()) {
      // MySQL returns row data and metadata (affected rows etc) in a single object - let's standarize it, sorta
      result = [data, data];
    }

    return result;
  }

  logWarnings(results) {
    return this.run('SHOW WARNINGS').then(warningResults => {
      const warningMessage = 'MySQL Warnings (' + (this.connection.uuid||'default') + '): ';
      const messages = [];
      for (const _warningRow of warningResults) {
        for (const _warningResult of _warningRow) {
          if (_warningResult.hasOwnProperty('Message')) {
            messages.push(_warningResult.Message);
          } else {
            for (const _objectKey of _warningResult.keys()) {
              messages.push([_objectKey, _warningResult[_objectKey]].join(': '));
            }
          }
        }
      }

      this.sequelize.log(warningMessage + messages.join('; '), this.options);

      return results;
    });
  }

  formatError(err) {
    switch (err.errno || err.code) {
      case 1062: {
        const match = err.message.match(/Duplicate entry '(.*)' for key '?((.|\s)*?)'?$/);

        let fields = {};
        let message = 'Validation error';
        const values = match ? match[1].split('-') : undefined;
        const uniqueKey = this.model && this.model.uniqueKeys[match[2]];

        if (uniqueKey) {
          if (uniqueKey.msg) message = uniqueKey.msg;
          fields = Utils._.zipObject(uniqueKey.fields, values);
        } else {
          fields[match[2]] = match[1];
        }

        const errors = [];
        Utils._.forOwn(fields, (value, field) => {
          errors.push(new sequelizeErrors.ValidationErrorItem(
            this.getUniqueConstraintErrorMessage(field),
            'unique violation', field, value
          ));
        });

        return new sequelizeErrors.UniqueConstraintError({message, errors, parent: err, fields});
      }
      case 1451: {
        const match = err.message.match(/FOREIGN KEY \(`(.*)`\) REFERENCES `(.*)` \(`(.*)`\)(?: ON .*)?\)$/);

        return new sequelizeErrors.ForeignKeyConstraintError({
          fields: null,
          index: match ? match[3] : undefined,
          parent: err
        });
      }
      case 1452: {
        const match = err.message.match(/FOREIGN KEY \(`(.*)`\) REFERENCES `(.*)` \(`(.*)`\)(.*)\)$/);

        return new sequelizeErrors.ForeignKeyConstraintError({
          fields: null,
          index: match ? match[1] : undefined,
          parent: err
        });
      }
      default:
        return new sequelizeErrors.DatabaseError(err);
    }
  }

  handleShowIndexesQuery(data) {
    // Group by index name, and collect all fields
    data = _.reduce(data, (acc, item) => {
      if (!(item.Key_name in acc)) {
        acc[item.Key_name] = item;
        item.fields = [];
      }

      acc[item.Key_name].fields[item.Seq_in_index - 1] = {
        attribute: item.Column_name,
        length: item.Sub_part || undefined,
        order: item.Collation === 'A' ? 'ASC' : undefined
      };
      delete item.column_name;

      return acc;
    }, {});

    return Utils._.map(data, item => ({
      primary: item.Key_name === 'PRIMARY',
      fields: item.fields,
      name: item.Key_name,
      tableName: item.Table,
      unique: item.Non_unique !== 1,
      type: item.Index_type
    }));
  }
}

module.exports = Query;
module.exports.Query = Query;
module.exports.default = Query;
