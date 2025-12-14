import type { AbstractConnection } from '@sequelize/core';
import type { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api';
import { DuckDBInstance as DuckDBInstanceClass } from '@duckdb/node-api';

/**
 * Extended DuckDBConnection with Sequelize-specific properties.
 * This interface extends DuckDBConnection directly so that the same object reference
 * is used for transaction connection identity comparisons.
 */
export interface SequelizeDuckDbConnection extends AbstractConnection, DuckDBConnection {
  db_path: string;
  closed: boolean;
  /** The instance wrapper - closed when the connection is closed */
  instance: DuckDBInstance;
}

/**
 * Creates connections using DuckDB's native instance cache.
 *
 * The native cache reference-counts instance wrappers and automatically
 * evicts instances when all wrappers are closed. Each connection gets
 * its own instance wrapper, so closing a connection's wrapper decrements
 * the reference count, and the instance is evicted when the last
 * connection closes.
 */
export async function getConnection(db_path: string): Promise<SequelizeDuckDbConnection> {
  // Get instance wrapper from native cache (increments ref count)
  const instance = await DuckDBInstanceClass.fromCache(db_path, {
    custom_user_agent: 'sequelize',
  });

  const connection = await instance.connect();
  const sequelizeConnection = connection as SequelizeDuckDbConnection;
  sequelizeConnection.closed = false;
  sequelizeConnection.db_path = db_path;
  sequelizeConnection.instance = instance;

  return sequelizeConnection;
}

/**
 * Closes a connection and its instance wrapper.
 * The native cache will evict the instance when all wrappers are closed.
 */
export function closeConnection(connection: SequelizeDuckDbConnection): void {
  if (connection.closed) {
    return;
  }

  connection.closed = true;
  connection.closeSync();
  connection.instance.closeSync();
}
