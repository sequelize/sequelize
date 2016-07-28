'use strict';

const AbstractConnectionManager = require('../abstract/connection-manager');
const SequelizeErrors = require('../../errors');
const Utils = require('../../utils');
const DataTypes = require('../../data-types').mysql;
const domain = require('domain');
const debug = Utils.getLogger().debugContext('connection:mysql');
const parserMap = new Map();

/**
 * Remove extra domain info from Error objects
 */
const cleanDomainError = (err) => {
  if (err.domain) {
    err.domainEmitter.end();
    delete err.domain;
    delete err.domainEmitter;
    delete err.domainThrown;
  }
  return err;
};

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
      return parserMap.get(field.type)(field, this.sequelize.options);
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

      // use Sequelize's bluebird Promise instance
      connectionConfig.Promise = Utils.Promise;

      return new Utils.Promise((resolve, reject) => {
        const conDomain = domain.create();

        conDomain.once('error', (err) => {
          reject(cleanDomainError(err));
          conDomain.exit();
        });

        // createConnection automatically try to connect with server
        // It can throw EventEmitter based error that can't be caught
        // like AccessDeniedError if wrong credentials used
        // So we use domains to catch those errors
        conDomain.run(() => {
          this.lib.createConnection(connectionConfig)
          .then(resolve)
          .catch((err) => {
            reject(cleanDomainError(err));
          })
          .finally(() => {
            conDomain.exit();
          });
        });
      })
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
