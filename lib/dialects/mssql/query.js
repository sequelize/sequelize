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
      //console.log(self.sql);

      self
        .connection
        .lib
        .execute(self.connection.config, { query: self.sql })
        .then(
          function (data) { resolve(data.result); },
          function (err) { reject(err); }
        );
    });

    return promise;
  };

  return Query;
})();
