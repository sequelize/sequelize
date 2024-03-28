import type { Connection, ConnectionOptions } from '@sequelize/core';
import { AbstractConnectionManager, ConnectionRefusedError } from '@sequelize/core';
import { logger } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/logger.js';
import type { NodeOdbcError, Connection as OdbcConnection } from 'odbc';
import * as Odbc from 'odbc';
import type { IBMiDialect } from './dialect.js';

const debug = logger.debugContext('connection:ibmi');

export type OdbcModule = typeof Odbc;

export interface IBMiConnection extends Connection, OdbcConnection {
  // properties of ObdcConnection, but not declared in their typings
  connected: boolean;
}

export class IBMiConnectionManager extends AbstractConnectionManager<IBMiDialect, IBMiConnection> {
  readonly #lib: OdbcModule;

  constructor(dialect: IBMiDialect) {
    super(dialect);
    this.#lib = this.dialect.options.odbcModule ?? Odbc;
  }

  async connect(config: ConnectionOptions): Promise<IBMiConnection> {
    // Combine passed connection options into a connection string
    // config.port has no real meaning for this ODBC Driver
    const connectionKeywords = [];
    if (config.dialectOptions && config.dialectOptions.odbcConnectionString) {
      connectionKeywords.push(config.dialectOptions.odbcConnectionString);
    }

    // 'database' doesn't make sense in this context, but it is mapped here to
    // DSN, which is a close fit
    if (config.database) {
      connectionKeywords.push(`DSN=${config.database}`);
    }

    if (config.username) {
      connectionKeywords.push(`UID=${config.username}`);
    }

    if (config.password) {
      connectionKeywords.push(`PWD=${config.password}`);
    }

    if (config.host) {
      connectionKeywords.push(`SYSTEM=${config.host}`);
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

        // eslint-disable-next-line unicorn/no-useless-undefined -- bad typings in OBDC
        return undefined;
      });
    });
  }

  validate(connection: IBMiConnection): boolean {
    return connection.connected;
  }
}
