"use strict";
var AbstractConnectionManager = require('../abstract/connection-manager')
  , ConnectionManager
  , Utils = require('../../utils')
  , Promise = require('../../promise')
  , sequelizeErrors = require('../../errors');

ConnectionManager = function(dialect, sequelize) {
  AbstractConnectionManager.call(this, dialect, sequelize);

  this.sequelize = sequelize;
  this.sequelize.config.port = this.sequelize.config.port || 3306;
  try {
    this.lib = require(sequelize.config.dialectModulePath || 'mariasql');
  } catch (err) {
    throw new Error('Please install mariasql package manually');
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
      db: config.database,
      metadata: true
    };

    if (config.dialectOptions) {
      Object.keys(config.dialectOptions).forEach(function(key) {
        connectionConfig[key] = config.dialectOptions[key];
      });
    }

    if (connectionConfig.unixSocket) {
      delete connectionConfig.host;
      delete connectionConfig.port;
    }

    var connection = new self.lib();
    connection.connect(connectionConfig);
    connection.on('error', function(err) {
      return reject(new sequelizeErrors.ConnectionError(err));
    });
    connection.on('connect', function() {
      return resolve(connection);
    });

  }).tap(function (connection) {
    connection.query("SET time_zone = '" + self.sequelize.options.timezone + "'");
  });
};
ConnectionManager.prototype.disconnect = function(connection) {
  return new Promise(function (resolve, reject) {
    connection.end();
    resolve();
  });
};
ConnectionManager.prototype.validate = function(connection) {
  return connection && connection.state !== 'disconnected';
};

module.exports = ConnectionManager;
