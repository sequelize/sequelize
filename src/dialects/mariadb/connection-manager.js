'use strict';

const semver = require('semver');
const { ConnectionManager } = require('../abstract/connection-manager');
const SequelizeErrors = require('../../errors');
const { logger } = require('../../utils/logger');
const DataTypes = require('../../data-types').mariadb;
const dayjs = require('dayjs');

const debug = logger.debugContext('connection:mariadb');
const parserStore = require('../parserStore')('mariadb');

/**
 * MariaDB Connection Manager
 *
 * Get connections, validate and disconnect them.
 * AbstractConnectionManager pooling use it to handle MariaDB specific connections
 * Use https://github.com/MariaDB/mariadb-connector-nodejs to connect with MariaDB server
 *
 * @private
 */
export class MariaDbConnectionManager extends ConnectionManager {
  constructor(dialect, sequelize) {
    sequelize.config.port = sequelize.config.port || 3306;
    super(dialect, sequelize);
    this.lib = this._loadDialectModule('mariadb');
    this.refreshTypeParser(DataTypes);
  }

  static _typecast(field, next) {
    if (parserStore.get(field.type)) {
      return parserStore.get(field.type)(field, this.sequelize.options, next);
    }

    return next();
  }

  _refreshTypeParser(dataType) {
    parserStore.refresh(dataType);
  }

  _clearTypeParser() {
    parserStore.clear();
  }

  /**
   * Connect with MariaDB database based on config, Handle any errors in connection
   * Set the pool handlers on connection.error
   * Also set proper timezone once connection is connected.
   *
   * @param {object} config
   * @returns {Promise<Connection>}
   * @private
   */
  async connect(config) {
    // Named timezone is not supported in mariadb, convert to offset
    let tzOffset = this.sequelize.options.timezone;
    tzOffset = /\//.test(tzOffset) ? dayjs.tz(tzOffset).format('Z')
      : tzOffset;

    const connectionConfig = {
      host: config.host,
      port: config.port,
      user: config.username,
      password: config.password,
      database: config.database,
      timezone: tzOffset,
      typeCast: MariaDbConnectionManager._typecast.bind(this),
      bigNumberStrings: false,
      supportBigNumbers: true,
      foundRows: false,
      ...config.dialectOptions,
    };

    if (!this.sequelize.config.keepDefaultTimezone) {
      // set timezone for this connection
      if (connectionConfig.initSql) {
        if (!Array.isArray(
          connectionConfig.initSql,
        )) {
          connectionConfig.initSql = [connectionConfig.initSql];
        }

        connectionConfig.initSql.push(`SET time_zone = '${tzOffset}'`);
      } else {
        connectionConfig.initSql = `SET time_zone = '${tzOffset}'`;
      }
    }

    try {
      const connection = await this.lib.createConnection(connectionConfig);
      this.sequelize.options.databaseVersion = semver.coerce(connection.serverVersion()).version;

      debug('connection acquired');
      connection.on('error', error => {
        switch (error.code) {
          case 'ESOCKET':
          case 'ECONNRESET':
          case 'EPIPE':
          case 'PROTOCOL_CONNECTION_LOST':
            this.pool.destroy(connection);
        }
      });

      return connection;
    } catch (error) {
      switch (error.code) {
        case 'ECONNREFUSED':
          throw new SequelizeErrors.ConnectionRefusedError(error);
        case 'ER_ACCESS_DENIED_ERROR':
        case 'ER_ACCESS_DENIED_NO_PASSWORD_ERROR':
          throw new SequelizeErrors.AccessDeniedError(error);
        case 'ENOTFOUND':
          throw new SequelizeErrors.HostNotFoundError(error);
        case 'EHOSTUNREACH':
        case 'ENETUNREACH':
        case 'EADDRNOTAVAIL':
          throw new SequelizeErrors.HostNotReachableError(error);
        case 'EINVAL':
          throw new SequelizeErrors.InvalidConnectionError(error);
        default:
          throw new SequelizeErrors.ConnectionError(error);
      }
    }
  }

  async disconnect(connection) {
    // Don't disconnect connections with CLOSED state
    if (!connection.isValid()) {
      debug('connection tried to disconnect but was already at CLOSED state');

      return;
    }

    return await connection.end();
  }

  validate(connection) {
    return connection && connection.isValid();
  }
}
