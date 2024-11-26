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

interface CachedDatabase {
  database: Database;
  count: number;
}

export class DuckDbConnectionManager extends AbstractConnectionManager<DuckDbDialect, DuckDbConnection> {
  private readonly databaseCache: Map<string, CachedDatabase>;

  constructor(dialect: DuckDbDialect) {
    super(dialect);
    this.databaseCache = new Map<string, CachedDatabase>();
  }

  async connect(config: ConnectionOptions<DuckDbDialect>): Promise<DuckDbConnection> {

    const cachedDatabase = this.databaseCache.get(config.database);

    // Only one database object should be used; lightweight connections should be used when needed
    if (cachedDatabase) {
      return cachedDatabase.database.connect().then(connection => {
        cachedDatabase.count++;

        return { connection, closed: false, db_path: config.database || ':memory:' };
      });
    }

    const dbPromise = Database.create(
        config.database || ':memory:',
        { 'custom_user_agent': 'sequelize' },
    );

    return dbPromise.then(async (db) => {
      this.databaseCache.set(config.database, { database: db, count: 1 });

      return db.connect();
    }).then(connection => {
      return { connection, closed: false, db_path: config.database || ':memory:' };
    });

    // TBD if connecting to MotherDuck, use motherduck_attach_mode=single because multiple databases are bad

  }

  async disconnect(connection: DuckDbConnection) {
    connection.closed = true;

    // TODO: close database and remove from cache if last connection done?
    return connection.connection.close().then(async () => {
      const cachedDatabase = this.databaseCache.get(connection.db_path);
      if (cachedDatabase?.count === 1) {
        console.log("@@@ DELETING AND CLOSING DATABASE");
        this.databaseCache.delete(connection.db_path);

        return cachedDatabase.database.close();
      }
    });
  }

  validate(connection: DuckDbConnection): boolean {
    return !connection.closed;
  }
}
