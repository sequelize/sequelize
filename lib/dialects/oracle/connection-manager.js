'use strict';

var AbstractConnectionManager = require('../abstract/connection-manager')
  , ConnectionManager
  , Utils = require('../../utils')
  , Promise = require('../../promise')
  , sequelizeErrors = require('../../errors');

ConnectionManager = function(dialect, sequelize) {
  AbstractConnectionManager.call(this, dialect, sequelize);
  
  try {
    this.lib = require(sequelize.config.dialectModulePath || 'oracledb');
  } catch (err) {
    throw new Error('Please install oracledb package manually');
  }

  this.sequelize = sequelize;
};

Utils._.extend(ConnectionManager.prototype, AbstractConnectionManager.prototype);

ConnectionManager.prototype.connect = function(config) {
  var self = this;
  return new Promise(function (resolve, reject) {
    var connectionConfig = {  
      user: config.username,
      password: config.password,
      connectString: config.database,
    };

    self.lib.getConnection(connectionConfig, function(err, connection) {
      if(err) {
        console.log('rejected');
        reject(new sequelizeErrors.ConnectionError(err));
      } else {
        resolve(connection);
      }
    });
  });
};

ConnectionManager.prototype.disconnect = function(connection) {
  // Dont disconnect a connection that is already disconnected
  if (!!connection.closed) {
    return Promise.resolve();
  }

  return new Promise(function (resolve, reject) {
    connection.on('end', resolve);
    connection.close();
  });
};

ConnectionManager.prototype.validate = function(connection) {
  return connection && connection.loggedIn;
};

module.exports = ConnectionManager;
