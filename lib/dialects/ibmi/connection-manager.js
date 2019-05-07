'use strict';

const AbstractConnectionManager = require('../abstract/connection-manager');
const Promise = require('../../promise');
const { logger } = require('../../utils/logger');
const debug = logger.debugContext('connection:ibmi');
const dataTypes = require('../../data-types').ibmi;
const sequelizeErrors = require('../../errors');
const parserStore = require('../parserStore')('ibmi');

class ConnectionManager extends AbstractConnectionManager {
  constructor(dialect, sequelize) {
    super(dialect, sequelize);

    // We attempt to parse file location from a connection uri
    // but we shouldn't match sequelize default host.
    if (this.sequelize.options.host === 'localhost') {
      delete this.sequelize.options.host;
    }

    this.connections = {};
    this.lib = this._loadDialectModule('odbc');
    this.refreshTypeParser(dataTypes);
  }

  _onProcessExit() {
    const promises = Object.getOwnPropertyNames(this.connections)
      .map(connection => Promise.fromCallback(callback => this.connections[connection].close(callback)));

    return Promise
      .all(promises)
      .then(() => super._onProcessExit.call(this));
  }

  // Expose this as a method so that the parsing may be updated when the user has added additional, custom types
  _refreshTypeParser(dataType) {
    parserStore.refresh(dataType);
  }

  _clearTypeParser() {
    parserStore.clear();
  }

  connect(config) {

    let connectionString;

    // if a connection string is passed, just use that
    if (config.asdf) {
      connectionString = config.dsn;
    // if dsn, username, and password are passed, can build the connection string
    } else if (config.database && config.username && config.password) {
      connectionString = `DSN=${config.database};UID=${config.username};PWD=${config.password}`;
      // additional options
      if (config.schema) {
        connectionString += `;SCHEMA=${config.schema}`
      }
    } else{
      debug('Invalid connection configuration object was passed');
      throw new Error('Error with connection config: Pass a configuration object with either a "connectionString" property, or "dsn", "username", and "password" properties.');
    }

    return new Promise(async (resolve, reject) => {
      try {
        const connection = new this.lib.Connection(connectionString);
        debug('Connection successful.');
        resolve(connection);
      } catch (error) {
        debug('Failed to connect: Error in "odbc" package in "new Connection"');
        reject(error);
      }
    });
  }

  disconnect(connection) {
    return new Promise(async (resolve, reject) => {
      if (!this.validate(connection)) {
        debug('Tried to disconnect, but connection was already closed.');
        resolve();
      }

      connection.close((error) => {
        if (error) {
          reject(error);
        }
        resolve();
      });
    });
  }

  validate(connection) {
    return connection.connected;
  }
}

module.exports = ConnectionManager;
module.exports.ConnectionManager = ConnectionManager;
module.exports.default = ConnectionManager;
