'use strict';

const AbstractConnectionManager = require('../abstract/connection-manager');
const Utils = require('../../utils');
const Promise = require('../../promise');
const sequelizeErrors = require('../../errors');
const dataTypes = require('../../data-types').oracle;
const parserStore = require('../parserStore')('oracle');
const parserMap = {};
  

class ConnectionManager extends AbstractConnectionManager  {

  constructor(dialect, sequelize) {
    super(dialect, sequelize);

    this.sequelize = sequelize;
    this.sequelize.config.port = this.sequelize.config.port || 1521;
    try {
      if (sequelize.config.dialectModulePath) {
        this.lib = require(sequelize.config.dialectModulePath);
      } else {
        this.lib = require('oracledb');
        this.lib.maxRows = 500;
        this.lib.Promise = require('bluebird');
        // this.lib.fetchAsString = [ this.lib.DATE ];
      }
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') {
        throw new Error('Please install oracledb package manually');
      }
      throw err;
    }

    // this.refreshTypeParser(dataTypes);
  }

  /**
  * Method for checking the config object passed and generate the full database if not fully passed
  * With dbName, host and port, it generates a string like this : 'host:port/dbname' 
  */
  checkConfigObject(config) {
    //A connectString should be defined
    if(config.database.length === 0) {
      let errorToThrow = 'The database cannot be blank, you must specify the database name (which correspond to the service name';
      errorToThrow += '\n from tnsnames.ora : (HOST = mymachine.example.com)(PORT = 1521)(SERVICE_NAME = orcl)'; 
      throw new Error(errorToThrow);
    }

    if(!config.host || config.host.length === 0) {
      throw new Error('You have to specify the host');
    }

    //The connectString has a special format, we check it
    //ConnectString format is : host:[port]/service_name
    if(config.database.indexOf('/') === - 1) {
      
      let connectString = config.host;

      if(config.port && config.port !== 0) {
        connectString += `:${this.config.port}`;
      } else {
        connectString += ':1521'; //Default port number
      }
      connectString += `/${this.config.database}`;
      config.database = connectString;
    }
  }

  // Expose this as a method so that the parsing may be updated when the user has added additional, custom types
  _refreshTypeParser(dataType) {
    parserStore.refresh(dataType);
  };

  _clearTypeParser() {
    parserStore.clear;
  };

  /*
 *  Carefull here, the config object passed should always
*/
  connect(config) {
    let self = this;
    return new Promise((resolve, reject) => {
      let connectionConfig = {
        user: config.username,
        host:  config.host,
        port : config.port,
        database : config.database,
        password: config.password,
        externalAuth : config.externalAuth
      };

      //Check the config object
      self.checkConfigObject(connectionConfig);

      //We assume that the database has been correctly formed
      connectionConfig.connectString = connectionConfig.database;

      if (config.dialectOptions) {
        Object.keys(config.dialectOptions).forEach(key => {
          connectionConfig[key] = config.dialectOptions[key];
        });
      }

      return self.lib.getConnection(connectionConfig)
      .then(connection => {
        //TODO Oracle - connection pooling
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
          let errorCode = err.message.split(':');
          let errorString = errorCode.length > 2 ? errorCode[2] : errorCode;
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
                if(errorString.indexOf('listener does not currently know')) {
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
        }
      });
    }).tap(connection => {
      //TODO Oracle - see if relevant
      /*if(self.sequelize.options.timezone) {
        return connection.execute("ALTER DATABASE SET time_zone = '" + self.sequelize.options.timezone + "'")
        .then(result => {
          return Promise.resolve(connection);
        });
      }*/
      return Promise.resolve(connection);
    });
  };

  disconnect(connection) {

    return connection.release()
    .then(() => {
      return true;
    })
    .catch(err => {
      throw new sequelizeErrors.ConnectionError(err);
    });
  };

  validate(connection) {
    return connection && ['disconnected', 'protocol_error'].indexOf(connection.state) === -1;
  };

  
};

module.exports = ConnectionManager;
module.exports.ConnectionManager = ConnectionManager;
module.exports.default = ConnectionManager;

// Utils._.extend(ConnectionManager.prototype, AbstractConnectionManager.prototype);

