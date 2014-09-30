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
    this.lib = require(sequelize.config.dialectModulePath || 'mssql');
  } catch (err) {
    throw new Error('Please install seriate package manually');
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
    config = {
      user: connectionConfig.user,
      password: connectionConfig.password,
      server: connectionConfig.host,
      database: connectionConfig.database
    };
    self.lib.connect(config, function(err) {
      // var request = new self.lib.Request();
      // request.query('select 1 as number', function(err, recordset) {
      //   console.log('err2', err);
      //   console.log(recordset);
      // });
    });
    // var connection = {
    //   config: {
    //     user: connectionConfig.user,
    //     password: connectionConfig.password,
    //     server: connectionConfig.host,
    //     database: connectionConfig.database
    //   },       
    // };
   //connection = self.lib;
    // connection.lib = self.lib.getPlainContext(connection.config);
    resolve(self.lib);
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
