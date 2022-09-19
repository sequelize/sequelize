import assert from 'assert';
import { promisify } from 'util';
import dayjs from 'dayjs';
import type { createConnection as mysqlCreateConnection, Connection, ConnectionOptions as MySqlConnectionOptions } from 'mysql2';
import {
  AccessDeniedError,
  ConnectionError,
  ConnectionRefusedError,
  HostNotFoundError,
  HostNotReachableError,
  InvalidConnectionError,
} from '../../errors';
import type { ConnectionOptions, Sequelize } from '../../sequelize.js';
import { isError, isNodeError } from '../../utils/index.js';
import { logger } from '../../utils/logger';
import type { Connection as AbstractConnection } from '../abstract/connection-manager';
import { AbstractConnectionManager } from '../abstract/connection-manager';
// eslint-disable-next-line import/order
import type { AbstractDialect } from '../abstract/index.js';

const parserStore = require('../parserStore')('mysql');

const debug = logger.debugContext('connection:mysql');

// TODO: once the code has been split into packages, we won't need to lazy load mysql2 anymore
type Lib = {
  createConnection: typeof mysqlCreateConnection,
  Connection: Connection,
};

export type MySqlConnection = Connection & AbstractConnection;

/**
 * MySQL Connection Manager
 *
 * Get connections, validate and disconnect them.
 * AbstractConnectionManager pooling use it to handle MySQL specific connections
 * Use https://github.com/sidorares/node-mysql2 to connect with MySQL server
 *
 * @private
 */
export class MySqlConnectionManager extends AbstractConnectionManager<MySqlConnection> {
  readonly #lib: Lib;

  constructor(dialect: AbstractDialect, sequelize: Sequelize) {
    super(dialect, sequelize);
    this.#lib = this._loadDialectModule('mysql2') as Lib;
  }

  #typecast(field: any, next: () => void): void {
    if (parserStore.get(field.type)) {
      return parserStore.get(field.type)(field, this.sequelize.options, next);
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
  async connect(config: ConnectionOptions): Promise<MySqlConnection> {
    assert(typeof config.port === 'number', 'port has not been normalized');

    const connectionConfig: MySqlConnectionOptions = {
      bigNumberStrings: false,
      supportBigNumbers: true,
      flags: ['-FOUND_ROWS'],
      ...config.dialectOptions,
      ...(config.host == null ? null : { host: config.host }),
      port: config.port,
      ...(config.username == null ? null : { user: config.username }),
      ...(config.password == null ? null : { password: config.password }),
      ...(config.database == null ? null : { database: config.database }),
      ...(!this.sequelize.options.timezone ? null : { timezone: this.sequelize.options.timezone }),
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
            void this.pool.destroy(connection);
            break;
          default:
        }
      });

      if (!this.sequelize.config.keepDefaultTimezone && this.sequelize.options.timezone) {
        // set timezone for this connection
        // but named timezone are not directly supported in mysql, so get its offset first
        let tzOffset = this.sequelize.options.timezone;
        tzOffset = tzOffset.includes('/') ? dayjs.tz(undefined, tzOffset).format('Z') : tzOffset;
        await promisify(cb => connection.query(`SET time_zone = '${tzOffset}'`, cb))();
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

  validate(connection: MySqlConnection) {
    return connection
      // @ts-expect-error -- undeclared var
      && !connection._fatalError
      // @ts-expect-error -- undeclared var
      && !connection._protocolError
      // @ts-expect-error -- undeclared var
      && !connection._closing
      // @ts-expect-error -- undeclared var
      && !connection.stream.destroyed;
  }
}

async function createConnection(
  lib: Lib,
  config: MySqlConnectionOptions,
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
