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
import {
  isOffsetTimeZone,
  timeZoneToOffsetString,
} from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/dayjs.js';
import { logger } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/logger.js';
import { isError } from '@sequelize/utils';
import { isNodeError } from '@sequelize/utils/node';
import * as MySql2 from 'mysql2';
import assert from 'node:assert';
import { promisify } from 'node:util';
import type { MySqlDialect } from './dialect.js';

const debug = logger.debugContext('connection:mysql');

export type MySql2Module = typeof MySql2;

export interface MySqlConnection extends MySql2.Connection, AbstractConnection {}

export interface MySqlConnectionOptions
  extends Omit<
    MySql2.ConnectionOptions,
    // The user cannot modify these options:
    // This option is currently a global Sequelize option
    | 'timezone'
    // Conflicts with our own features
    | 'nestTables'
    // We provide our own placeholders.
    // TODO: should we use named placeholders for mysql?
    | 'namedPlaceholders'
    // We provide our own pool
    | 'pool'
    // Our code expects specific response formats, setting any of the following option would break Sequelize
    | 'typeCast'
    | 'bigNumberStrings'
    | 'supportBigNumbers'
    | 'dateStrings'
    | 'decimalNumbers'
    | 'rowsAsArray'
    | 'stringifyObjects'
    | 'queryFormat'
    | 'Promise'
    // We provide our own "url" implementation
    | 'uri'
  > {}

/**
 * MySQL Connection Manager
 *
 * Get connections, validate and disconnect them.
 * AbstractConnectionManager pooling use it to handle MySQL specific connections
 * Use https://github.com/sidorares/node-mysql2 to connect with MySQL server
 */
export class MySqlConnectionManager extends AbstractConnectionManager<
  MySqlDialect,
  MySqlConnection
> {
  readonly #lib: MySql2Module;
  readonly #sessionTimeZoneOffsets = new WeakMap<MySqlConnection, string>();

  constructor(dialect: MySqlDialect) {
    super(dialect);
    this.#lib = this.dialect.options.mysql2Module ?? MySql2;
  }

  #typecast(field: MySql2.TypeCastField, next: () => void): unknown {
    const dataParser = this.dialect.getParserForDatabaseDataType(field.type);
    if (dataParser) {
      const value = dataParser(field);

      if (value !== undefined) {
        return value;
      }
    }

    return next();
  }

  /**
   * Connect with MySQL database based on config, Handle any errors in connection
   * Set the pool handlers on connection.error
   * Also set proper timezone once connection is connected.
   *
   * @param config
   */
  async connect(config: ConnectionOptions<MySqlDialect>): Promise<MySqlConnection> {
    assert(typeof config.port === 'number', 'port has not been normalized');

    const { timezone, keepDefaultTimezone } = this.sequelize.options;

    // TODO: enable dateStrings
    const connectionConfig: MySql2.ConnectionOptions = {
      flags: ['-FOUND_ROWS'],
      port: 3306,
      ...config,
      ...(timezone && isOffsetTimeZone(timezone) ? { timezone } : null),
      bigNumberStrings: false,
      supportBigNumbers: true,
      typeCast: (field, next) => this.#typecast(field, next),
    };

    try {
      const connection: MySqlConnection = await createConnection(this.#lib, connectionConfig);

      debug('connection acquired');

      connection.on('error', (error: unknown) => {
        if (!isNodeError(error)) {
          return;
        }

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

      if (!keepDefaultTimezone && timezone) {
        const sessionTimeZoneOffset = isOffsetTimeZone(timezone)
          ? undefined
          : timeZoneToOffsetString(timezone);
        const setTimeZoneSql = this.#getSetSessionTimeZoneSql(timezone, sessionTimeZoneOffset);
        await promisify(cb => connection.query(setTimeZoneSql, cb))();

        if (sessionTimeZoneOffset !== undefined) {
          this.#sessionTimeZoneOffsets.set(connection, sessionTimeZoneOffset);
        }
      }

      return connection;
    } catch (error) {
      if (!isError(error)) {
        throw error;
      }

      const code = isNodeError(error) ? error.code : null;

      switch (code) {
        case 'ECONNREFUSED':
          throw new ConnectionRefusedError(error);
        case 'ER_ACCESS_DENIED_ERROR':
          throw new AccessDeniedError(error);
        case 'ENOTFOUND':
          throw new HostNotFoundError(error);
        case 'EHOSTUNREACH':
          throw new HostNotReachableError(error);
        case 'EINVAL':
          throw new InvalidConnectionError(error);
        default:
          throw new ConnectionError(error);
      }
    }
  }

  async disconnect(connection: MySqlConnection) {
    // @ts-expect-error -- undeclared var
    if (connection._closing) {
      debug('connection tried to disconnect but was already at CLOSED state');

      return;
    }

    await promisify(callback => connection.end(callback))();
  }

  #getSetSessionTimeZoneSql(timeZone: string, fallbackOffset: string | undefined): string {
    const { queryGenerator } = this.sequelize;
    const escapedTimeZone = queryGenerator.escape(timeZone);

    if (fallbackOffset === undefined) {
      return `SET time_zone = ${escapedTimeZone}`;
    }

    const escapedOffset = queryGenerator.escape(fallbackOffset);

    return `SET time_zone = IF(CONVERT_TZ('2000-01-01 00:00:00', '+00:00', ${escapedTimeZone}) IS NULL, ${escapedOffset}, ${escapedTimeZone})`;
  }

  #hasStaleSessionTimeZoneOffset(connection: MySqlConnection): boolean {
    const offset = this.#sessionTimeZoneOffsets.get(connection);

    return (
      offset !== undefined && offset !== timeZoneToOffsetString(this.sequelize.options.timezone)
    );
  }

  validate(connection: MySqlConnection) {
    return (
      connection &&
      // @ts-expect-error -- undeclared var
      !connection._fatalError &&
      // @ts-expect-error -- undeclared var
      !connection._protocolError &&
      // @ts-expect-error -- undeclared var
      !connection._closing &&
      // @ts-expect-error -- undeclared var
      !connection.stream.destroyed &&
      !this.#hasStaleSessionTimeZoneOffset(connection)
    );
  }
}

async function createConnection(
  lib: typeof MySql2,
  config: MySql2.ConnectionOptions,
): Promise<MySqlConnection> {
  return new Promise((resolve, reject) => {
    const connection: MySqlConnection = lib.createConnection(config) as MySqlConnection;

    const errorHandler = (e: unknown) => {
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
  });
}
