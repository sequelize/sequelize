import type { ConnectionOptions } from '@sequelize/core';
import { AbstractConnectionManager } from '@sequelize/core';
import type { SequelizeDuckDbConnection } from './database-cache';
import { closeConnection, getConnection } from './database-cache';
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
    return getConnection(config.database);
  }

  async disconnect(connection: SequelizeDuckDbConnection) {
    closeConnection(connection);
  }

  validate(connection: SequelizeDuckDbConnection): boolean {
    return !connection.closed;
  }
}
