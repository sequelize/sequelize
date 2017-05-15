'use strict';

const AbstractConnectionManager = require('../abstract/connection-manager');
const Promise = require('../../promise');
const sequelizeErrors = require('../../errors');
const parserStore = require('../parserStore')('oracle');

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
        this.lib.maxRows = 1000;

        if (sequelize.config && 'dialectOptions' in sequelize.config) {
          let dialectOptions = sequelize.config.dialectOptions;
          if (dialectOptions && 'maxRows' in dialectOptions) {
            this.lib.maxRows = sequelize.config.dialectOptions.maxRows;
          }

          if (dialectOptions && 'fetchAsString' in dialectOptions) {
            this.lib.fetchAsString = sequelize.config.dialectOptions.fetchAsString;
          }
        }
        this.lib.Promise = Promise;
      }
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') {
        throw new Error('Please install oracledb package manually');
      }
      throw err;
    }

  }

  /**
  * Method for checking the config object passed and generate the full database if not fully passed
  * With dbName, host and port, it generates a string like this : 'host:port/dbname' 
  */
  checkConfigObject(config) {
    //A connectString should be defined
    if (config.database.length === 0) {
      let errorToThrow = 'The database cannot be blank, you must specify the database name (which correspond to the service name';
      errorToThrow += '\n from tnsnames.ora : (HOST = mymachine.example.com)(PORT = 1521)(SERVICE_NAME = orcl)'; 
      throw new Error(errorToThrow);
    }

    if (!config.host || config.host.length === 0) {
      throw new Error('You have to specify the host');
    }

    //The connectString has a special format, we check it
    //ConnectString format is : host:[port]/service_name
    if (config.database.indexOf('/') === - 1) {
      
      let connectString = config.host;

      if (config.port && config.port !== 0) {
        connectString += `:${config.port}`;
      } else {
        connectString += ':1521'; //Default port number
      }
      connectString += `/${config.database}`;
      config.database = connectString;
    }
  }

  // Expose this as a method so that the parsing may be updated when the user has added additional, custom types
  _refreshTypeParser(dataType) {
    parserStore.refresh(dataType);
  }

  _clearTypeParser() {
    parserStore.clear();
  }

  connect(config) {
    let self = this;
    return new Promise((resolve, reject) => {

      let connectionConfig = {
        user: config.username,
        host:  config.host,
        port : config.port,
        database : config.database,
        password: config.password,
        externalAuth : config.externalAuth,
        stmtCacheSize : 0
      };

      //We check if there dialect options
      if ('dialectOptions' in config) {
        let dialectOptions = config.dialectOptions;

        //If stmtCacheSize is defined, we set it
        if ('stmtCacheSize' in dialectOptions) {
          connectionConfig.stmtCacheSize = dialectOptions.stmtCacheSize;
        }
      }


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
        //Not relevant, node-oracledb considers it if multiple connections are opened / closed; while testing, a few connections are created and closed.
        resolve(connection);
      })
      .catch(err => {
        if (err) {
          //We split to get the error number; it comes as ORA-XXXXX: 
          let errorCode = err.message.split(':');
          errorCode = errorCode[0];

          if (errorCode) {
            switch (errorCode) {
              case 'ORA-28000': //Account locked
                reject(new sequelizeErrors.ConnectionRefusedError(err));
                break;
              case 'ORA-01017': 
                reject(new sequelizeErrors.AccessDeniedError(err));
                break;
              case 'ORA-12154':
                reject(new sequelizeErrors.HostNotReachableError(err)); //ORA-12154: TNS:could not resolve the connect identifier specified
                break;
              case 'ORA-12514' : // ORA-12514: TNS:listener does not currently know of service requested in connect descriptor
              case 'ORA-12541' : //ORA-12541: TNS:No listener
                //We can't send this kind of error, so we send 'login / password invalid'
                err.message = 'ORA-01017 : invalid username/password; logon denied';
                reject(new sequelizeErrors.AccessDeniedError(err)); 
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

          reject(err); //Unknown error, we throw it anyway
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
  }

  disconnect(connection) {
    return connection.release()
    .then(() => {
      return true;
    })
    .catch(err => {
      throw new sequelizeErrors.ConnectionError(err);
    });
  }

  validate(connection) {
    return connection && ['disconnected', 'protocol_error'].indexOf(connection.state) === -1;
  }

  
}

module.exports = ConnectionManager;
module.exports.ConnectionManager = ConnectionManager;
module.exports.default = ConnectionManager;