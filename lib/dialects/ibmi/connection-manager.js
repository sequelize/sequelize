'use strict';

const AbstractConnectionManager = require('../abstract/connection-manager');
const SequelizeErrors = require('../../errors');
const { logger } = require('../../utils/logger');
const debug = logger.debugContext('connection:ibmi');
const parserStore = require('../parserStore')('ibmi');
const DataTypes = require('../../data-types').ibmi;

class ConnectionManager extends AbstractConnectionManager {
  constructor(dialect, sequelize) {
    super(dialect, sequelize);

    this.connections = {};
    this.lib = this._loadDialectModule('odbc');
    this.refreshTypeParser(DataTypes);
  }

  _refreshTypeParser(dataType) {
    parserStore.refresh(dataType);
  }

  _clearTypeParser() {
    parserStore.clear();
  }

  async connect(config) {

    try {
      const connection = new Promise(async (resolve, reject) => {
        try {
          const connection = await this.lib.connect(`${config.odbcConnectionString}`);
          resolve(connection);
        } catch (error) {
          if (error.toString().includes('Error connecting to the database')) {
            const err = new SequelizeErrors.ConnectionRefusedError(error);
            reject(err);
          }
        }
      });
      return connection;
    } catch (error) {
      debug('Failed to connect: Error in "odbc" package in "new Connection"');
      if (error.toString().includes('Error connecting to the database')) {
        const err = new SequelizeErrors.ConnectionRefusedError(error);
        throw (err);
      }
    }
  }



  //   /// below here

  //   try {
  //     const connection = await this.lib.connect(`${config.odbcConnectionString}`);

  //     const errorHandler = error => {
  //       reject(error);
  //     };

  //     connection.on('error', errorHandler);

  //     return connection;
  //   } catch (error) {
  //     if (!error.code) {
  //       throw new sequelizeErrors.ConnectionError(error);
  //     }

  //     switch (error.code) {
  //       case 'ESOCKET':
  //         if (error.message.includes('connect EHOSTUNREACH')) {
  //           throw new sequelizeErrors.HostNotReachableError(error);
  //         }
  //         if (error.message.includes('connect ENETUNREACH')) {
  //           throw new sequelizeErrors.HostNotReachableError(error);
  //         }
  //         if (error.message.includes('connect EADDRNOTAVAIL')) {
  //           throw new sequelizeErrors.HostNotReachableError(error);
  //         }
  //         if (error.message.includes('getaddrinfo ENOTFOUND')) {
  //           throw new sequelizeErrors.HostNotFoundError(error);
  //         }
  //         if (error.message.includes('connect ECONNREFUSED')) {
  //           throw new sequelizeErrors.ConnectionRefusedError(error);
  //         }
  //         throw new sequelizeErrors.ConnectionError(error);
  //       case 'ER_ACCESS_DENIED_ERROR':
  //       case 'ELOGIN':
  //         throw new sequelizeErrors.AccessDeniedError(error);
  //       case 'EINVAL':
  //         throw new sequelizeErrors.InvalidConnectionError(error);
  //       default:
  //         throw new sequelizeErrors.ConnectionError(error);
  //     }
  //   }


  //   return new Promise(async (resolve, reject) => {
  //     try {
  //       const connection = await this.lib.connect(`${config.odbcConnectionString}`);
  //       const connectHandler = error => {
  //         connection.removeListener('end', endHandler);
  //         connection.removeListener('error', errorHandler);

  //         if (error) return reject(error);

  //         debug('connection acquired');
  //         resolve(connection);
  //       };

  //       const endHandler = () => {
  //         connection.removeListener('connect', connectHandler);
  //         connection.removeListener('error', errorHandler);
  //         reject(new Error('Connection was closed by remote server'));
  //       };

  //       const errorHandler = error => {
  //         connection.removeListener('connect', connectHandler);
  //         connection.removeListener('end', endHandler);
  //         reject(error);
  //       };

  //       connection.once('error', errorHandler);
  //       connection.once('end', endHandler);
  //       connection.once('connect', connectHandler);

  //       connection.on('error', error => {
  //         switch (error.code) {
  //           case 'ESOCKET':
  //           case 'ECONNRESET':
  //           case 'EPIPE':
  //           case 'PROTOCOL_CONNECTION_LOST':
  //             this.pool.destroy(connection);
  //         }
  //       });

  //       debug('Connection successful.');
  //       resolve(connection);
  //     } catch (error) {
  //       if (!error.code) {
  //         throw new sequelizeErrors.ConnectionError(error);
  //       }
  
  //       switch (error.code) {
  //         case 'ESOCKET':
  //           if (error.message.includes('connect EHOSTUNREACH')) {
  //             throw new sequelizeErrors.HostNotReachableError(error);
  //           }
  //           if (error.message.includes('connect ENETUNREACH')) {
  //             throw new sequelizeErrors.HostNotReachableError(error);
  //           }
  //           if (error.message.includes('connect EADDRNOTAVAIL')) {
  //             throw new sequelizeErrors.HostNotReachableError(error);
  //           }
  //           if (error.message.includes('getaddrinfo ENOTFOUND')) {
  //             throw new sequelizeErrors.HostNotFoundError(error);
  //           }
  //           if (error.message.includes('connect ECONNREFUSED')) {
  //             throw new sequelizeErrors.ConnectionRefusedError(error);
  //           }
  //           throw new sequelizeErrors.ConnectionError(error);
  //         case 'ER_ACCESS_DENIED_ERROR':
  //         case 'ELOGIN':
  //           throw new sequelizeErrors.AccessDeniedError(error);
  //         case 'EINVAL':
  //           throw new sequelizeErrors.InvalidConnectionError(error);
  //         default:
  //           throw new sequelizeErrors.ConnectionError(error);
  //       }
  //       // debug('Failed to connect: Error in "odbc" package in "new Connection"');
  //       // if (err.toString().includes('Error connecting to the database')) {
  //       //   const error = new SequelizeErrors.ConnectionRefusedError(error);
  //       //   reject(error);
  //       //   return;
  //       // }
  //       // reject(err);
  //       // return;
  //     }
  //   });
  // }

  async disconnect(connection) {
    return new Promise((resolve, reject) => {
      if (!this.validate(connection)) {
        debug('Tried to disconnect, but connection was already closed.');
        resolve();
      }

      connection.close(error => {
        if (error) {
          reject(error);
        }
        resolve();
      });
    });
  }

  validate(connection) {
    return connection.isConnected;
  }
}

module.exports = ConnectionManager;
module.exports.ConnectionManager = ConnectionManager;
module.exports.default = ConnectionManager;
