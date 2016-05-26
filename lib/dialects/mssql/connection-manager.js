'use strict';

var AbstractConnectionManager = require('../abstract/connection-manager')
  , ConnectionManager
  , ResourceLock = require('./resource-lock')
  , Utils = require('../../utils')
  , Promise = require('../../promise')
  , sequelizeErrors = require('../../errors')
  , parserStore = require('../parserStore')('mssql')
  , _ = require('lodash');

ConnectionManager = function(dialect, sequelize) {
  AbstractConnectionManager.call(this, dialect, sequelize);

  this.sequelize = sequelize;
  this.sequelize.config.port = this.sequelize.config.port || 1433;
  try {
    this.lib = require(sequelize.config.dialectModulePath || 'tedious');
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      throw new Error('Please install tedious package manually');
    }
    throw err;
  }
};

Utils._.extend(ConnectionManager.prototype, AbstractConnectionManager.prototype);


// Expose this as a method so that the parsing may be updated when the user has added additional, custom types
ConnectionManager.prototype.$refreshTypeParser = function (dataType) {
  parserStore.refresh(dataType);
};

ConnectionManager.prototype.$clearTypeParser = function () {
  parserStore.clear();
};

ConnectionManager.prototype.connect = function(config) {
  var self = this;
  return new Promise(function (resolve, reject) {
    var connectionConfig = {
      userName: config.username,
      password: config.password,
      server: config.host,
      options: {
        port: config.port,
        database: config.database
      }
    };

    if (config.dialectOptions) {
      // only set port if no instance name was provided
      if (config.dialectOptions.instanceName) {
        delete connectionConfig.options.port;
      }

      // The 'tedious' driver needs domain property to be in the main Connection config object
      if(config.dialectOptions.domain) {
        connectionConfig.domain = config.dialectOptions.domain;
      }

      Object.keys(config.dialectOptions).forEach(function(key) {
        connectionConfig.options[key] = config.dialectOptions[key];
      });
    }

    var connection = new self.lib.Connection(connectionConfig)
      , connectionLock = new ResourceLock(connection);
    connection.lib = self.lib;

    connection.on('connect', function(err) {
      if (!err) {
        resolve(connectionLock);
        return;
      }

      if (!err.code) {
        reject(new sequelizeErrors.ConnectionError(err));
        return;
      }

      switch (err.code) {
      case 'ESOCKET':
        if (_.includes(err.message, 'connect EHOSTUNREACH')) {
          reject(new sequelizeErrors.HostNotReachableError(err));
        } else if (_.includes(err.message, 'connect ECONNREFUSED')) {
          reject(new sequelizeErrors.ConnectionRefusedError(err));
        } else {
          reject(new sequelizeErrors.ConnectionError(err));
        }
        break;
      case 'ECONNREFUSED':
        reject(new sequelizeErrors.ConnectionRefusedError(err));
        break;
      case 'ER_ACCESS_DENIED_ERROR':
        reject(new sequelizeErrors.AccessDeniedError(err));
        break;
      case 'ENOTFOUND':
        reject(new sequelizeErrors.HostNotFoundError(err));
        break;
      case 'EHOSTUNREACH':
        reject(new sequelizeErrors.HostNotReachableError(err));
        break;
      case 'EINVAL':
        reject(new sequelizeErrors.InvalidConnectionError(err));
        break;
      default:
        reject(new sequelizeErrors.ConnectionError(err));
        break;
      }
    });

    if (config.pool.handleDisconnects) {
      connection.on('error', function (err) {
        switch (err.code) {
        case 'ESOCKET':
        case 'ECONNRESET':
          self.pool.destroy(connectionLock);
        }
      });
    }

  });
};

ConnectionManager.prototype.disconnect = function(connectionLock) {
  var connection = connectionLock.unwrap();

  // Dont disconnect a connection that is already disconnected
  if (!!connection.closed) {
    return Promise.resolve();
  }

  return new Promise(function (resolve, reject) {
    connection.on('end', resolve);
    connection.close();
  });
};

ConnectionManager.prototype.validate = function(connectionLock) {
  var connection = connectionLock.unwrap();

  return connection && connection.loggedIn;
};

module.exports = ConnectionManager;
