import type { Connection, GetConnectionOptions } from '@sequelize/core';
import { AbstractConnectionManager, ConnectionError } from '@sequelize/core';
import { logger } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/logger.js';
import { map } from '@sequelize/utils';
import { checkFileExists } from '@sequelize/utils/node';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import * as Sqlite3 from 'sqlite3';
import type { SqliteDialect } from './dialect.js';

const debug = logger.debugContext('connection:sqlite');

export type Sqlite3Module = typeof Sqlite3;

export interface SqliteConnection extends Connection, Sqlite3.Database {
  // Not declared by sqlite3's typings
  filename: string;
}

export class SqliteConnectionManager extends AbstractConnectionManager<
  SqliteDialect,
  SqliteConnection
> {
  readonly #lib: Sqlite3Module;
  private readonly connections = new Map<string, SqliteConnection>();

  constructor(dialect: SqliteDialect) {
    super(dialect);

    // We attempt to parse file location from a connection uri
    // but we shouldn't match sequelize default host.
    if (this.sequelize.options.host === 'localhost') {
      delete this.sequelize.options.host;
    }

    this.#lib = this.dialect.options.sqlite3Module ?? Sqlite3;
  }

  async _onProcessExit() {
    await Promise.all(
      map(this.connections.values(), async connection => {
        return promisify(connection.close.bind(connection))();
      }),
    );

    return super._onProcessExit();
  }

  async getConnection(options: GetConnectionOptions): Promise<SqliteConnection> {
    const connectionUuid = options.uuid || 'default';

    if (this.sequelize.options.storage && this.sequelize.options.host) {
      throw new Error('The host and storage options cannot be set at the same time');
    }

    // Using ?? instead of || is important because an empty string signals to SQLite to create a temporary disk-based database.
    const storage = this.sequelize.options.storage ?? this.sequelize.options.host ?? ':memory:';

    const inMemory = storage === ':memory:';

    const defaultReadWriteMode = this.#lib.OPEN_READWRITE | this.#lib.OPEN_CREATE;
    const readWriteMode = this.sequelize.options.dialectOptions?.mode || defaultReadWriteMode;

    const connectionCacheKey = inMemory ? ':memory:' : connectionUuid;

    if (this.connections.has(connectionCacheKey)) {
      return this.connections.get(connectionCacheKey)!;
    }

    const storageDir = path.dirname(storage);

    if (
      !inMemory &&
      (readWriteMode & this.#lib.OPEN_CREATE) !== 0 &&
      !(await checkFileExists(storageDir))
    ) {
      // automatic path provision for `options.storage`
      await fs.mkdir(storageDir, { recursive: true });
    }

    const connection = await new Promise<SqliteConnection>((resolve, reject) => {
      const connectionInstance = new this.#lib.Database(
        storage,
        readWriteMode,
        (err: Error | null) => {
          if (err) {
            return void reject(new ConnectionError(err));
          }

          debug(`connection acquired ${connectionUuid}`);
          this.connections.set(connectionCacheKey, connectionInstance);

          resolve(connectionInstance);
        },
      ) as SqliteConnection;
    });

    await this._initDatabaseVersion(connection);

    if (this.sequelize.config.password) {
      // Make it possible to define and use password for sqlite encryption plugin like sqlcipher
      connection.run(`PRAGMA KEY=${this.sequelize.escape(this.sequelize.config.password)}`);
    }

    if (this.sequelize.options.foreignKeys !== false) {
      // Make it possible to define and use foreign key constraints unless
      // explicitly disallowed. It's still opt-in per relation
      connection.run('PRAGMA FOREIGN_KEYS=ON');
    }

    return connection;
  }

  async disconnect(_connection: SqliteConnection): Promise<void> {}

  async releaseConnection(connection: SqliteConnection, force?: boolean): Promise<void> {
    if (connection.filename === ':memory:' && force !== true) {
      return;
    }

    if (connection.uuid) {
      connection.close();
      debug(`connection released ${connection.uuid}`);
      this.connections.delete(connection.uuid);
    }
  }
}
