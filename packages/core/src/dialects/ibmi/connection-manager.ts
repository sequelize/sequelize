import type { Connection as OdbcConnection, NodeOdbcError } from 'odbc';
import { ConnectionRefusedError } from '../../errors/index.js';
import type { ConnectionOptions, Sequelize } from '../../sequelize.js';
import { logger } from '../../utils/logger';
import type { IBMiDialect } from './index.js';
import type { Connection } from '../abstract/connection-manager';
import { AbstractConnectionManager } from '../abstract/connection-manager';

const debug = logger.debugContext('connection:ibmi');

export interface IBMiConnection extends Connection, OdbcConnection {
  // properties of ObdcConnection, but not declared in their typings
  isConnected: boolean;
}

// TODO: once the code has been split into packages, we won't need to lazy load this anymore
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type Lib = typeof import('odbc');

export class IBMiConnectionManager extends AbstractConnectionManager<IBMiConnection> {
  private readonly lib: Lib;

  constructor(dialect: IBMiDialect, sequelize: Sequelize) {
    super(dialect, sequelize);

    this.lib = this._loadDialectModule('odbc') as Lib;
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
      connection = await this.lib.connect(connectionString) as IBMiConnection;
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
    return connection.isConnected;
  }
}
