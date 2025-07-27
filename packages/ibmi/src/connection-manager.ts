import type { AbstractConnection, ConnectionOptions } from '@sequelize/core';
import { AbstractConnectionManager, ConnectionRefusedError } from '@sequelize/core';
import { logger } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/logger.js';
import type { ConnectionParameters, NodeOdbcError, Connection as OdbcConnection } from 'odbc';
import * as Odbc from 'odbc';
import type { IBMiDialect } from './dialect.js';

const debug = logger.debugContext('connection:ibmi');

export type OdbcModule = typeof Odbc;

export interface IBMiConnection extends AbstractConnection, OdbcConnection {
  // properties of ObdcConnection, but not declared in their typings
  connected: boolean;
}

export interface IBMiConnectionOptions extends Omit<ConnectionParameters, 'connectionString'> {
  /**
   * Any extra ODBC connection string parts to use.
   *
   * Will be prepended to the connection string parts produced by the other options.
   */
  odbcConnectionString?: string;

  /**
   * The ODBC "DSN" part of the connection string.
   */
  dataSourceName?: string;

  /**
   * The ODBC "UID" part of the connection string.
   */
  username?: string;

  /**
   * The ODBC "PWD" part of the connection string.
   */
  password?: string;

  /**
   * The ODBC "SYSTEM" part of the connection string.
   */
  system?: string;
}

export class IBMiConnectionManager extends AbstractConnectionManager<IBMiDialect, IBMiConnection> {
  readonly #lib: OdbcModule;

  constructor(dialect: IBMiDialect) {
    super(dialect);
    this.#lib = this.dialect.options.odbcModule ?? Odbc;
  }

  async connect(config: ConnectionOptions<IBMiDialect>): Promise<IBMiConnection> {
    const connectionKeywords = [];
    if (config.odbcConnectionString) {
      connectionKeywords.push(config.odbcConnectionString);
    }

    if (config.dataSourceName) {
      connectionKeywords.push(`DSN=${config.dataSourceName}`);
    }

    if (config.username) {
      connectionKeywords.push(`UID=${config.username}`);
    }

    if (config.password) {
      connectionKeywords.push(`PWD=${config.password}`);
    }

    if (config.system) {
      connectionKeywords.push(`SYSTEM=${config.system}`);
    }

    if (connectionKeywords.length === 0) {
      throw new Error('No connection information provided.');
    }

    let connectionString: string = connectionKeywords.join(';');
    if (!connectionString.endsWith(';')) {
      connectionString += ';';
    }

    let connection;
    try {
      connection = (await this.#lib.connect(connectionString)) as IBMiConnection;
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }

      if (error.toString().includes('Error connecting to the database')) {
        throw new ConnectionRefusedError(error);
      }

      throw error;
    }

    return connection;
  }

  async disconnect(connection: IBMiConnection): Promise<void> {
    if (!this.validate(connection)) {
      debug('Tried to disconnect, but connection was already closed.');

      return;
    }

    await new Promise<void>((resolve, reject) => {
      connection.close((error: NodeOdbcError) => {
        if (error) {
          return void reject(error);
        }

        resolve();

        return undefined;
      });
    });
  }

  validate(connection: IBMiConnection): boolean {
    return connection.connected;
  }
}
