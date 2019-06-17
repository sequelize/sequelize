'use strict';

const AbstractConnectionManager = require('../abstract/connection-manager');
const Promise = require('../../promise');
const { logger } = require('../../utils/logger');
const sequelizeErrors = require('../../errors');
const DataTypes = require('../../data-types').db2;
const parserStore = require('../parserStore')('db2');
const debug = logger.debugContext('connection:db2');
const debugIbm_db = logger.debugContext('connection:db2:ibm_db');

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
    let connObj = {
      database: config.database,
      hostname: config.host,
      port: config.port,
      uid: config.username,
      pwd: config.password
    };

    if (config.ssl) {
      connObj["security"] = config.ssl;
    }
    if (config.sslcertificate) {
      connObj["SSLServerCertificate"] = config.sslcertificate;
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
        connection.open(connectionConfig, (err) => {
          if (!err) {
            debug('connection acquired');
            return resolve(connection);
          }

          if (err) {
            let connError;
            if(err.message && err.message.search("SQL30081N") != -1) {
              connError = new sequelizeErrors.ConnectionRefusedError(err);
            } else {
              connError = new sequelizeErrors.ConnectionError(err);
            }
            connError["message"] = err.message;
            return reject(connError);
          }
        });
    });
  }

  disconnect(connection) {
    // Don't disconnect a connection that is already disconnected
    if (connection.connected) {
      connection.close((err) => {
        if(err) { debug(err); }
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
