"use strict";
var AbstractConnectionManager = require('../abstract/connection-manager')
  , ConnectionManager
  , Utils = require('../../utils')
  , Promise = require('../../promise');

ConnectionManager = function(dialect, sequelize) {
  this.sequelize = sequelize;
  this.config = sequelize.config;
  this.dialect = dialect;
  this.connection = null;

  try {
    this.lib = require(sequelize.config.dialectModulePath || 'sqlite3').verbose();
  } catch (err) {
    throw new Error('Please install mariasql package manually');
  }
};

Utils._.extend(ConnectionManager.prototype, AbstractConnectionManager.prototype);

ConnectionManager.prototype.getConnection = function(options) {
  var self = this;
  
  if (self.connection) return Promise.resolve(self.connection);

  return new Promise(function (resolve, reject) {
    self.connection = new self.lib.Database(self.sequelize.options.storage || ':memory:', function(err) {
      if (err) {
        if (err.code === 'SQLITE_CANTOPEN') return reject('Failed to find SQL server. Please double check your settings.');
        return reject(err);
      }
      resolve(self.connection);
    });
  }).tap(function (connection) {
    if (self.sequelize.options.foreignKeys !== false) {
      // Make it possible to define and use foreign key constraints unless
      // explicitly disallowed. It's still opt-in per relation
      connection.run('PRAGMA FOREIGN_KEYS=ON');
    }
  });
};

ConnectionManager.prototype.releaseConnection = function(connection) {
  // no-op
};

module.exports = ConnectionManager;