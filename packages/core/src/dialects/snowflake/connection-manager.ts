import type {
  Connection as SnowflakeSdkConnection,
  ConnectionOptions as SnowflakeSdkConnectionOptions,
} from 'snowflake-sdk';
import type { SnowflakeDialect } from './index.js';
import {
  AccessDeniedError,
  ConnectionError,
  ConnectionRefusedError,
  HostNotFoundError,
  HostNotReachableError,
  InvalidConnectionError,
} from '../../errors/index.js';
import type { ConnectionOptions, Sequelize } from '../../sequelize.js';
import { isErrorWithStringCode } from '../../utils/check.js';
import { logger } from '../../utils/logger';
import type { Connection } from '../abstract/connection-manager';
import { AbstractConnectionManager } from '../abstract/connection-manager';

const debug = logger.debugContext('connection:snowflake');

export interface SnowflakeConnection extends Connection, SnowflakeSdkConnection {

}

// TODO: once the code has been split into packages, we won't need to lazy load this anymore
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type Lib = typeof import('snowflake-sdk');

export class SnowflakeConnectionManager extends AbstractConnectionManager<SnowflakeConnection> {
  private readonly lib: Lib;

  constructor(dialect: SnowflakeDialect, sequelize: Sequelize) {
    super(dialect, sequelize);
    this.lib = this._loadDialectModule('snowflake-sdk') as Lib;
  }

  /**
   * Connect with a snowflake database based on config, Handle any errors in connection
   * Set the pool handlers on connection.error
   * Also set proper timezone once connection is connected.
   *
   * @param config
   * @returns
   * @private
   */
  async connect(config: ConnectionOptions): Promise<SnowflakeConnection> {
    const connectionConfig: SnowflakeSdkConnectionOptions = {
      account: config.host!,
      username: config.username!,
      password: config.password!,
      database: config.database,
      // @ts-expect-error -- snowflake specific options. They should be in dialectOptions. Do not declare them in ConnectionOptions.
      warehouse: config.warehouse,
      // @ts-expect-error -- snowflake specific options. They should be in dialectOptions. Do not declare them in ConnectionOptions.
      role: config.role,
      ...config.dialectOptions,
    };

    try {
      const connection = this.lib.createConnection(connectionConfig) as SnowflakeConnection;

      await new Promise<void>((resolve, reject) => {
        connection.connect(err => {
          if (err) {
            return void reject(err);
          }

          resolve();
        });
      });

      debug('connection acquired');

      if (!this.sequelize.config.keepDefaultTimezone) {
        // TODO: remove default timezone.
        // default value is '+00:00', put a quick workaround for it.
        const tzOffset = this.sequelize.options.timezone === '+00:00' ? 'Etc/UTC' : this.sequelize.options.timezone;
        const isNamedTzOffset = tzOffset.includes('/');
        if (!isNamedTzOffset) {
          throw new Error('Snowflake only supports named timezones for the sequelize "timezone" option.');
        }

        await new Promise<void>((resolve, reject) => {
          connection.execute({
            sqlText: `ALTER SESSION SET timezone = '${tzOffset}'`,
            complete(err) {
              if (err) {
                return void reject(err);
              }

              resolve();
            },
          });
        });
      }

      return connection;
    } catch (error) {
      if (!isErrorWithStringCode(error)) {
        throw error;
      }

      switch (error.code) {
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

  async disconnect(connection: SnowflakeConnection): Promise<void> {
    // Don't disconnect connections with CLOSED state
    if (!connection.isUp()) {
      debug('connection tried to disconnect but was already at CLOSED state');

      return;
    }

    await new Promise((resolve, reject) => {
      connection.destroy(err => {
        if (err) {
          console.error(`Unable to disconnect: ${err.message}`);
          reject(err);
        } else {
          console.error(`Disconnected connection with id: ${connection.getId()}`);
          resolve(connection.getId());
        }
      });
    });
  }

  validate(connection: SnowflakeConnection) {
    return connection.isUp();
  }
}
