import type { Connection as TediousConnection, ConnectionConfig as TediousConnectionConfig } from 'tedious';
import { AsyncQueue } from './async-queue';
import type { MssqlDialect } from './index.js';
import {
  AccessDeniedError,
  ConnectionError,
  ConnectionRefusedError,
  HostNotFoundError,
  HostNotReachableError,
  InvalidConnectionError,
} from '../../errors/index.js';
import type { ConnectionOptions, Sequelize } from '../../sequelize.js';
import { assertCaughtError, isErrorWithStringCode, isPlainObject } from '../../utils/check.js';
import { logger } from '../../utils/logger';
import type { Connection } from '../abstract/connection-manager';
import { AbstractConnectionManager } from '../abstract/connection-manager';

const debug = logger.debugContext('connection:mssql');
const debugTedious = logger.debugContext('connection:mssql:tedious');

// TODO: once the code has been split into packages, we won't need to lazy load this anymore
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type Lib = typeof import('tedious');

interface TediousConnectionState {
  name: string;
}

export interface MsSqlConnection extends Connection, TediousConnection {
  // custom properties we attach to the connection
  // TODO: replace with Symbols.
  queue: AsyncQueue;
  lib: Lib;

  // undeclared tedious properties
  closed: boolean;
  loggedIn: boolean;
  state: TediousConnectionState;
  // on prototype
  STATE: Record<string, TediousConnectionState>;
}

export class MsSqlConnectionManager extends AbstractConnectionManager<MsSqlConnection> {
  lib: Lib;

  constructor(dialect: MssqlDialect, sequelize: Sequelize) {
    super(dialect, sequelize);
    this.lib = this._loadDialectModule('tedious') as Lib;
  }

  async connect(config: ConnectionOptions): Promise<MsSqlConnection> {
    const options: TediousConnectionConfig['options'] = {
      port: typeof config.port === 'string' ? Number.parseInt(config.port, 10) : config.port,
      database: config.database,
      trustServerCertificate: true,
    };

    const authentication: TediousConnectionConfig['authentication'] = {
      type: 'default',
      options: {
        userName: config.username || undefined,
        password: config.password || undefined,
      },
    };

    if (config.dialectOptions) {
      // only set port if no instance name was provided
      if (
        isPlainObject(config.dialectOptions.options)
        && config.dialectOptions.options.instanceName
      ) {
        delete options.port;
      }

      if (config.dialectOptions.authentication) {
        Object.assign(authentication, config.dialectOptions.authentication);
      }

      Object.assign(options, config.dialectOptions.options);
    }

    const connectionConfig: TediousConnectionConfig = {
      server: config.host,
      authentication,
      options,
    };

    try {
      return await new Promise((resolve, reject) => {
        const connection: MsSqlConnection = new this.lib.Connection(connectionConfig) as MsSqlConnection;
        if (connection.state === connection.STATE.INITIALIZED) {
          connection.connect();
        }

        connection.queue = new AsyncQueue();
        connection.lib = this.lib;

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
          if (isErrorWithStringCode(error) && (error.code === 'ESOCKET' || error.code === 'ECONNRESET')) {
            void this.pool.destroy(connection);
          }
        });

        if (config.dialectOptions && config.dialectOptions.debug) {
          connection.on('debug', debugTedious.log.bind(debugTedious));
        }
      });
    } catch (error: unknown) {
      assertCaughtError(error);

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

    connection.queue.close();

    await new Promise<void>(resolve => {
      connection.on('end', resolve);
      connection.close();
      debug('connection closed');
    });
  }

  validate(connection: MsSqlConnection) {
    return connection && (connection.loggedIn || connection.state.name === 'LoggedIn');
  }
}
