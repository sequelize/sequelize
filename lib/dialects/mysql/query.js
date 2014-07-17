'use strict';

var Utils = require('../../utils')
  , AbstractQuery = require('../abstract/query')
  , uuid = require('node-uuid');

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

    if (this.options.logging !== false) {
      this.sequelize.log('Executing (' + this.connection.uuid + '): ' + this.sql);
    }

    var promise = new Utils.Promise(function(resolve, reject) {
      self.connection.query(self.sql, function(err, results, fields) {
        promise.emit('sql', self.sql, self.connection.uuid);

        if (err) {
          err.sql = sql;
          reject(err);
        } else {
          resolve(self.formatResults(results));
        }
      }).setMaxListeners(100);

    });

    return promise;
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
        order: item.Collation === 'A' ? 'ASC' : null
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
