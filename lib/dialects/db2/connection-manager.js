'use strict';

const AbstractConnectionManager = require('../abstract/connection-manager');
const sequelizeErrors = require('../../errors');
const { logger } = require('../../utils/logger');
const DataTypes = require('../../data-types').db2;
const momentTz = require('moment-timezone');
const debug = logger.debugContext('connection:db2');
const parserStore = require('../parserStore')('db2');

/**
 * DB2 Connection Manager
 *
 * Get connections, validate and disconnect them.
 * AbstractConnectionManager pooling use it to handle DB2 specific connections
 * Use https://github.com/ibmdb/node-ibm_db to connect with DB2 server
 *
 * @private
 */
class ConnectionManager extends AbstractConnectionManager {
  constructor(dialect, sequelize) {
    sequelize.config.port = sequelize.config.port || 3306;
    super(dialect, sequelize);
    this.lib = this._loadDialectModule('ibm_db');
    this.refreshTypeParser(DataTypes);
  }

  static _typecast(field, next) {
    if (parserStore.get(field.type)) {
      return parserStore.get(field.type)(field, this.sequelize.options, next);
    }
    return next();
  }

  _refreshTypeParser(dataType) {
    parserStore.refresh(dataType);
  }

  _clearTypeParser() {
    parserStore.clear();
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
      pwd: config.password
    };

    if (config.ssl) {
      connectionConfig['security'] = config.ssl;
    }
    if (config.sslcertificate) {
      connectionConfig['SSLServerCertificate'] = config.sslcertificate;
    }
    if (config.dialectOptions) {
      for (const key of Object.keys(config.dialectOptions)) {
        connectionConfig[key] = config.dialectOptions[key];
      }
    }

    try {
      return await new Promise((resolve, reject) => {
        // console.log('creating connection');
        const connection = new this.lib.Database();
        connection.lib = this.lib;
        connection.open(connectionConfig, error => {
          if (error) {
            if (error.message && error.message.includes('SQL30081N')) {
              return new sequelizeErrors.ConnectionRefusedError(error);
            }
            return new sequelizeErrors.ConnectionError(error);
          }
          //console.log('connection acquired');
          return connection;
        });
      });
    } catch (err) {
      throw new sequelizeErrors.ConnectionError(err);
    }
  }

  async disconnect(connection) {
    // Don't disconnect connections with CLOSED state
    if (!connection.isValid()) {
      debug('connection tried to disconnect but was already at CLOSED state');
      return;
    }
    return await connection.end();
  }

  validate(connection) {
    return connection && connection.isValid();
  }
}

module.exports = ConnectionManager;
module.exports.ConnectionManager = ConnectionManager;
module.exports.default = ConnectionManager;
