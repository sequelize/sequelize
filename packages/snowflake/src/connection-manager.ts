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
import { isError } from '@sequelize/utils';
import * as SnowflakeSdk from 'snowflake-sdk';
import type { SnowflakeDialect } from './dialect.js';

export type SnowflakeSdkModule = typeof SnowflakeSdk;

const debug = logger.debugContext('connection:snowflake');

export interface SnowflakeConnection extends AbstractConnection, SnowflakeSdk.Connection {}

export interface SnowflakeConnectionOptions extends Omit<
  SnowflakeSdk.ConnectionOptions,
  // "region" is not used by the Snowflake SDK anymore (deprecated option)
  | 'region'
  // ensures that the dialect produces values that Sequelize expects
  | 'fetchAsString'
  | 'jsTreatIntegerAsBigInt'
  | 'representNullAsStringNull'
  | 'rowMode'
  // conflicts with Sequelize's schema option. That option will be taken from Sequelize's options instead.
  | 'schema'
  // sequelize does not support result streaming https://github.com/sequelize/sequelize/issues/10347
  | 'streamResult'
  // "oauthHttpAllowed" is deprecated in the Snowflake SDK (for testing only; use oauthRedirectUri instead)
  | 'oauthHttpAllowed'
> {}

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
   *
   * @param config
   * @returns
   * @private
   */
  async connect(config: ConnectionOptions<SnowflakeDialect>): Promise<SnowflakeConnection> {
    // Snowflake validates time zone names itself, but does not accept offsets like '+01:00'
    if (!this.sequelize.options.keepDefaultTimezone && /^[+-]\d/.test(this.#getTimeZone())) {
      throw new ConnectionError(
        new Error('Snowflake only supports named timezones for the sequelize "timezone" option.'),
      );
    }

    try {
      const snowflakeConfig: SnowflakeSdk.ConnectionOptions = removeUndefined({
        schema: this.sequelize.options.schema,
        ...config,
      });
      const connection: SnowflakeConnection = this.#lib.createConnection(snowflakeConfig);

      await new Promise((resolve, reject) => {

        if (config.authenticator != null) {
          connection.connectAsync((err) => {
            if (err) {
              return void reject(err);
            }
            resolve();
          });
        }else{
          connection.connect((err) => {
            if (err) {
              return void reject(err);
            }
            resolve();
          });
        }


       
      });

      debug('connection acquired');

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

  async initializeConnection(connection: SnowflakeConnection): Promise<void> {
    if (this.sequelize.options.keepDefaultTimezone) {
      return;
    }

    try {
      await new Promise<void>((resolve, reject) => {
        connection.execute({
          sqlText: `ALTER SESSION SET timezone = '${this.#getTimeZone()}'`,
          complete(err) {
            if (err) {
              return void reject(err);
            }

            resolve();
          },
        });
      });
    } catch (error) {
      if (!isError(error)) {
        throw error;
      }

      throw new ConnectionError(error);
    }
  }

  #getTimeZone(): string {
    // TODO: remove default timezone.
    // default value is '+00:00', put a quick workaround for it.
    return this.sequelize.options.timezone === '+00:00'
      ? 'Etc/UTC'
      : this.sequelize.options.timezone;
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
