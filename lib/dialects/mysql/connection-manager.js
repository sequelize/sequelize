'use strict';

const AbstractConnectionManager = require('../abstract/connection-manager');
const SequelizeErrors = require('../../errors');
const Utils = require('../../utils');
const DataTypes = require('../../data-types').mysql;

const debug = Utils.getLogger().debugContext('connection:mysql');
const parserMap = new Map();

class ConnectionManager extends AbstractConnectionManager {
  constructor(dialect, sequelize) {
    super(dialect, sequelize);

    this.sequelize = sequelize;
    this.sequelize.config.port = this.sequelize.config.port || 3306;
    try {
      if (sequelize.config.dialectModulePath) {
        this.lib = require(sequelize.config.dialectModulePath + '/promise');
      } else {
        this.lib = require('mysql2/promise');
      }
    } catch (err) {
      if (err.code === 'MODULE_NOT_FOUND') {
        throw new Error('Please install mysql2 package manually');
      }
      throw err;
    }

    this.refreshTypeParser(DataTypes);
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

  /**
   * Connect with mysql database based on config
   * Set the pool handlers when connection is closed
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

      this.lib.createConnection(connectionConfig)
      .then((connection) => {

        if (config.pool.handleDisconnects) {
          // Connection to the MySQL server is usually
          // lost due to either server restart, or a
          // connection idle timeout (the wait_timeout
          // server variable configures this)
          //
          // See [stackoverflow answer](http://stackoverflow.com/questions/20210522/nodejs-mysql-error-connection-lost-the-server-closed-the-connection)
          connection.connection.on('error', (err) => {
            if (err.code === 'PROTOCOL_CONNECTION_LOST') {
              // Remove it from read/write pool
              this.pool.destroy(connection);
            }
            debug(`connection error ${err.code}`);
          });
        }

        debug(`connection acquired`);
        return connection;
      })
      .then((connection) => {
        return connection.query(`SET time_zone = '${this.sequelize.options.timezone}'`)
        // return the actual connection object
        .then(() => connection.connection);
      })
      .catch((err) => {
        if (err.code) {
          switch (err.code) {
            case 'ECONNREFUSED':
              throw new SequelizeErrors.ConnectionRefusedError(err);
              break;
            case 'ER_ACCESS_DENIED_ERROR':
              throw new SequelizeErrors.AccessDeniedError(err);
              break;
            case 'ENOTFOUND':
              throw new SequelizeErrors.HostNotFoundError(err);
              break;
            case 'EHOSTUNREACH':
              throw new SequelizeErrors.HostNotReachableError(err);
              break;
            case 'EINVAL':
              throw new SequelizeErrors.InvalidConnectionError(err);
              break;
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
    // That wil trigger a connection error
    if (connection._closing) {
      debug(`connection tried to disconnect but was already at CLOSED state`);
      return Utils.Promise.resolve();
    }

    return new Utils.Promise((resolve, reject) => {
      connection.end((err) => {
        if (err) {
          reject(new SequelizeErrors.ConnectionError(err));
        } else {
          debug(`connection disconnected`);
          resolve();
        }
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
