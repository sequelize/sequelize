'use strict';

var Utils = require('../../utils')
  , AbstractQuery = require('../abstract/query');

var Query = function(connection, sequelize, options) {
  this.connection = connection;
  this.instance = options.instance;
  this.model = options.model;
  this.sequelize = sequelize;
  this.options = Utils._.extend({
    logging: console.log,
    plain: false,
    raw: false
  }, options || {});

  this.checkLoggingOption();
};

Utils.inherit(Query, AbstractQuery);

Query.prototype.run = function(sql) {
  var self = this;
  this.sql = sql;

  var promise = new Utils.Promise(function(resolve, reject) {
    // TRANSACTION SUPPORT - TODO !!!
    if (Utils._.contains(self.sql, 'BEGIN TRANSACTION')) {
      self.connection.beginTransaction(function(err) {
        if (!!err) {
          reject(self.formatError(err));
        } else {
          resolve(self.formatResults());
        }
      });
    } else if (Utils._.contains(self.sql, 'COMMIT TRANSACTION')) {
      self.connection.commitTransaction(function(err) {
        if (!!err) {
          reject(self.formatError(err));
        } else {
          resolve(self.formatResults());
        }
      });
    } else if (Utils._.contains(self.sql, 'ROLLBACK TRANSACTION')) {
      self.connection.rollbackTransaction(function(err) {
        if (!!err) {
          reject(self.formatError(err));
        } else {
          resolve(self.formatResults());
        }
      });
    } else {
      // QUERY SUPPORT
      self.connection.execute(self.sql, function(err, result) {
        if (err) {
          err.sql = sql;
          console.log('Executed: ' + sql);
          console.log('Got error: ' + err);
          reject(self.formatError(err));
        } else {
          resolve(self.formatResults(result));
        }
      });
      
    }
  });
  
  return promise;
};

module.exports = Query;
