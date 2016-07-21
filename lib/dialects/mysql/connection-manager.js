'use strict';

const AbstractConnectionManager = require('../abstract/connection-manager');
const Utils = require('../../utils');
const debug = Utils.getLogger().debugContext('connection:mysql');
const Promise = require('../../promise');
const sequelizeErrors = require('../../errors');
const dataTypes = require('../../data-types').mysql;
const parserMap = new Map();

class ConnectionManager extends AbstractConnectionManager {
  constructor(dialect, sequelize) {
    super(dialect, sequelize);

    this.sequelize = sequelize;
    this.sequelize.config.port = this.sequelize.config.port || 3306;
    try {
      if (sequelize.config.dialectModulePath) {
        this.lib = require(sequelize.config.dialectModulePath);
      } else {
        this.lib = require('mysql2');
      }
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') {
        throw new Error('Please install mysql package manually');
      }
      throw err;
    }

    this.refreshTypeParser(dataTypes);
  }

  // Expose this as a method so that the parsing may be updated when the user has added additional, custom types
  _refreshTypeParser(dataType) {
    for (const type of dataType.types.mysql) {
      parserMap.set(type, dataType.parse);
    }
  }

  _clearTypeParser() {
    parserMap.clear();
  }

  static _typecast(field, next) {
    if (parserMap.has(field.type)) {
      return parserMap.get(field.type)(field, this.sequelize.options);
    }

    return next();
  }

  connect(config) {
    return new Promise((resolve, reject) => {
      const connectionConfig = {
        host: config.host,
        port: config.port,
        user: config.username,
        password: config.password,
        database: config.database,
        timezone: this.sequelize.options.timezone,
        typeCast: ConnectionManager._typecast.bind(this),
        bigNumberStrings: false,
        supportBigNumbers: true
      };

      if (config.dialectOptions) {
        for (const key of Object.keys(config.dialectOptions)) {
          connectionConfig[key] = config.dialectOptions[key];
        }
      }

      const connection = this.lib.createConnection(connectionConfig);

      connection.connect(err => {
        if (err) {
          if (err.code) {
            switch (err.code) {
            case 'ECONNREFUSED':
              reject(new sequelizeErrors.ConnectionRefusedError(err));
              break;
            case 'ER_ACCESS_DENIED_ERROR':
              reject(new sequelizeErrors.AccessDeniedError(err));
              break;
            case 'ENOTFOUND':
              reject(new sequelizeErrors.HostNotFoundError(err));
              break;
            case 'EHOSTUNREACH':
              reject(new sequelizeErrors.HostNotReachableError(err));
              break;
            case 'EINVAL':
              reject(new sequelizeErrors.InvalidConnectionError(err));
              break;
            default:
              reject(new sequelizeErrors.ConnectionError(err));
              break;
            }
          } else {
            reject(new sequelizeErrors.ConnectionError(err));
          }

          return;
        }

        if (config.pool.handleDisconnects) {
          // Connection to the MySQL server is usually
          // lost due to either server restart, or a
          // connnection idle timeout (the wait_timeout
          // server variable configures this)
          //
          // See [stackoverflow answer](http://stackoverflow.com/questions/20210522/nodejs-mysql-error-connection-lost-the-server-closed-the-connection)
          connection.on('error', err => {
            if (err.code === 'PROTOCOL_CONNECTION_LOST') {
              // Remove it from read/write pool
              this.pool.destroy(connection);
            }
            debug(`connection error ${err.code}`);
          });
        }
        debug(`connection acquired`);
        resolve(connection);
      });

    }).tap(connection => {
      connection.query("SET time_zone = '" + this.sequelize.options.timezone + "'"); /* jshint ignore: line */
    });
  }

  disconnect(connection) {

    /*
    // Dont disconnect connections with an ended protocol
    // That wil trigger a connection error
    if (connection._protocol._ended) {
      debug(`connection tried to disconnect but was already at ENDED state`);
      return Promise.resolve();
    } */

    return new Promise((resolve, reject) => {
      connection.end(err => {
        if (err) return reject(new sequelizeErrors.ConnectionError(err));
        debug(`connection disconnected`);
        resolve();
      });
    });
  }

  validate(connection) {
    return connection && connection._fatalError === null && !connection._closing;
  }
}

Utils._.extend(ConnectionManager.prototype, AbstractConnectionManager.prototype);

module.exports = ConnectionManager;
module.exports.ConnectionManager = ConnectionManager;
module.exports.default = ConnectionManager;
