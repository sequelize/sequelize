'use strict';

const { AbstractConnectionManager } = require('../abstract/connection-manager');
const sequelizeErrors = require('../../errors');
const { logger } = require('../../utils/logger');
const DataTypes = require('../../data-types').db2;

const debug = logger.debugContext('connection:db2');
// const parserStore = require('../parser-store')('db2');

/**
 * DB2 Connection Manager
 *
 * Get connections, validate and disconnect them.
 * AbstractConnectionManager pooling use it to handle DB2 specific connections
 * Use https://github.com/ibmdb/node-ibm_db to connect with DB2 server
 *
 * @private
 */
export class Db2ConnectionManager extends AbstractConnectionManager {
  lib;

  constructor(dialect, sequelize) {
    super(dialect, sequelize);
    this.lib = this._loadDialectModule('ibm_db');
  }

  /**
   * Connect with DB2 database based on config, Handle any errors in connection
   * Set the pool handlers on connection.error
   * Also set proper timezone once connection is connected.
   *
   * @param {object} config
   * @returns {Promise<Connection>}
   * @private
   */
  async connect(config) {
    const connectionConfig = {
      database: config.database,
      hostname: config.host,
      port: config.port,
      uid: config.username,
      pwd: config.password,
    };

    if (config.ssl) {
      connectionConfig.security = config.ssl;
    }

    if (config.sslcertificate) {
      connectionConfig.SSLServerCertificate = config.sslcertificate;
    }

    if (config.dialectOptions) {
      for (const key of Object.keys(config.dialectOptions)) {
        connectionConfig[key] = config.dialectOptions[key];
      }
    }

    try {
      return await new Promise((resolve, reject) => {
        const connection = new this.lib.Database();
        connection.lib = this.lib;
        connection.open(connectionConfig, error => {
          if (error) {
            if (error.message && error.message.includes('SQL30081N')) {
              return reject(new sequelizeErrors.ConnectionRefusedError(error));
            }

            return reject(new sequelizeErrors.ConnectionError(error));
          }

          return resolve(connection);
        });
      });
    } catch (error) {
      throw new sequelizeErrors.ConnectionError(error);
    }
  }

  disconnect(connection) {
    // Don't disconnect a connection that is already disconnected
    if (connection.connected) {
      connection.close(error => {
        if (error) {
          debug(error);
        } else {
          debug('connection closed');
        }
      });
    }

    return Promise.resolve();
  }

  validate(connection) {
    return connection && connection.connected;
  }
}
