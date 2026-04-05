import type { AbstractConnection, ConnectionOptions } from '@sequelize/core';
import {
  AbstractConnectionManager,
  AccessDeniedError,
  ConnectionError,
  ConnectionRefusedError,
  HostNotFoundError,
  HostNotReachableError,
  InvalidConnectionError,
} from '@sequelize/core';
import { isErrorWithStringCode } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { timeZoneToOffsetString } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/dayjs.js';
import { logger } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/logger.js';
import { removeUndefined } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/object.js';
import * as MariaDb from 'mariadb';
import semver from 'semver';
import type { MariaDbDialect } from './dialect.js';

const debug = logger.debugContext('connection:mariadb');

export type MariaDbModule = typeof MariaDb;

export interface MariaDbConnection extends AbstractConnection, MariaDb.Connection {}

export interface MariaDbConnectionOptions
  extends Omit<
    MariaDb.ConnectionConfig,
    // Can only be set by Sequelize to prevent users from making it return a format
    // that is incompatible with Sequelize
    | 'typeCast'
    // Replaced by Sequelize's global option
    | 'timezone'
    // Users cannot use MariaDB's placeholders, they use Sequelize's syntax instead
    | 'namedPlaceholders'
    | 'arrayParenthesis'

    // The following options will conflict with the format expected by Sequelize
    | 'insertIdAsNumber'
    | 'metaAsArray'
    | 'rowsAsArray'
    | 'nestTables'
    | 'dateStrings'
    | 'decimalAsNumber'
    | 'bigIntAsNumber'
    | 'supportBigNumbers'
    | 'bigNumberStrings'
    | 'autoJsonMap'
    // This option is not necessary because we do not allow using decimalAsNumber,
    // insertIdAsNumber, nor bigIntAsNumber.
    // If someone requests to enable this option, do not accept it.
    // Instead, the same feature should be added to Sequelize as a cross-dialect feature.
    | 'checkNumberRange'
    // unsafe compatibility option
    | 'permitSetMultiParamEntries'
  > {}

/**
 * MariaDB Connection Manager
 *
 * Get connections, validate and disconnect them.
 * AbstractConnectionManager pooling use it to handle MariaDB specific connections
 * Use https://github.com/MariaDB/mariadb-connector-nodejs to connect with MariaDB server
 */
export class MariaDbConnectionManager extends AbstractConnectionManager<
  MariaDbDialect,
  MariaDbConnection
> {
  readonly #lib: MariaDbModule;

  constructor(dialect: MariaDbDialect) {
    super(dialect);
    this.#lib = dialect.options.mariaDbModule ?? MariaDb;
  }

  #typeCast(field: MariaDb.FieldInfo, next: MariaDb.TypeCastNextFunction): MariaDb.TypeCastResult {
    const parser = this.dialect.getParserForDatabaseDataType(field.type);

    if (parser) {
      return parser(field) as MariaDb.TypeCastResult;
    }

    return next();
  }

  /**
   * Connect with MariaDB database based on config, Handle any errors in connection
   * Set the pool handlers on connection.error
   * Also set proper timezone once connection is connected.
   *
   * @param config
   */
  async connect(config: ConnectionOptions<MariaDbDialect>): Promise<MariaDbConnection> {
    // Named timezone is not supported in mariadb, convert to offset
    let tzOffset = this.sequelize.options.timezone;
    tzOffset = tzOffset.includes('/') ? timeZoneToOffsetString(tzOffset) : tzOffset;

    const connectionConfig: MariaDb.ConnectionConfig = removeUndefined({
      foundRows: false,
      ...config,
      timezone: tzOffset,
      typeCast: (field: MariaDb.FieldInfo, next: MariaDb.TypeCastNextFunction) =>
        this.#typeCast(field, next),
    });

    if (!this.sequelize.options.keepDefaultTimezone) {
      // set timezone for this connection
      if (connectionConfig.initSql) {
        if (!Array.isArray(connectionConfig.initSql)) {
          connectionConfig.initSql = [connectionConfig.initSql];
        }

        connectionConfig.initSql.push(`SET time_zone = '${tzOffset}'`);
      } else {
        connectionConfig.initSql = `SET time_zone = '${tzOffset}'`;
      }
    }

    try {
      const connection = await this.#lib.createConnection(connectionConfig);
      this.sequelize.setDatabaseVersion(semver.coerce(connection.serverVersion())!.version);

      debug('connection acquired');
      connection.on('error', error => {
        switch (error.code) {
          case 'ESOCKET':
          case 'ECONNRESET':
          case 'EPIPE':
          case 'PROTOCOL_CONNECTION_LOST':
            void this.sequelize.pool.destroy(connection);
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
