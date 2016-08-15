'use strict';

const AbstractConnectionManager = require('../abstract/connection-manager');
const SequelizeErrors = require('../../errors');
const Utils = require('../../utils');
const DataTypes = require('../../data-types').mysql;
const momentTz = require('moment-timezone');
const debug = Utils.getLogger().debugContext('connection:mysql');
const parserMap = new Map();

/**
 * MySQL Connection Managger
 *
 * Get connections, validate and disconnect them.
 * AbstractConnectionManager pooling use it to handle MySQL specific connections
 * Use https://github.com/sidorares/node-mysql2 to connect with MySQL server
 *
 * @extends AbstractConnectionManager
 * @return Class<ConnectionManager>
 */

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
        throw new Error('Please install mysql2 package manually');
      }
      throw err;
    }

    this.refreshTypeParser(DataTypes);
  }

  // Update parsing when the user has added additional, custom types
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
      return parserMap.get(field.type)(field, this.sequelize.options, next);
    }
    return next();
  }

  /**
   * Connect with MySQL database based on config, Handle any errors in connection
   * Set the pool handlers on connection.error
   * Also set proper timezone once conection is connected
   *
   * @return Promise<Connection>
   */
  connect(config) {
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

    return new Utils.Promise((resolve, reject) => {
      const connection = this.lib.createConnection(connectionConfig);

        /*jshint latedef:false*/
      const errorHandler = (e) => {
          // clean up connect event if there is error
        connection.removeListener('connect', connectHandler);
        reject(e);
      };

      const connectHandler = () => {
          // clean up error event if connected
        connection.removeListener('error', errorHandler);
        resolve(connection);
      };
        /*jshint latedef:true*/

      connection.once('error', errorHandler);
      connection.once('connect', connectHandler);
    })
      .then((connection) => {

        if (config.pool.handleDisconnects) {
          // Connection to the MySQL server is usually
          // lost due to either server restart, or a
          // connection idle timeout (the wait_timeout
          // server variable configures this)
          //
          // See [stackoverflow answer](http://stackoverflow.com/questions/20210522/nodejs-mysql-error-connection-lost-the-server-closed-the-connection)
          connection.on('error', (err) => {
            if (err.code === 'PROTOCOL_CONNECTION_LOST') {
              // Remove it from read/write pool
              this.pool.destroy(connection);
            }
            debug(`connection error ${err.code}`);
          });
        }

        debug('connection acquired');
        return connection;
      })
      .then((connection) => {
        return new Utils.Promise((resolve, reject) => {
          // set timezone for this connection
          // but named timezone are not directly supported in mysql, so get its offset first
          let tzOffset = this.sequelize.options.timezone;
          tzOffset = /\//.test(tzOffset) ? momentTz.tz(tzOffset).format('Z') : tzOffset;

          connection.query(`SET time_zone = '${tzOffset}'`, (err) => {
            if (err) { reject(err); } else { resolve(connection); }
          });
        });
      })
      .catch((err) => {
        if (err.code) {
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
        } else {
          throw new SequelizeErrors.ConnectionError(err);
        }
      });
  }

  disconnect(connection) {

    // Dont disconnect connections with CLOSED state
    if (connection._closing) {
      debug('connection tried to disconnect but was already at CLOSED state');
      return Utils.Promise.resolve();
    }

    return new Utils.Promise((resolve, reject) => {
      connection.end((err) => {
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
    return connection && connection._fatalError === null && connection._protocolError === null && !connection._closing;
  }
}

Utils._.extend(ConnectionManager.prototype, AbstractConnectionManager.prototype);

module.exports = ConnectionManager;
module.exports.ConnectionManager = ConnectionManager;
module.exports.default = ConnectionManager;
