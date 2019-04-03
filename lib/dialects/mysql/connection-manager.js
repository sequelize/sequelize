'use strict';

const AbstractConnectionManager = require('../abstract/connection-manager');
const SequelizeErrors = require('../../errors');
const Promise = require('../../promise');
const { logger } = require('../../utils/logger');
const DataTypes = require('../../data-types').mysql;
const momentTz = require('moment-timezone');
const debug = logger.debugContext('connection:mysql');
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
    sequelize.config.port = sequelize.config.port || 3306;
    super(dialect, sequelize);
    this.lib = this._loadDialectModule('mysql2');
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
   * Also set proper timezone once connection is connected.
   *
   * @param {Object} config
   * @returns {Promise<Connection>}
   * @private
   */
  connect(config) {
    const connectionConfig = Object.assign({
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
    }, config.dialectOptions);

    return new Promise((resolve, reject) => {
      const connection = this.lib.createConnection(connectionConfig);

      const errorHandler = e => {
        // clean up connect & error event if there is error
        connection.removeListener('connect', connectHandler);
        connection.removeListener('error', connectHandler);
        reject(e);
      };

      const connectHandler = () => {
        // clean up error event if connected
        connection.removeListener('error', errorHandler);
        resolve(connection);
      };

      // don't use connection.once for error event handling here
      // mysql2 emit error two times in case handshake was failed
      // first error is protocol_lost and second is timeout
      // if we will use `once.error` node process will crash on 2nd error emit
      connection.on('error', errorHandler);
      connection.once('connect', connectHandler);
    })
      .tap(() => { debug('connection acquired'); })
      .then(connection => {
        connection.on('error', error => {
          switch (error.code) {
            case 'ESOCKET':
            case 'ECONNRESET':
            case 'EPIPE':
            case 'PROTOCOL_CONNECTION_LOST':
              this.pool.destroy(connection);
          }
        });

        return new Promise((resolve, reject) => {
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
      return Promise.resolve();
    }

    return Promise.fromCallback(callback => connection.end(callback));
  }

  validate(connection) {
    return connection
      && !connection._fatalError
      && !connection._protocolError
      && !connection._closing
      && !connection.stream.destroyed;
  }
}

module.exports = ConnectionManager;
module.exports.ConnectionManager = ConnectionManager;
module.exports.default = ConnectionManager;
