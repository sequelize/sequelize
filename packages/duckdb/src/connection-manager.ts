import type { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api';
import { DuckDBInstance as DuckDBInstanceClass } from '@duckdb/node-api';
import type { AbstractConnection, ConnectionOptions } from '@sequelize/core';
import { AbstractConnectionManager } from '@sequelize/core';
import type { DuckDbDialect } from './dialect';

export interface DuckDbConnectionOptions {
  database: string;
  mode?: 'readonly' | 'readwrite';
}

/**
 * Extended DuckDBConnection with Sequelize-specific properties.
 * This interface extends rather than composes DuckDBConnection;
 * otherwise Sequelize transaction identity comparisons fail.
 */
export interface DuckDbConnection extends AbstractConnection, DuckDBConnection {
  db_path: string;
  closed: boolean;
  instance: DuckDBInstance;
}

export class DuckDbConnectionManager extends AbstractConnectionManager<
  DuckDbDialect,
  DuckDbConnection
> {
  /**
   * Creates a connection using DuckDB's native instance cache; this prevents conflicts
   * from multiple accesses to the same file.
   *
   * @param config - Connection configuration
   */
  async connect(config: ConnectionOptions<DuckDbDialect>): Promise<DuckDbConnection> {
    const instance = await DuckDBInstanceClass.fromCache(config.database, {
      custom_user_agent: 'sequelize',
    });

    const connection = await instance.connect();
    const duckDbConnection = connection as DuckDbConnection;
    duckDbConnection.closed = false;
    duckDbConnection.db_path = config.database;
    duckDbConnection.instance = instance;

    return duckDbConnection;
  }

  /**
   * Closes a connection and its instance reference.
   * The native cache will evict the instance when all references are released.
   *
   * @param connection - The connection to close
   */
  async disconnect(connection: DuckDbConnection) {
    if (connection.closed) {
      return;
    }

    connection.closed = true;
    connection.closeSync();
    connection.instance.closeSync();
  }

  validate(connection: DuckDbConnection): boolean {
    return !connection.closed;
  }
}
