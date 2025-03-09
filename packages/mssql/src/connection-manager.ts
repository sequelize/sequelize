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
import { logger } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/logger.js';
import { removeUndefined } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/object.js';
import { isError, splitObject } from '@sequelize/utils';
import * as Tedious from 'tedious';
import { AsyncQueue } from './_internal/async-queue.js';
import type { InlinedTediousOptions } from './_internal/connection-options.js';
import { INLINED_OPTION_NAMES } from './_internal/connection-options.js';
import { ASYNC_QUEUE } from './_internal/symbols.js';
import type { MsSqlDialect } from './dialect.js';

const debug = logger.debugContext('connection:mssql');
const debugTedious = logger.debugContext('connection:mssql:tedious');

export interface MsSqlConnection extends AbstractConnection, Tedious.Connection {
  // custom properties we attach to the connection
  [ASYNC_QUEUE]: AsyncQueue;
}

export type MsSqlConnectionOptions = Partial<Omit<Tedious.ConnectionConfiguration, 'options'>> &
  // We inline "options" with the other options, so we can allowlist them.
  InlinedTediousOptions;

export type TediousModule = typeof Tedious;

export class MsSqlConnectionManager extends AbstractConnectionManager<
  MsSqlDialect,
  MsSqlConnection
> {
  readonly #lib: TediousModule;

  constructor(dialect: MsSqlDialect) {
    super(dialect);
    this.#lib = dialect.options.tediousModule ?? Tedious;
  }

  async connect(connectionOptions: ConnectionOptions<MsSqlDialect>): Promise<MsSqlConnection> {
    const [inlinedOptions, regularOptions] = splitObject(connectionOptions, INLINED_OPTION_NAMES);

    const tediousConfig: Partial<Tedious.ConnectionConfiguration> = {
      ...regularOptions,
      options: removeUndefined(inlinedOptions),
    };

    try {
      return await new Promise((resolve, reject) => {
        const connection: MsSqlConnection = new this.#lib.Connection(
          tediousConfig as Tedious.ConnectionConfiguration,
        ) as MsSqlConnection;
        if (connection.state === connection.STATE.INITIALIZED) {
          connection.connect();
        }

        connection[ASYNC_QUEUE] = new AsyncQueue();

        const connectHandler = (error: unknown) => {
          connection.removeListener('end', endHandler);
          connection.removeListener('error', errorHandler);

          if (error) {
            return void reject(error);
          }

          debug('connection acquired');
          resolve(connection);
        };

        const endHandler = () => {
          connection.removeListener('connect', connectHandler);
          connection.removeListener('error', errorHandler);
          reject(new Error('Connection was closed by remote server'));
        };

        const errorHandler = (error: unknown) => {
          connection.removeListener('connect', connectHandler);
          connection.removeListener('end', endHandler);
          reject(error);
        };

        connection.once('error', errorHandler);
        connection.once('end', endHandler);
        connection.once('connect', connectHandler);

        /*
         * Permanently attach this event before connection is even acquired
         * tedious sometime emits error even after connect(with error).
         *
         * If we dont attach this even that unexpected error event will crash node process
         *
         * E.g. connectTimeout is set higher than requestTimeout
         */
        connection.on('error', (error: unknown) => {
          if (
            isErrorWithStringCode(error) &&
            (error.code === 'ESOCKET' || error.code === 'ECONNRESET')
          ) {
            void this.sequelize.pool.destroy(connection);
          }
        });

        if (tediousConfig.options?.debug) {
          connection.on('debug', debugTedious.log.bind(debugTedious));
        }
      });
    } catch (error: unknown) {
      isError.assert(error);

      if (!isErrorWithStringCode(error)) {
        throw new ConnectionError(error);
      }

      switch (error.code) {
        case 'ESOCKET':
          if (error.message.includes('connect EHOSTUNREACH')) {
            throw new HostNotReachableError(error);
          }

          if (error.message.includes('connect ENETUNREACH')) {
            throw new HostNotReachableError(error);
          }

          if (error.message.includes('connect EADDRNOTAVAIL')) {
            throw new HostNotReachableError(error);
          }

          if (error.message.includes('getaddrinfo ENOTFOUND')) {
            throw new HostNotFoundError(error);
          }

          if (error.message.includes('connect ECONNREFUSED')) {
            throw new ConnectionRefusedError(error);
          }

          throw new ConnectionError(error);
        case 'ER_ACCESS_DENIED_ERROR':
        case 'ELOGIN':
          throw new AccessDeniedError(error);
        case 'EINVAL':
          throw new InvalidConnectionError(error);
        default:
          throw new ConnectionError(error);
      }
    }
  }

  async disconnect(connection: MsSqlConnection): Promise<void> {
    // Don't disconnect a connection that is already disconnected
    if (connection.closed) {
      return;
    }

    connection[ASYNC_QUEUE].close();

    await new Promise<void>(resolve => {
      connection.on('end', resolve);
      connection.close();
      debug('connection closed');
    });
  }

  validate(connection: MsSqlConnection) {
    return connection?.state.name === 'LoggedIn';
  }
}
