import { Database, Connection } from "duckdb-async";
import { AbstractConnection } from "@sequelize/core";

export interface DuckDbConnection extends AbstractConnection, Connection {
    db_path: string;
    closed: boolean;
}

export interface CachedDatabase {
    database: Database;
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

    async getConnection(db_path: string): Promise<DuckDbConnection> {
        const cachedDatabase = this.databaseCache.get(db_path);

        // Only one database object should be used; lightweight connections should be used when needed
        if (cachedDatabase) {

            return cachedDatabase.database.connect().then(connection => {
                cachedDatabase.count++;
                const sequelizeConnection = connection as DuckDbConnection;
                sequelizeConnection.closed = false;
                sequelizeConnection.db_path = db_path;

                return sequelizeConnection;
            });
        }

        const newDatabase = await Database.create(
            db_path,
            { 'custom_user_agent': 'sequelize' },
        );

        this.databaseCache.set(db_path, { database: newDatabase, count: 1 });

        const connection = await newDatabase.connect() as DuckDbConnection;

        connection.closed = false;
        connection.db_path = db_path;

        return connection;
    }

    async closeConnection(connection: DuckDbConnection): Promise<void> {
        if (connection.closed) {
            return;
        }

        const cachedDatabase = this.databaseCache.get(connection.db_path);
        if (cachedDatabase) {
            if (cachedDatabase.count === 1) {
                this.databaseCache.delete(connection.db_path);

                return cachedDatabase.database.close();
            }

            cachedDatabase.count--;
        }

        return connection.close();
    }

}

