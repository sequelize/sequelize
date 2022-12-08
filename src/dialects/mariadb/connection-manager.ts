import dayjs from 'dayjs';
import type { TypeCastResult, Connection as LibConnection, ConnectionConfig as MariaDbConnectionConfig, FieldInfo, TypeCastNextFunction } from 'mariadb';
import semver from 'semver';
import {
  AccessDeniedError, ConnectionError,
  ConnectionRefusedError,
  HostNotFoundError,
  HostNotReachableError,
  InvalidConnectionError,
} from '../../errors/index.js';
import type { Sequelize, ConnectionOptions } from '../../sequelize.js';
import { isErrorWithStringCode } from '../../utils/check.js';
import { logger } from '../../utils/logger';
import { removeUndefined } from '../../utils/object.js';
import type { Connection } from '../abstract/connection-manager';
import { AbstractConnectionManager } from '../abstract/connection-manager';
import type { MariaDbDialect } from './index.js';

const debug = logger.debugContext('connection:mariadb');

export interface MariaDbConnection extends Connection, LibConnection {}

// TODO: once the code has been split into packages, we won't need to lazy load this anymore
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type Lib = typeof import('mariadb');

/**
 * MariaDB Connection Manager
 *
 * Get connections, validate and disconnect them.
 * AbstractConnectionManager pooling use it to handle MariaDB specific connections
 * Use https://github.com/MariaDB/mariadb-connector-nodejs to connect with MariaDB server
 *
 * @private
 */
export class MariaDbConnectionManager extends AbstractConnectionManager<MariaDbConnection> {
  private readonly lib: Lib;

  constructor(dialect: MariaDbDialect, sequelize: Sequelize) {
    super(dialect, sequelize);
    this.lib = this._loadDialectModule('mariadb') as Lib;
  }

  #typeCast(field: FieldInfo, next: TypeCastNextFunction): TypeCastResult {
    const parser = this.dialect.getParserForDatabaseDataType(field.type);

    if (parser) {
      return parser(field) as TypeCastResult;
    }

    return next();
  }

  /**
   * Connect with MariaDB database based on config, Handle any errors in connection
   * Set the pool handlers on connection.error
   * Also set proper timezone once connection is connected.
   *
   * @param config
   * @returns
   * @private
   */
  async connect(config: ConnectionOptions): Promise<MariaDbConnection> {
    // Named timezone is not supported in mariadb, convert to offset
    let tzOffset = this.sequelize.options.timezone;
    tzOffset = tzOffset.includes('/') ? dayjs.tz(undefined, tzOffset).format('Z')
      : tzOffset;

    const connectionConfig: MariaDbConnectionConfig = removeUndefined({
      host: config.host,
      port: config.port ? Number(config.port) : undefined,
      user: config.username,
      password: config.password,
      database: config.database,
      timezone: tzOffset,
      bigNumberStrings: false,
      supportBigNumbers: true,
      foundRows: false,
      ...config.dialectOptions,
      typeCast: (field: FieldInfo, next: TypeCastNextFunction) => this.#typeCast(field, next),
    });

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
      this.sequelize.options.databaseVersion = semver.coerce(connection.serverVersion())!.version;

      debug('connection acquired');
      connection.on('error', error => {
        switch (error.code) {
          case 'ESOCKET':
          case 'ECONNRESET':
          case 'EPIPE':
          case 'PROTOCOL_CONNECTION_LOST':
            void this.pool.destroy(connection);
            break;
          default:
        }
      });

      return connection;
    } catch (error: unknown) {
      if (!isErrorWithStringCode(error)) {
        throw error;
      }

      switch (error.code) {
        case 'ECONNREFUSED':
          throw new ConnectionRefusedError(error);
        case 'ER_ACCESS_DENIED_ERROR':
        case 'ER_ACCESS_DENIED_NO_PASSWORD_ERROR':
          throw new AccessDeniedError(error);
        case 'ENOTFOUND':
          throw new HostNotFoundError(error);
        case 'EHOSTUNREACH':
        case 'ENETUNREACH':
        case 'EADDRNOTAVAIL':
          throw new HostNotReachableError(error);
        case 'EINVAL':
          throw new InvalidConnectionError(error);
        default:
          throw new ConnectionError(error);
      }
    }
  }

  async disconnect(connection: MariaDbConnection) {
    // Don't disconnect connections with CLOSED state
    if (!connection.isValid()) {
      debug('connection tried to disconnect but was already at CLOSED state');

      return;
    }

    await connection.end();
  }

  validate(connection: MariaDbConnection): boolean {
    return connection && connection.isValid();
  }
}
