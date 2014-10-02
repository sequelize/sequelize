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
    throw new Error('Please install mssql package');
  }
};

Utils._.extend(ConnectionManager.prototype, AbstractConnectionManager.prototype);

ConnectionManager.prototype.connect = function(config, isTransaction) {
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
    var connection = {
      config: config,
      lib: self.lib
    };

    var conn;
    self.lib._transaction = null;

    if (isTransaction) {
      conn = new self.lib.Connection(config, function (err){
        var trans = new self.lib.Transaction(conn);

        self.lib._transaction = trans;
        trans.begin(function(err) {
          if (err) {
            reject(err);
            return;
          }
          connection.context = conn;
          //connection.transaction = trans;
          resolve(connection);
        });
      });
    } else {
      conn = new self.lib.Connection(config, function(err) {
        // var request = new self.lib.Request();
        // request.query('select 1 as number', function(err, recordset) {
        //   console.log('err2', err);
        //   console.log(recordset);
        // });

        if (err) {
          reject(err);
          return;
        }

        connection.context = conn;
        resolve(connection);
      });
    }

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
