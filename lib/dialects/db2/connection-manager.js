'use strict';

const AbstractConnectionManager = require('../abstract/connection-manager');
const Promise = require('../../promise');
const { logger } = require('../../utils/logger');
const sequelizeErrors = require('../../errors');
const DataTypes = require('../../data-types').db2;
const parserStore = require('../parserStore')('db2');
const debug = logger.debugContext('connection:db2');

class ConnectionManager extends AbstractConnectionManager {
  constructor(dialect, sequelize) {
    super(dialect, sequelize);
    this.lib = this._loadDialectModule('ibm_db');
    this.refreshTypeParser(DataTypes);
  }

  _refreshTypeParser(dataType) {
    parserStore.refresh(dataType);
  }

  _clearTypeParser() {
    parserStore.clear();
  }

  getdb2Config(config) {
    const connObj = {
      database: config.database,
      hostname: config.host,
      port: config.port,
      uid: config.username,
      pwd: config.password
    };

    if (config.ssl) {
      connObj['security'] = config.ssl;
    }
    if (config.sslcertificate) {
      connObj['SSLServerCertificate'] = config.sslcertificate;
    }
    if (config.dialectOptions) {
      for (const key of Object.keys(config.dialectOptions)) {
        connObj[key] = config.dialectOptions[key];
      }
    }
    return connObj;
  }

  connect(config) {
    return new Promise((resolve, reject) => {
      const connectionConfig = this.getdb2Config(config);
      const connection = new this.lib.Database();
      connection.lib = this.lib;
      connection.open(connectionConfig, error => {
        if (error) {
          if (error.message && error.message.includes('SQL30081N')) {
            return reject(new sequelizeErrors.ConnectionRefusedError(error));
          }
          return reject(new sequelizeErrors.ConnectionError(error));
        }
        debug('connection acquired');
        return resolve(connection);
      });
    });
  }

  disconnect(connection) {
    // Don't disconnect a connection that is already disconnected
    if (connection.connected) {
      connection.close(error => {
        if (error) { debug(error); }
        else { debug('connection closed'); }
      });
    }
    return Promise.resolve();
  }

  validate(connection) {
    return connection && connection.connected;
  }

  /**
   * Call dialect library to disconnect a connection
   *
   * @param {Connection} connection
   * @private
   * @returns {Promise}
   */
  _disconnect(connection) {
    return this.dialect.connectionManager.disconnect(connection);
  }

}

module.exports = ConnectionManager;
module.exports.ConnectionManager = ConnectionManager;
module.exports.default = ConnectionManager;
