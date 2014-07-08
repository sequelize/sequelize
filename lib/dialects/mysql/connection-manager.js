"use strict";
var AbstractConnectionManager = require('../abstract/connection-manager')
  , ConnectionManager
  , Utils = require('../../utils')
  , Promise = require('../../promise');

ConnectionManager = function(dialect, sequelize) {
  AbstractConnectionManager.call(this, dialect, sequelize);

  this.sequelize = sequelize;
  this.sequelize.config.port = this.sequelize.config.port || 3306;
  try {
    this.lib = require(sequelize.config.dialectModulePath || 'mysql');
  } catch (err) {
    throw new Error('Please install mysql package manually');
  }
};

Utils._.extend(ConnectionManager.prototype, AbstractConnectionManager.prototype);

ConnectionManager.prototype.connect = function(config) {
  var self = this;
  return new Promise(function (resolve, reject) {
    var connectionConfig = {
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database,
      timezone: self.sequelize.options.timezone
    };

    if (config.dialectOptions) {
      Object.keys(config.dialectOptions).forEach(function(key) {
        connectionConfig[key] = config.dialectOptions[key];
      });
    }

    var connection = self.lib.createConnection(connectionConfig);

    connection.connect(function(err) {
      if (err) {
        switch (err.code) {
        case 'ECONNREFUSED':
        case 'ER_ACCESS_D2ENIED_ERROR':
          reject('Failed to authenticate for MySQL. Please double check your settings.');
          break;
        case 'ENOTFOUND':
        case 'EHOSTUNREACH':
        case 'EINVAL':
          reject('Failed to find MySQL server. Please double check your settings.');
          break;
        default:
          reject(err);
          break;
        }

        return;
      }

      resolve(connection);
    });

  }).tap(function (connection) {
    connection.query("SET time_zone = '" + self.sequelize.options.timezone + "'");
  });
};
ConnectionManager.prototype.disconnect = function(connection) {
  return new Promise(function (resolve, reject) {
    connection.end(function(err) {
      if (err) return reject(err);
      resolve();
    });
  });
};
ConnectionManager.prototype.validate = function(connection) {
  return connection && connection.state !== 'disconnected';
};

module.exports = ConnectionManager;
