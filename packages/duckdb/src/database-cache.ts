import type { AbstractConnection } from '@sequelize/core';
import type { DuckDBConnection, DuckDBInstance } from '@duckdb/node-api';
import { DuckDBInstanceCache } from '@duckdb/node-api';

/**
 * Extended DuckDBConnection with Sequelize-specific properties.
 * This interface extends DuckDBConnection directly so that the same object reference
 * is used for transaction connection identity comparisons.
 */
export interface SequelizeDuckDbConnection extends AbstractConnection, DuckDBConnection {
  db_path: string;
  closed: boolean;
}

export interface CachedDatabase {
  instance: DuckDBInstance;
  count: number;
}

/**
 * Database cache that tracks connection counts for proper cleanup.
 * Uses the native DuckDBInstanceCache for instance reuse, but tracks
 * when all connections are closed so we can properly close the instance.
 */
export class DatabaseCache {
  private static _instance: DatabaseCache;
  private readonly databaseCache: Map<string, CachedDatabase>;

  private constructor() {
    this.databaseCache = new Map<string, CachedDatabase>();
  }

  static getDatabaseCache(): DatabaseCache {
    if (!DatabaseCache._instance) {
      DatabaseCache._instance = new DatabaseCache();
    }

    return DatabaseCache._instance;
  }

  async getConnection(db_path: string): Promise<SequelizeDuckDbConnection> {
    const cachedDatabase = this.databaseCache.get(db_path);

    // Reuse existing instance if we have one
    if (cachedDatabase) {
      const connection = await cachedDatabase.instance.connect();
      cachedDatabase.count++;

      const sequelizeConnection = connection as SequelizeDuckDbConnection;
      sequelizeConnection.closed = false;
      sequelizeConnection.db_path = db_path;

      return sequelizeConnection;
    }

    // Get or create instance from native cache
    const newInstance = await DuckDBInstanceCache.singleton.getOrCreateInstance(db_path, {
      custom_user_agent: 'sequelize',
    });

    this.databaseCache.set(db_path, { instance: newInstance, count: 1 });

    const connection = await newInstance.connect();
    const sequelizeConnection = connection as SequelizeDuckDbConnection;
    sequelizeConnection.closed = false;
    sequelizeConnection.db_path = db_path;

    return sequelizeConnection;
  }

  async closeConnection(connection: SequelizeDuckDbConnection): Promise<void> {
    if (connection.closed) {
      return;
    }

    connection.closed = true;

    const cachedDatabase = this.databaseCache.get(connection.db_path);
    if (cachedDatabase) {
      if (cachedDatabase.count === 1) {
        // Last connection - close the instance
        this.databaseCache.delete(connection.db_path);
        cachedDatabase.instance.closeSync();

        return;
      }

      cachedDatabase.count--;
    }

    connection.closeSync();
  }
}
