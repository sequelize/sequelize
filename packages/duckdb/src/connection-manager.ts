import {Connection, Database} from 'duckdb-async';
import type { AbstractConnection, ConnectionOptions } from '@sequelize/core';
import { AbstractConnectionManager } from '@sequelize/core';
import { DuckDbDialect } from "./dialect";

export interface DuckDbConnectionOptions {
  database: string;
  mode?: "readonly" | "readwrite";
}

export interface DuckDbConnection extends AbstractConnection {
  connection: Connection;
  db_path: string;
  closed: boolean;
}

export class DuckDbConnectionManager extends AbstractConnectionManager<DuckDbDialect, DuckDbConnection> {
  private readonly databaseCache: Map<string, Database>;

  constructor(dialect: DuckDbDialect) {
    super(dialect);
    this.databaseCache = new Map<string, Database>();
  }

  async connect(config: ConnectionOptions<DuckDbDialect>): Promise<DuckDbConnection> {

    const cachedDatabase = this.databaseCache.get(config.database);
    // Only one database object should be used; lightweight connections should be used when needed
    if (cachedDatabase) {
      return cachedDatabase.connect().then(connection => {
        return { connection, closed: false, db_path: config.database || ':memory:' };
      });
    }

    const dbPromise = Database.create(
        config.database || ':memory:',
        { 'custom_user_agent': 'sequelize' },
    );

    return dbPromise.then(async (db) => {
      this.databaseCache.set(config.database, db);

      return db.connect();
    }).then(connection => {
      return { connection, closed: false, db_path: config.database || ':memory:' };
    });

    // TBD if connecting to MotherDuck, use motherduck_attach_mode=single because multiple databases are bad

  }

  async disconnect(connection: DuckDbConnection) {
    connection.closed = true;

    // TODO: close database and remove from cache if last connection done?
    return connection.connection.close();
  }

  validate(connection: DuckDbConnection): boolean {
    return !connection.closed;
  }
}
