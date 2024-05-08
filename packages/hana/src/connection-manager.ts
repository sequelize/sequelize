import assert from 'node:assert';
import { promisify } from 'node:util';
import dayjs from 'dayjs';
import type {
  Connection,
  createConnection as hanaCreateConnection,
} from '@sap/hana-client'
import {
  AccessDeniedError,
  ConnectionError,
  ConnectionRefusedError,
  HostNotFoundError,
  HostNotReachableError,
  InvalidConnectionError,
} from '@sequelize/core';
import type { AbstractConnection, ConnectionOptions, Sequelize } from '@sequelize/core';
import { isError } from '@sequelize/utils';
import { isNodeError } from '@sequelize/utils/node';
import { logger } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/logger.js';
import { AbstractConnectionManager } from '@sequelize/core';
import type { AbstractDialect } from '@sequelize/core';
import * as HanaClient from '@sap/hana-client';
import type { HanaDialect } from './dialect.js';

const debug = logger.debugContext('connection:hana');

export type HanaClientModule = typeof HanaClient;

export interface HanaConnection extends Connection, AbstractConnection {}

interface HanaClientConnectionOptions {
  // serverNode: string;
  host?: string;
  port?: number;
  // uid: string;
  // pwd: string;

  database?: string;
  username?: string;
  password?: string;
}

export interface HanaConnectionOptions
  extends Omit<
    // HanaClient.ConnectionOptions,
    HanaClientConnectionOptions,

    //todo dazhuang  need to check following options

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
 * MySQL Connection Manager
 *
 * Get connections, validate and disconnect them.
 * AbstractConnectionManager pooling use it to handle MySQL specific connections
 * Use https://github.com/sidorares/node-mysql2 to connect with MySQL server
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
   * Connect with MySQL database based on config, Handle any errors in connection
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
      ...config
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
    // @ts-expect-error -- undeclared var
    if (connection._closing) {
      debug('connection tried to disconnect but was already at CLOSED state');

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
        console.log('error connecting hana', error)
        reject(new ConnectionError(error));
      }
      console.log('connected hana')
      resolve(connection)
    });

    // const errorHandler = (e: unknown) => {
    //   // clean up connect & error event if there is error
    //   connection.removeListener('connect', connectHandler);
    //   connection.removeListener('error', connectHandler);
    //   reject(e);
    // };

    // const connectHandler = () => {
    //   // clean up error event if connected
    //   connection.removeListener('error', errorHandler);
    //   resolve(connection);
    // };

    // // don't use connection.once for error event handling here
    // // mysql2 emit error two times in case handshake was failed
    // // first error is protocol_lost and second is timeout
    // // if we will use `once.error` node process will crash on 2nd error emit
    // connection.on('error', errorHandler);
    // connection.once('connect', connectHandler);
  });
}
