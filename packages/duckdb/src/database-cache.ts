import type { AbstractConnection } from '@sequelize/core';
import type { DuckDBConnection } from '@duckdb/node-api';
import { DuckDBInstance } from '@duckdb/node-api';

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

    // Only one database object should be used; lightweight connections should be used when needed
    if (cachedDatabase) {
      const connection = await cachedDatabase.instance.connect();
      cachedDatabase.count++;

      // Add Sequelize properties directly to the connection object
      const sequelizeConnection = connection as SequelizeDuckDbConnection;
      sequelizeConnection.closed = false;
      sequelizeConnection.db_path = db_path;

      return sequelizeConnection;
    }

    const newInstance = await DuckDBInstance.create(db_path, { custom_user_agent: 'sequelize' });

    this.databaseCache.set(db_path, { instance: newInstance, count: 1 });

    const connection = await newInstance.connect();

    // Add Sequelize properties directly to the connection object
    const sequelizeConnection = connection as SequelizeDuckDbConnection;
    sequelizeConnection.closed = false;
    sequelizeConnection.db_path = db_path;

    return sequelizeConnection;
  }

  async closeConnection(connection: SequelizeDuckDbConnection): Promise<void> {
    if (connection.closed) {
      return;
    }

    const cachedDatabase = this.databaseCache.get(connection.db_path);
    if (cachedDatabase) {
      if (cachedDatabase.count === 1) {
        this.databaseCache.delete(connection.db_path);
        cachedDatabase.instance.closeSync();

        return;
      }

      cachedDatabase.count--;
    }

    connection.closeSync();
  }
}
