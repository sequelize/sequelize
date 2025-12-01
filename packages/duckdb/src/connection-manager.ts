import type { ConnectionOptions } from '@sequelize/core';
import { AbstractConnectionManager } from '@sequelize/core';
import type { SequelizeDuckDbConnection } from './database-cache';
import { DatabaseCache } from './database-cache';
import type { DuckDbDialect } from './dialect';

export interface DuckDbConnectionOptions {
  database: string;
  mode?: 'readonly' | 'readwrite';
}

export class DuckDbConnectionManager extends AbstractConnectionManager<
  DuckDbDialect,
  SequelizeDuckDbConnection
> {
  async connect(config: ConnectionOptions<DuckDbDialect>): Promise<SequelizeDuckDbConnection> {
    return DatabaseCache.getDatabaseCache().getConnection(config.database);
  }

  async disconnect(connection: SequelizeDuckDbConnection) {
    connection.closed = true;

    return DatabaseCache.getDatabaseCache().closeConnection(connection);
  }

  validate(connection: SequelizeDuckDbConnection): boolean {
    return !connection.closed;
  }
}
