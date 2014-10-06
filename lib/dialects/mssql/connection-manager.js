"use strict";
var AbstractConnectionManager = require('../abstract/connection-manager')
  , Pooling = require('generic-pool')
  , ConnectionManager
  , Utils = require('../../utils')
  , Promise = require('../../promise');

ConnectionManager = function(dialect, sequelize) {
  AbstractConnectionManager.call(this, dialect, sequelize);

  this.sequelize = sequelize;
  this.sequelize.config.port = this.sequelize.config.port || 1433;
  this.connection = null;

  try {
    this.lib = require(sequelize.config.dialectModulePath || 'mssql');
  } catch (err) {
    throw new Error('Please install mssql package');
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

    if(!self.connection){
      config = {
        user: connectionConfig.user,
        password: connectionConfig.password,
        server: connectionConfig.host,
        database: connectionConfig.database,
        pool: {
          max: config.max,
          min: config.min,
          idleTimeoutMillis: config.idle
        }
      };
      self.connection = {
        config: config,
        lib: self.lib
      };

      self.lib._transaction = null;
      var conn = new self.lib.Connection(config, function(err) {
        if (err) {
          reject(err);
          return;
        }

        self.connection.context = conn;
        resolve(self.connection);
      });
    }else{
      resolve(self.connection);
    }
  });
};
ConnectionManager.prototype.getConnection = function(options) {
  var self = this;
  options = options || {};
  //TODO: dialect check
  return new Promise(function (resolve, reject) {
    resolve(self.$connect(self.config));
  });
};
ConnectionManager.prototype.releaseConnection = function(connection) {
  var self = this;

  return new Promise(function (resolve, reject) {
    //self.pool.release(connection);
    resolve();
  });
};
ConnectionManager.prototype.disconnect = function(connection) {
  return new Promise(function (resolve, reject) {
    resolve();
  });
};
ConnectionManager.prototype.validate = function(connection) {
  // console.log('add code for validations here', connection);
  return true;
};

module.exports = ConnectionManager;
