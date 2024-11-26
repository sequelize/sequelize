import { Database, Connection } from "duckdb-async";
import { AbstractConnection } from "@sequelize/core";

export interface DuckDbConnection extends AbstractConnection {
    connection: Connection;
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
            //console.log("@@@ connecting to existing database for path ", db_path);

            return cachedDatabase.database.connect().then(connection => {
                cachedDatabase.count++;

                return { connection, closed: false, db_path };
            });
        }

        //console.log("@@@ CREATING NEW DATABASE INSTANCE for path ", db_path);
        const newDatabase = await Database.create(
            db_path,
            { 'custom_user_agent': 'sequelize' },
        );

        this.databaseCache.set(db_path, { database: newDatabase, count: 1 });
        //console.log("@@@ added ", db_path, "; db cache contains: ", this.databaseCache);

        const connection = await newDatabase.connect();

        return { connection, closed: false, db_path: db_path };
    }

    async closeConnection(connection: DuckDbConnection): Promise<void> {
        //console.log("@@@@@@@@ CLOSE CONNECTION CALLED ", connection.db_path);
        if (connection.closed) {
            // TBD; figure out why sequelize double closes connections
            //console.log("@@@@@@@@ CLOSE CONNECTION CALLED BUT CONNECTION ALREADY CLOSED ", connection.db_path);
            return;
        }

        const cachedDatabase = this.databaseCache.get(connection.db_path);
        if (cachedDatabase) {
            if (cachedDatabase.count === 1) {
                //console.log("@@@ DELETING AND CLOSING DATABASE with path ", connection.db_path);
                this.databaseCache.delete(connection.db_path);

                return cachedDatabase.database.close();
            }

            cachedDatabase.count--;
        }

        return connection.connection.close();
    }

}

