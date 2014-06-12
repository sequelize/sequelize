"use strict";
var ConnectionManager
  , Promise = require('../../promise');

ConnectionManager = function(dialect, sequelize) {
  this.sequelize = sequelize;

  try {
    this.lib = require(sequelize.config.dialectModulePath || 'sqlite3').verbose();
  } catch (err) {
    throw new Error('Please install mariasql package manually');
  }
};

ConnectionManager.prototype.connect = function(config) {
  var self = this;
  return new Promise(function (resolve, reject) {
    var connection = new self.lib.Database(self.sequelize.options.storage || ':memory:', function(err) {
      if (err) {
        if (err.code === 'SQLITE_CANTOPEN') return reject('Failed to find SQL server. Please double check your settings.');
        return reject(err);
      }
      resolve(connection);
    });
  }).tap(function (connection) {
    if (self.sequelize.options.foreignKeys !== false) {
      // Make it possible to define and use foreign key constraints unless
      // explicitly disallowed. It's still opt-in per relation
      connection.run('PRAGMA FOREIGN_KEYS=ON');
    }
  });
};
ConnectionManager.prototype.disconnect = function(connection) {
  return new Promise(function (resolve, reject) {
    connection.close(function (err) {
      if (err) return reject(err);
      resolve();
    });
  });
};

module.exports = ConnectionManager;