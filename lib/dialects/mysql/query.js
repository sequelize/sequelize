'use strict';

var Utils = require('../../utils')
  , AbstractQuery = require('../abstract/query')
  , uuid = require('node-uuid');

module.exports = (function() {
  var Query = function(client, sequelize, callee, options) {
    this.client = client;
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
    this.promise = new Utils.Promise(function(resolve, reject) {
      self.resolve = resolve;
      self.reject = reject;
    });
  };

  Utils.inherit(Query, AbstractQuery);
  Query.prototype.run = function(sql) {
    var self = this;
    this.sql = sql;

    if (this.options.logging !== false) {
      this.sequelize.log('Executing (' + this.options.uuid + '): ' + this.sql);
    }

    self.client.query(self.sql, function(err, results, fields) {
      self.promise.emit('sql', self.sql, self.options.uuid);

      if (err) {
        err.sql = sql;

        self.reject(err);
      } else {
        self.resolve(self.formatResults(results));
      }
    }).setMaxListeners(100);

    return this.promise;
  };

  return Query;
})();
