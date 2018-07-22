'use strict';

const AbstractConnectionManager = require('../abstract/connection-manager');
const SequelizeErrors = require('../../errors');
const Utils = require('../../utils');
const logger = require('../../utils/logger');
const DataTypes = require('../../data-types').mysql;
const momentTz = require('moment-timezone');
const debug = logger.getLogger().debugContext('connection:mysql');
const parserStore = require('../parserStore')('mysql');

/**
 * MySQL Connection Manager
 *
 * Get connections, validate and disconnect them.
 * AbstractConnectionManager pooling use it to handle MySQL specific connections
 * Use https://github.com/sidorares/node-mysql2 to connect with MySQL server
 *
 * @extends AbstractConnectionManager
 * @returns Class<ConnectionManager>
 * @private
 */

class ConnectionManager extends AbstractConnectionManager {
  constructor(dialect, sequelize) {
    super(dialect, sequelize);

    this.sequelize.config.port = this.sequelize.config.port || 3306;

    try {
      if (sequelize.config.dialectModulePath) {
        this.lib = require(sequelize.config.dialectModulePath);
      } else {
        this.lib = require('mysql2');
      }
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') {
        throw new Error('Please install mysql2 package manually');
      }
      throw err;
    }

    this.refreshTypeParser(DataTypes);
  }

  _refreshTypeParser(dataType) {
    parserStore.refresh(dataType);
  }

  _clearTypeParser() {
    parserStore.clear();
  }

  static _typecast(field, next) {
    if (parserStore.get(field.type)) {
      return parserStore.get(field.type)(field, this.sequelize.options, next);
    }
    return next();
  }

  /**
   * Connect with MySQL database based on config, Handle any errors in connection
   * Set the pool handlers on connection.error
   * Also set proper timezone once conection is connected
   *
   * @returns Promise<Connection>
   * @private
   */
  connect(config) {
    const connectionConfig = {
      host: config.host,
      port: config.port,
      user: config.username,
      flags: '-FOUND_ROWS',
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

    return new Utils.Promise((resolve, reject) => {
      const connection = this.lib.createConnection(connectionConfig);

      const errorHandler = e => {
        // clean up connect event if there is error
        connection.removeListener('connect', connectHandler);

        if (config.pool.handleDisconnects) {
          debug(`connection error ${e.code}`);

          if (e.code === 'PROTOCOL_CONNECTION_LOST') {
            this.pool.destroy(connection)
              .catch(/Resource not currently part of this pool/, () => {});
            return;
          }
        }

        connection.removeListener('error', errorHandler);
        reject(e);
      };

      const connectHandler = () => {
        if (!config.pool.handleDisconnects) {
          // clean up error event if connected
          connection.removeListener('error', errorHandler);
        }
        resolve(connection);
      };

      connection.on('error', errorHandler);
      connection.once('connect', connectHandler);
    })
      .tap (() => { debug('connection acquired'); })
      .then(connection => {
        return new Utils.Promise((resolve, reject) => {
          if (!this.sequelize.config.keepDefaultTimezone) {
            // set timezone for this connection
            // but named timezone are not directly supported in mysql, so get its offset first
            let tzOffset = this.sequelize.options.timezone;
            tzOffset = /\//.test(tzOffset) ? momentTz.tz(tzOffset).format('Z') : tzOffset;
            return connection.query(`SET time_zone = '${tzOffset}'`, err => {
              if (err) { reject(err); } else { resolve(connection); }
            });
          }
          // return connection without executing SET time_zone query
          resolve(connection);
        });
      })
      .catch(err => {
        switch (err.code) {
          case 'ECONNREFUSED':
            throw new SequelizeErrors.ConnectionRefusedError(err);
          case 'ER_ACCESS_DENIED_ERROR':
            throw new SequelizeErrors.AccessDeniedError(err);
          case 'ENOTFOUND':
            throw new SequelizeErrors.HostNotFoundError(err);
          case 'EHOSTUNREACH':
            throw new SequelizeErrors.HostNotReachableError(err);
          case 'EINVAL':
            throw new SequelizeErrors.InvalidConnectionError(err);
          default:
            throw new SequelizeErrors.ConnectionError(err);
        }
      });
  }

  disconnect(connection) {
    // Don't disconnect connections with CLOSED state
    if (connection._closing) {
      debug('connection tried to disconnect but was already at CLOSED state');
      return Utils.Promise.resolve();
    }

    return new Utils.Promise((resolve, reject) => {
      connection.end(err => {
        if (err) {
          reject(new SequelizeErrors.ConnectionError(err));
        } else {
          debug('connection disconnected');
          resolve();
        }
      });
    });
  }

  validate(connection) {
    return connection && connection._fatalError === null && connection._protocolError === null && !connection._closing &&
      !connection.stream.destroyed;
  }
}

module.exports = ConnectionManager;
module.exports.ConnectionManager = ConnectionManager;
module.exports.default = ConnectionManager;
