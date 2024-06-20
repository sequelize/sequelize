import type { AbstractConnection, ConnectionOptions } from '@sequelize/core';
import {
  AbstractConnectionManager,
  ConnectionError,
  ConnectionRefusedError,
} from '@sequelize/core';
import { removeUndefined } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/object.js';
import { inspect } from '@sequelize/utils';
import type { ConnStr } from 'ibm_db';
import * as IbmDb from 'ibm_db';
import type { Db2Dialect } from './dialect.js';

export interface Db2Connection extends AbstractConnection, IbmDb.Database {}

export interface Db2ConnectionOptions {
  /**
   * ODBC "DATABASE" parameter
   */
  database?: string;

  /**
   * ODBC "HOSTNAME" parameter
   */
  hostname?: string;

  /**
   * Additional ODBC parameters. Used to build the connection string.
   */
  odbcOptions?: Record<string, string>;

  /**
   * ODBC "PWD" parameter
   */
  password?: string;

  /**
   * ODBC "PORT" parameter
   */
  port?: number | string;

  /**
   * Sets ODBC "Security" parameter to SSL
   */
  ssl?: boolean;

  /**
   * ODBC "SSLServerCertificate" parameter
   */
  sslServerCertificate?: string;

  /**
   * ODBC "UID" parameter
   */
  username?: string;
}

export type IbmDbModule = typeof IbmDb;

/**
 * DB2 Connection Manager
 *
 * Get connections, validate and disconnect them.
 * AbstractConnectionManager pooling use it to handle DB2 specific connections
 * Use https://github.com/ibmdb/node-ibm_db to connect with DB2 server
 */
export class Db2ConnectionManager extends AbstractConnectionManager<Db2Dialect, Db2Connection> {
  readonly #lib: IbmDbModule;

  constructor(dialect: Db2Dialect) {
    super(dialect);
    this.#lib = this.dialect.options.ibmDbModule ?? IbmDb;
  }

  /**
   * Connects to DB2 databases based on config.
   *
   * @param config
   */
  async connect(config: ConnectionOptions<Db2Dialect>): Promise<Db2Connection> {
    const connectionConfig: Record<string, string> = removeUndefined({
      DATABASE: config.database,
      HOSTNAME: config.hostname,
      PORT: config.port ? String(config.port) : '50000',
      UID: config.username,
      PWD: config.password,
      SSLServerCertificate: config.sslServerCertificate,
    });

    if (config.ssl) {
      connectionConfig.Security = 'SSL';
    }

    if (config.odbcOptions) {
      for (const optionName of Object.keys(config.odbcOptions)) {
        if (connectionConfig[optionName]) {
          throw new Error(
            `Key ${inspect(optionName)} in "odbcOptions" was already set by a built-in option`,
          );
        }

        connectionConfig[optionName] = config.odbcOptions[optionName];
      }
    }

    // TODO: add relevant Database options to the connection options of this dialect
    const connection: Db2Connection = new this.#lib.Database();

    return new Promise((resolve, reject) => {
      // ibm_db's typings for the OBDC connection string are missing many properties
      connection.open(connectionConfig as unknown as ConnStr, error => {
        if (error) {
          if (error.message && error.message.includes('SQL30081N')) {
            return void reject(new ConnectionRefusedError(error));
          }

          return void reject(new ConnectionError(error));
        }

        return void resolve(connection);
      });
    });
  }

  async disconnect(connection: Db2Connection) {
    // Don't disconnect a connection that is already disconnected
    if (!connection.connected) {
      return;
    }

    await connection.close();
  }

  validate(connection: Db2Connection): boolean {
    return connection.connected;
  }
}
