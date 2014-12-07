'use strict';

var Utils = require('../../utils')
  , AbstractQuery = require('../abstract/query')
  , uuid = require('node-uuid')
  , sequelizeErrors = require('../../errors.js');

module.exports = (function() {
  var Query = function(connection, sequelize, callee, options) {
    this.connection = connection;
    this.callee = callee;
    this.sequelize = sequelize;
    this.uuid = uuid.v4();
    this.options = Utils._.extend({
      logging: console.log,
      plain: false,
      raw: false
    }, options || {});

    var self = this;
    this.checkLoggingOption();
  };

  Utils.inherit(Query, AbstractQuery);
  Query.prototype.run = function(sql) {
    var self = this;
    this.sql = sql;

    this.sequelize.log('Executing (' + (this.connection.uuid || 'default') + '): ' + this.sql, this.options);

    var promise = new Utils.Promise(function(resolve, reject) {
      self.connection.query(self.sql, function(err, results, fields) {
        promise.emit('sql', self.sql, self.connection.uuid);

        if (err) {
          err.sql = sql;

          reject(self.formatError(err));
        } else {
          resolve(self.formatResults(results));
        }
      }).setMaxListeners(100);

    });

    return promise;
  };

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
   */
  Query.prototype.formatResults = function(data) {
    var result = this.callee;

    if (this.isInsertQuery(data)) {
      this.handleInsertQuery(data);

      if (!this.callee) {
        result = data[this.getInsertIdField()];
      }
    }

    if (this.isSelectQuery()) {
      result = this.handleSelectQuery(data);
    } else if (this.isShowTableQuery()) {
      result = this.handleShowTableQuery(data);
    } else if (this.isShowOrDescribeQuery()) {
      result = data;

      if (this.sql.toLowerCase().indexOf('describe') === 0) {
        result = {};

        data.forEach(function(_result) {
          result[_result.Field] = {
            type: _result.Type.toUpperCase(),
            allowNull: (_result.Null === 'YES'),
            defaultValue: _result.Default
          };
        });
      } else if (this.isShowIndexesQuery()) {
        result = this.handleShowIndexesQuery(data);
      }
    } else if (this.isCallQuery()) {
      result = data[0];
    } else if (this.isBulkUpdateQuery() || this.isBulkDeleteQuery() || this.isUpsertQuery()) {
      result = data.affectedRows;
    } else if (this.isVersionQuery()) {
      result = data[0].version;
    }

    return result;
  };


  Query.prototype.formatError = function (err) {
    var match;

    switch (err.errno || err.code) {
      case 1062:
        match = err.message.match(/Duplicate entry '(.*)' for key '?(.*?)'?$/);

        return new sequelizeErrors.UniqueConstraintError({
          fields: null,
          index: match[2],
          value: match[1],
          parent: err
        });

      case 1451:
        match = err.message.match(/FOREIGN KEY \(`(.*)`\) REFERENCES `(.*)` \(`(.*)`\)(?: ON .*)?\)$/);

        return new sequelizeErrors.ForeignKeyConstraintError({
          fields: null,
          index: match[3],
          parent: err
        });

      case 1452:
        match = err.message.match(/FOREIGN KEY \(`(.*)`\) REFERENCES `(.*)` \(`(.*)`\)(.*)\)$/);

        return new sequelizeErrors.ForeignKeyConstraintError({
          fields: null,
          index: match[1],
          parent: err
        });

      default:
        return new sequelizeErrors.DatabaseError(err);
    }
  };

  Query.prototype.isShowIndexesQuery = function () {
    return this.sql.toLowerCase().indexOf('show index from') === 0;
  };

  Query.prototype.handleShowIndexesQuery = function (data) {
    // Group by index name, and collect all fields
    data = Utils._.foldl(data, function (acc, item) {
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

    return Utils._.map(data, function(item) {
      return {
        primary: item.Key_name === 'PRIMARY',
        fields: item.fields,
        name: item.Key_name,
        tableName: item.Table,
        unique: (item.Non_unique !== 1),
        type: item.Index_type,
      };
    });
  };

  return Query;
})();
