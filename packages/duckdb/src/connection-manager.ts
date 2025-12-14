import type { AbstractConnection, ConnectionOptions } from '@sequelize/core';
import { AbstractConnectionManager } from '@sequelize/core';
import type { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api';
import { DuckDBInstance as DuckDBInstanceClass } from '@duckdb/node-api';
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

export class DuckDbConnectionManager extends AbstractConnectionManager<DuckDbDialect, DuckDbConnection> {
  /**
   * Creates a connection using DuckDB's native instance cache.
   *
   * The native cache uses weak references and automatically evicts
   * instances when all references are released. Each connection gets
   * its own instance reference, so closing a connection releases that
   * reference, and the instance is evicted when the last connection closes.
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
