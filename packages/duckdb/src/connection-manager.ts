import type { ConnectionOptions } from '@sequelize/core';
import { AbstractConnectionManager } from '@sequelize/core';
import { DuckDbDialect } from "./dialect";
import { DatabaseCache, DuckDbConnection } from "./database-cache";

export interface DuckDbConnectionOptions {
  database: string;
  mode?: "readonly" | "readwrite";
}

export class DuckDbConnectionManager extends AbstractConnectionManager<DuckDbDialect, DuckDbConnection> {

  async connect(config: ConnectionOptions<DuckDbDialect>): Promise<DuckDbConnection> {

    return DatabaseCache.getDatabaseCache().getConnection(config.database);

    // TBD if connecting to MotherDuck, use motherduck_attach_mode=single because multiple databases are bad

  }

  async disconnect(connection: DuckDbConnection) {
    connection.closed = true;

    return DatabaseCache.getDatabaseCache().closeConnection(connection);
  }

  validate(connection: DuckDbConnection): boolean {
    return !connection.closed;
  }
}
