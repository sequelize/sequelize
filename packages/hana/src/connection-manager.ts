import type {
  Connection,
} from '@sap/hana-client';
import * as HanaClient from '@sap/hana-client';
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
import { logger } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/logger.js';
import { isError } from '@sequelize/utils';
import { isNodeError } from '@sequelize/utils/node';
import assert from 'node:assert';
import { promisify } from 'node:util';
import type { HanaDialect } from './dialect.js';

const debug = logger.debugContext('connection:hana');

export type HanaClientModule = typeof HanaClient;

export interface HanaConnection extends Connection, AbstractConnection {
  id: number;
}

export interface HanaConnectionOptions extends Omit<HanaClient.ConnectionOptions, any> {
  host?: string;
  port?: number;
  database?: string; // can be 'HXE' for HANA Express; not tenant database name
  username?: string;
  password?: string;
  hanaSchema?: string; // `schema` is used by sequelize
}

export interface HanaTypeCastValue {
  type: string;
  length: number;
  db: string;
  table: string;
  name: string;
  string(): string;
  buffer(): Buffer;
  geometry(): unknown;
}

/**
 * HANA Connection Manager
 *
 * Get connections, validate and disconnect them.
 * AbstractConnectionManager pooling use it to handle HANA specific connections
 * Use https://www.npmjs.com/package/@sap/hana-client to connect with HANA server
 *
 * @private
 */
export class HanaConnectionManager extends AbstractConnectionManager<
  HanaDialect,
  HanaConnection
> {
  readonly #lib: HanaClientModule;

  constructor(dialect: HanaDialect) {
    super(dialect);
    this.#lib = this.dialect.options.hanaClientModule ?? HanaClient;
  }

  #typecast(field: HanaTypeCastValue, next: () => void): unknown {
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
   * Connect with HANA database based on config, Handle any errors in connection
   * Set the pool handlers on connection.error
   * Also set proper timezone once connection is connected.
   *
   * @param config
   * @returns
   * @private
   */
  async connect(config: ConnectionOptions<HanaDialect>): Promise<HanaConnection> {
    assert(typeof config.port === 'number', 'port has not been normalized');

    const typeCast: ((field: any, next: () => void) => any) = (field, next) => this.#typecast(field, next);
    const connectionConfig: HanaConnectionOptions = {
      ...config,
    };

    try {
      const connection: HanaConnection = await createConnection(this.#lib, connectionConfig);

      debug('connection acquired');

      if (!this.sequelize.options.keepDefaultTimezone && this.sequelize.options.timezone) {
        // set timezone for this connection
        // but named timezone are not directly supported in mysql, so get its offset first
        let tzOffset = this.sequelize.options.timezone;
        // tzOffset = tzOffset.includes('/') ? dayjs.tz(undefined, tzOffset).format('Z') : tzOffset;
        // await promisify(cb => connection.query(`SET time_zone = '${tzOffset}'`, cb))();
      }

      const sql = 'SELECT CURRENT_CONNECTION FROM DUMMY;';
      const result: Array<{ CURRENT_CONNECTION: number }> = connection.exec(sql);
      const connectionId = result[0].CURRENT_CONNECTION;

      connection.id = connectionId;

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

  async disconnect(connection: HanaConnection) {
    if (!this.validate(connection)) {
      debug('Tried to disconnect, but connection was already closed.');

      return;
    }

    await promisify(callback => connection.disconnect(error=>callback(error, null)))();
  }

  validate(connection: HanaConnection) {
    return connection && connection.state() === 'connected';
  }
}

async function createConnection(
  lib: typeof HanaClient,
  config: HanaClient.ConnectionOptions,
): Promise<HanaConnection> {
  return new Promise((resolve, reject) => {
    const connection: HanaConnection = lib.createConnection(config) as HanaConnection;
    connection.connect({
      serverNode: `${config.host}:${config.port}`,
      uid: config.username,
      pwd: config.password,
    }, (error) => {
      if (error) {
        reject(new ConnectionError(error));
      }

      resolve(connection);
    });
  });
}
