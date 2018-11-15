'use strict';

const AbstractConnectionManager = require('../abstract/connection-manager');
const Promise = require('../../promise');
const logger = require('../../utils/logger');
const debug = logger.getLogger().debugContext('connection:sqlite');
const dataTypes = require('../../data-types').sqlite;
const sequelizeErrors = require('../../errors');
const parserStore = require('../parserStore')('sqlite');

class ConnectionManager extends AbstractConnectionManager {
  constructor(dialect, sequelize) {
    super(dialect, sequelize);

    // We attempt to parse file location from a connection uri
    // but we shouldn't match sequelize default host.
    if (this.sequelize.options.host === 'localhost') {
      delete this.sequelize.options.host;
    }

    this.connections = {};
    this.lib = this._loadDialectModule('sqlite3').verbose();
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

  getConnection(options) {
    options = options || {};
    options.uuid = options.uuid || 'default';
    options.inMemory = (this.sequelize.options.storage || this.sequelize.options.host || ':memory:') === ':memory:' ? 1 : 0;

    const dialectOptions = this.sequelize.options.dialectOptions;
    options.readWriteMode = dialectOptions && dialectOptions.mode;

    if (this.connections[options.inMemory || options.uuid]) {
      return Promise.resolve(this.connections[options.inMemory || options.uuid]);
    }

    return new Promise((resolve, reject) => {
      this.connections[options.inMemory || options.uuid] = new this.lib.Database(
        this.sequelize.options.storage || this.sequelize.options.host || ':memory:',
        options.readWriteMode || this.lib.OPEN_READWRITE | this.lib.OPEN_CREATE, // default mode
        err => {
          if (err) return reject(new sequelizeErrors.ConnectionError(err));
          debug(`connection acquired ${options.uuid}`);
          resolve(this.connections[options.inMemory || options.uuid]);
        }
      );
    }).tap(connection => {
      if (this.sequelize.config.password) {
        // Make it possible to define and use password for sqlite encryption plugin like sqlcipher
        connection.run(`PRAGMA KEY=${this.sequelize.escape(this.sequelize.config.password)}`);
      }
      if (this.sequelize.options.foreignKeys !== false) {
        // Make it possible to define and use foreign key constraints unless
        // explicitly disallowed. It's still opt-in per relation
        connection.run('PRAGMA FOREIGN_KEYS=ON');
      }
    });
  }

  releaseConnection(connection, force) {
    if (connection.filename === ':memory:' && force !== true) return;

    if (connection.uuid) {
      connection.close();
      debug(`connection released ${connection.uuid}`);
      delete this.connections[connection.uuid];
    }
  }
}

module.exports = ConnectionManager;
module.exports.ConnectionManager = ConnectionManager;
module.exports.default = ConnectionManager;
