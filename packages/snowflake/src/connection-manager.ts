import type { Connection, ConnectionOptions } from '@sequelize/core';
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
import * as SnowflakeSdk from 'snowflake-sdk';
import type { SnowflakeDialect } from './dialect.js';

export type SnowflakeSdkModule = typeof SnowflakeSdk;

const debug = logger.debugContext('connection:snowflake');

export interface SnowflakeConnection extends Connection, SnowflakeSdk.Connection {}

export class SnowflakeConnectionManager extends AbstractConnectionManager<
  SnowflakeDialect,
  SnowflakeConnection
> {
  readonly #lib: SnowflakeSdkModule;

  constructor(dialect: SnowflakeDialect) {
    super(dialect);
    this.#lib = this.dialect.options.snowflakeSdkModule ?? SnowflakeSdk;
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
    const connectionConfig: SnowflakeSdk.ConnectionOptions = {
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
      const connection = this.#lib.createConnection(connectionConfig) as SnowflakeConnection;

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
        const tzOffset =
          this.sequelize.options.timezone === '+00:00'
            ? 'Etc/UTC'
            : this.sequelize.options.timezone;
        const isNamedTzOffset = tzOffset.includes('/');
        if (!isNamedTzOffset) {
          throw new Error(
            'Snowflake only supports named timezones for the sequelize "timezone" option.',
          );
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
