'use strict';

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
        if (err.code) {
          switch (err.code) {
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
        } else {
          reject(new sequelizeErrors.ConnectionError(err));
        }

        return;
      }
	if (config.onConnect)
	    config.onConnect();
      if (config.pool.handleDisconnects) {
        // Connection to the MySQL server is usually
        // lost due to either server restart, or a
        // connnection idle timeout (the wait_timeout
        // server variable configures this)
        //
        // See [stackoverflow answer](http://stackoverflow.com/questions/20210522/nodejs-mysql-error-connection-lost-the-server-closed-the-connection)
        connection.on('error', function (err) {
          if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            // Remove it from read/write pool
            self.pool.destroy(connection);
          }
        });
      }
      resolve(connection);
    });

  }).tap(function (connection) {
    connection.query("SET time_zone = '" + self.sequelize.options.timezone + "'"); /* jshint ignore: line */
  });
};
ConnectionManager.prototype.disconnect = function(connection) {

  // Dont disconnect connections with an ended protocol
  // That wil trigger a connection error
  if (connection._protocol._ended) {
    return Promise.resolve();
  }

  return new Promise(function (resolve, reject) {
    connection.end(function(err) {
      if (err) return reject(new sequelizeErrors.ConnectionError(err));
      resolve();
    });
  });
};
ConnectionManager.prototype.validate = function(connection) {
  return connection && ['disconnected', 'protocol_error'].indexOf(connection.state) === -1;
};

module.exports = ConnectionManager;
