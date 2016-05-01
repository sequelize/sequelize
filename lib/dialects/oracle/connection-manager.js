'use strict';

var AbstractConnectionManager = require('../abstract/connection-manager')
  , ConnectionManager
  , Promise = require('../../promise')
  , sequelizeErrors = require('../../errors')
  , _ = require('lodash');

ConnectionManager = function(dialect, sequelize) {
  AbstractConnectionManager.call(this, dialect, sequelize);
  
  try {
    this.lib = require(sequelize.config.dialectModulePath || 'oracledb');
    this.lib.outFormat = this.lib.OBJECT;
  } catch (err) {
    throw new Error('Please install oracledb package manually');
  }

  this.sequelize = sequelize;
};

_.extend(ConnectionManager.prototype, AbstractConnectionManager.prototype);

ConnectionManager.prototype.connect = function(config) {
  var self = this;
  return new Promise(function (resolve, reject) {
    var connectionConfig = {  
      user: config.username,
      password: config.password,
      connectString: config.database,
    };

    // OracleDB params set here
    self.lib.autoCommit = true;

    self.lib.getConnection(connectionConfig, function(err, connection) {
      console.log('Trying to connect: ' + JSON.stringify(connectionConfig));
      if(err) {
        console.log('rejected connection: ' + JSON.stringify(connectionConfig) + ', ' + err);
        reject(new sequelizeErrors.ConnectionRefusedError({message: 'connect ECONNREFUSED', parent: err}));
      } else {
        connection.lib = self.lib;
        resolve(connection);
      }
    });
  });
};

ConnectionManager.prototype.disconnect = function(connection) {
  return new Promise(function (resolve, reject) {
    connection.release(function(err) {
      if (err) {
        reject(err);
      } else {
        resolve();
      }
    });
  });
};

ConnectionManager.prototype.validate = function(connection) {
  return connection && connection.loggedIn;
};

module.exports = ConnectionManager;
