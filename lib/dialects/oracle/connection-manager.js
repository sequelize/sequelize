'use strict';

var AbstractConnectionManager = require('../abstract/connection-manager')
  , ConnectionManager
  , Utils = require('../../utils')
  , Promise = require('../../promise')
  , sequelizeErrors = require('../../errors');

ConnectionManager = function(dialect, sequelize) {
  AbstractConnectionManager.call(this, dialect, sequelize);

  this.sequelize = sequelize;
  this.sequelize.config.port = this.sequelize.config.port || 1521;
  try {
    this.lib = require(sequelize.config.dialectModulePath || 'oracledb');
  } catch (err) {
    throw new Error('Please install oracledb package manually');
  }
};

Utils._.extend(ConnectionManager.prototype, AbstractConnectionManager.prototype);

ConnectionManager.prototype.connect = function(config) {
  var self = this;
  return new Promise(function (resolve, reject) {
    var connectionConfig = {
      user: config.username,
      password: config.password
    };

    if(config.database && config.database.indexOf('DESCRIPTION=')>=0){
      connectionConfig.connectString=config.database;
    }else{
      connectionConfig.connectString='//'+config.host+':'+config.port+'/'+config.database;
    }

    // if(config.pool){
    //     connectionConfig.poolMax= config.pool.maxConnections ;
    //     connectionConfig.poolMin=config.pool.minConnections ;
    //     connectionConfig.poolTimeout=config.pool.maxIdleTime ;
    // } 

    // if (config.dialectOptions) {
    //   Object.keys(config.dialectOptions).forEach(function(key) {
    //     connectionConfig[key] = config.dialectOptions[key];
    //   });
    // }

    /**
    * We use directly getConnection because the Pool is manage by generic-pool in the abstract ConnectionManager
    */
    self.lib.getConnection(connectionConfig, function(err, connection){
      if (err) {
        reject(new sequelizeErrors.ConnectionError(err));
        return;
      }

      resolve(connection);
    });
  }).timeout(1980,'Error: timeout of 2000ms exceeded. Check your configuration and your database.');
};

ConnectionManager.prototype.disconnect = function(connection) {
  return new Promise(function (resolve, reject) {
    connection.release( function(err) {
      if (err) {
        reject(err);
      }else{
        connection._invalid = true;
        resolve();
      }
    });
  });
};

ConnectionManager.prototype.validate = function(connection) {
  // return connection; // && connection.loggedIn;
  return connection._invalid === undefined;
};

module.exports = ConnectionManager;