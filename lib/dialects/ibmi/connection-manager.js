'use strict';

const AbstractConnectionManager = require('../abstract/connection-manager');
const SequelizeErrors = require('../../errors');
const Promise = require('../../promise');
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

  connect(config) {
    return new Promise((resolve, reject) => {
      try {
        const connection = this.lib.connect(`${config.odbcConnectionString}`);
        debug('Connection successful.');
        resolve(connection);
      } catch (err) {
        debug('Failed to connect: Error in "odbc" package in "new Connection"');
        const error = err.toString();

        if (error.includes('IM002')) {
          throw new SequelizeErrors.ConnectionRefusedError(error);
        }
      }
    });
  }

  disconnect(connection) {
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
