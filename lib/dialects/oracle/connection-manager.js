'use strict';

var AbstractConnectionManager = require('../abstract/connection-manager')
  , ConnectionManager
  , Utils = require('../../utils')
  , Promise = require('../../promise')
  , sequelizeErrors = require('../../errors')
  , dataTypes = require('../../data-types').oracle
  , parserMap = {};
  

ConnectionManager = function(dialect, sequelize) {
  AbstractConnectionManager.call(this, dialect, sequelize);

  this.sequelize = sequelize;
  this.sequelize.config.port = this.sequelize.config.port || 1521;
  try {
    if (sequelize.config.dialectModulePath) {
      this.lib = require(sequelize.config.dialectModulePath);
    } else {
      this.lib = require('oracledb');
      this.lib.Promise = require('bluebird'); 
    }
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND') {
      throw new Error('Please install oracledb package manually');
    }
    throw err;
  }

  this.refreshTypeParser(dataTypes);
};

/**
 * Method for checking the config object passed and generate the connectString if not fully passed
 */
ConnectionManager.prototype.checkConfigObject = function(config) {
    //A connectString should be defined
    if(config.connectString.length == 0) {
      var errorToThrow = "The connectString for Oracle cannot be blank, the format is : HOST:[PORT]/SERVICE_NAME";
      errorToThrow += "\n from tnsnames.ora : (HOST = mymachine.example.com)(PORT = 1521)(SERVICE_NAME = orcl)" 
      throw new Error(errorToThrow);
    }

    //The connectString has a special format, we check it
    if(config.connectString.indexOf('/') === -1) {
      //ConnectString format is : host:[port]/service_name
      if(!config.host || config.host.length == 0) {
        throw new Error('You have to specify the host or the fully qualified connectString');
      }
      var connectString = config.host;

      if(config.port && config.port != 0) {
        connectString += `:${this.config.port}`;
      } else {
        connectString += ':1521'; //Default port number
      }
      connectString += `/${this.config.connectString}`;

      config.connectString = connectString;
    }
}

Utils._.extend(ConnectionManager.prototype, AbstractConnectionManager.prototype);

// Expose this as a method so that the parsing may be updated when the user has added additional, custom types
ConnectionManager.prototype.$refreshTypeParser = function (dataType) {
  dataType.types.oracle.forEach(function (type) {
    parserMap[type] = dataType.parse;
  });
};

ConnectionManager.prototype.$clearTypeParser = function () {
  parserMap = {};
};

ConnectionManager.$typecast = function (field, next) {
  if (parserMap[field.type]) {
    return parserMap[field.type](field, this.sequelize.options);
  }

  return next();
};

/*
 *  Carefull here, the config object passed should always
*/
ConnectionManager.prototype.connect = function(config) {
  var self = this;
  return new Promise((resolve, reject) => {
    var connectionConfig = {
      user: config.username,
      host:  config.host,
      port : config.port,
      password: config.password,
      connectString: config.connectString,
      externalAuth : config.externalAuth
    };

    //Check the config object
    self.checkConfigObject(connectionConfig);

    if (config.dialectOptions) {
      Object.keys(config.dialectOptions).forEach(function(key) {
        connectionConfig[key] = config.dialectOptions[key];
      });
    }

    console.dir(connectionConfig);

    return self.lib.getConnection(connectionConfig)
    .then(function(connection) {
      //TODO connection pooling
      /*if (config.pool.handleDisconnects) {
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
      }*/
      resolve(connection);
    })
    .catch(err => {
      if (err) {

        //We split to get the error number
        var errorCode = err.message.split(':');
        var errorString = errorCode.length > 2 ? errorCode[2] : errorCode;
        errorCode = errorCode[0];

        if (err.code) {
          switch (err.code) {
          case 'ORA-28000': //Account locked
            reject(new sequelizeErrors.ConnectionRefusedError(err));
            break;
          case 'ORA-01017': 
            reject(new sequelizeErrors.AccessDeniedError(err));
            break;
          case 'ORA-12154':
            if(errorString.indexOf("listener does not currently know")) {
              reject(new sequelizeErrors.HostNotFoundError(err)); //ORA-12514: TNS:listener does not currently know of service requested in connect descriptor
            } else {
              reject(new sequelizeErrors.HostNotReachableError(err)); //ORA-12154: TNS:could not resolve the connect identifier specified
            }
            break;
          case 'EINVAL': //TODO
            reject(new sequelizeErrors.InvalidConnectionError(err));
            break;
          default:
            reject(new sequelizeErrors.ConnectionError(err));
            break;
          }
        } else {
          reject(new sequelizeErrors.ConnectionError(err));
        }

        reject(err); //Error unkown, we throw it anyway
        // return; 
      }
    })

  }).tap(function (connection) {
    /*if(self.sequelize.options.timezone) {
      return connection.execute("ALTER DATABASE SET time_zone = '" + self.sequelize.options.timezone + "'")
      .then(result => {
        return Promise.resolve(connection);
      });
    }*/
    return Promise.resolve(connection);
  });
};
ConnectionManager.prototype.disconnect = function(connection) {

    return connection.release()
    .then(() => {
      return true;
    })
    .catch(err => {
      throw new sequelizeErrors.ConnectionError(err);
    });
};
ConnectionManager.prototype.validate = function(connection) {
  return connection && ['disconnected', 'protocol_error'].indexOf(connection.state) === -1;
};

module.exports = ConnectionManager;
