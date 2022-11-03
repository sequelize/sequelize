'use strict';

const { AbstractConnectionManager } = require('../abstract/connection-manager');
const SequelizeErrors = require('../../errors');
const { logger } = require('../../utils/logger');

const debug = logger.debugContext('connection:ibmi');
const parserStore = require('../parserStore')('ibmi');
const DataTypes = require('../../data-types').ibmi;

export class IBMiConnectionManager extends AbstractConnectionManager {
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
    // Combine passed connection options into a connection string
    // config.port has no real meaning for this ODBC Driver
    const connectionKeywords = [];
    if (config.dialectOptions && config.dialectOptions.odbcConnectionString) {
      connectionKeywords.push(config.dialectOptions.odbcConnectionString);
    }

    // 'database' doesn't make sense in this context, but it is mapped here to
    // DSN, which is a close fit
    //  if (config.database) {
    //    connectionKeywords.push(`DSN=${config.database}`);
    //  }

    if (config.DSN) {
      connectionKeywords.push(`DSN=${config.DSN}`);
    }

    if (config.database) {
      connectionKeywords.push(`CurrentSchema=${config.database}`);
    } else {
      connectionKeywords.push(`CurrentSchema=QGPL`);
    }

    if (config.username) {
      connectionKeywords.push(`UID=${config.username}`);
    }

    if (config.password) {
      connectionKeywords.push(`PWD=${config.password}`);
    }

    if (config.host) {
      connectionKeywords.push(`SYSTEM=${config.host}`);
    }

    const connectionString = connectionKeywords.join(';');
    if (connectionString.charAt(connectionString.length - 1) !== ';') {
      connectionString.concat(';');
    }

    let connection;
    try {
      connection = await this.lib.connect(connectionString);
    } catch (error) {
      if (error.toString().includes('Error connecting to the database')) {
        const err = new SequelizeErrors.ConnectionRefusedError(error);
        throw (err);
      }
    }

    return connection;
  }

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
