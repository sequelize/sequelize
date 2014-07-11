"use strict";
var AbstractConnectionManager = require('../abstract/connection-manager')
  , ConnectionManager
  , Utils = require('../../utils')
  , Promise = require('../../promise');

ConnectionManager = function(dialect, sequelize) {
  AbstractConnectionManager.call(this, dialect, sequelize);

  this.sequelize = sequelize;
  this.sequelize.config.port = this.sequelize.config.port || 5432;
  try {
    this.lib = sequelize.config.native ? require(sequelize.config.dialectModulePath || 'pg').native : require(sequelize.config.dialectModulePath || 'pg');
  } catch (err) {
    throw new Error('Please install postgres package manually');
  }
};

Utils._.extend(ConnectionManager.prototype, AbstractConnectionManager.prototype);

ConnectionManager.prototype.connect = function(config) {
  var self = this;

  return new Promise(function (resolve, reject) {
    var connectionString = self.sequelize.getQueryInterface().QueryGenerator.databaseConnectionUri(config)
      , connection = new self.lib.Client(connectionString)
      , responded = false;

    connection.connect(function(err) {
      if (err) {
        if (err.code) {
          switch (err.code) {
          case 'ECONNREFUSED':
            reject(new Error('Failed to authenticate for PostgresSQL. Please double check your settings.'));
            break;
          case 'ENOTFOUND':
          case 'EHOSTUNREACH':
          case 'EINVAL':
            reject(new Error('Failed to find PostgresSQL server. Please double check your settings.'));
            break;
          default:
            reject(err);
            break;
          }
        } else {
          reject(new Error(err.message));
        }
        return;
      }
      responded = true;
      resolve(connection);
    });

    // If we didn't ever hear from the client.connect() callback the connection timeout, node-postgres does not treat this as an error since no active query was ever emitted
    connection.on('end', function () {
      if (!responded) {
        reject(new Error('Connection timed out'));
      }
    });
  }).tap(function (connection) {
    if (self.sequelize.config.keepDefaultTimezone) return;
    return new Promise(function (resolve, reject) {
      connection.query("SET TIME ZONE INTERVAL '" + self.sequelize.options.timezone + "' HOUR TO MINUTE").on('error', function (err) {
        reject(err);
      }).on('end', function () {
        resolve();
      });
    });
  });
};
ConnectionManager.prototype.disconnect = function(connection) {
  return new Promise(function (resolve, reject) {
    connection.end();
    resolve();
  });
};

module.exports = ConnectionManager;
