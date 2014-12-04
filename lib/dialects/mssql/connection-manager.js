"use strict";

var AbstractConnectionManager = require('../abstract/connection-manager')
  , ConnectionManager
  , Utils = require('../../utils')
  , Promise = require('../../promise');

ConnectionManager = function(dialect, sequelize) {
  AbstractConnectionManager.call(this, dialect, sequelize);

  this.sequelize = sequelize;
  this.sequelize.config.port = this.sequelize.config.port || 1433;
  try {
    this.lib = require(sequelize.config.dialectModulePath || 'tedious');
  } catch (err) {
    throw new Error('Please install tedious package manually');
  }
};

Utils._.extend(ConnectionManager.prototype, AbstractConnectionManager.prototype);

ConnectionManager.prototype.connect = function(config) {
  var self = this;
  return new Promise(function (resolve, reject) {
    var connectionConfig = {
      userName: config.username,
      password: config.password,
      server: config.host,
      /* domain: 'DOMAIN' */
      options: {
        port: config.port,
        database: config.database,
      }
    };

    if (config.dialectOptions) {
      Object.keys(config.dialectOptions).forEach(function(key) {
        connectionConfig[key] = config.dialectOptions[key];
      });
    }

    var connection = new self.lib.Connection(connectionConfig);
    connection.lib = self.lib;

    connection.on('connect', function(err) {
      if (err) {
        reject(err);
        return;
      }

      resolve(connection);
    });
  });
};

ConnectionManager.prototype.disconnect = function(connection) {
  // Dont disconnect a connection that is already disconnected
  if (!connection.connected) {
    return Promise.resolve();
  }

  return new Promise(function (resolve, reject) {
    connection.on('error', function(err) {
      // TODO: error checking
      reject();
    });

    connection.on('end', resolve);
    connection.close();
  });
};

ConnectionManager.prototype.validate = function(connection) {
  return connection && connection.loggedIn;
};

module.exports = ConnectionManager;
