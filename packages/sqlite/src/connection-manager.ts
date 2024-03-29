import type { AbstractConnection, ConnectionOptions } from '@sequelize/core';
import { AbstractConnectionManager, ConnectionError } from '@sequelize/core';
import { logger } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/logger.js';
import { checkFileExists } from '@sequelize/utils/node';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as Sqlite3 from 'sqlite3';
import type { SqliteDialect } from './dialect.js';

const debug = logger.debugContext('connection:sqlite');

export type Sqlite3Module = typeof Sqlite3;

export interface SqliteConnection extends AbstractConnection, Sqlite3.Database {
  // Not declared by sqlite3's typings
  filename: string;
}

export interface SqliteConnectionOptions {
  /**
   * Path to the SQLite database file
   *
   * Special values:
   * - ':memory:': to use a temporary in-memory database.
   * - '': to create a temporary disk-based database.
   *
   * @default ':memory:'
   */
  storage?: string;

  /**
   * The mode to open the database connection with.
   *
   * An integer flag that can be a combination of the following values:
   * - OPEN_CREATE
   * - OPEN_READONLY
   * - OPEN_READWRITE
   * - OPEN_SHAREDCACHE
   * - OPEN_PRIVATECACHE
   * - OPEN_FULLMUTEX
   * - OPEN_URI
   *
   * This package exports each of these values
   *
   * @example
   * ```ts
   * import { SqliteDialect, OPEN_CREATE, OPEN_READWRITE } from '@sequelize/sqlite';
   *
   * new Sequelize({
   *   dialect: SqliteDialect,
   *   storage: 'db.sqlite',
   *   mode: OPEN_CREATE | OPEN_READWRITE,
   * });
   * ```
   */
  mode?: number;

  /**
   * The "PRAGMA KEY" password to use for the connection.
   */
  password?: string;
}

export {
  OPEN_CREATE,
  OPEN_FULLMUTEX,
  OPEN_PRIVATECACHE,
  OPEN_READONLY,
  OPEN_READWRITE,
  OPEN_SHAREDCACHE,
  OPEN_URI,
} from 'sqlite3';

export class SqliteConnectionManager extends AbstractConnectionManager<
  SqliteDialect,
  SqliteConnection
> {
  readonly #lib: Sqlite3Module;

  constructor(dialect: SqliteDialect) {
    super(dialect);

    this.#lib = this.dialect.options.sqlite3Module ?? Sqlite3;
  }

  async connect(options: ConnectionOptions<SqliteDialect>): Promise<SqliteConnection> {
    // Using ?? instead of || is important because an empty string signals to SQLite to create a temporary disk-based database.
    const storage = options.storage ?? ':memory:';

    const inMemory = storage === ':memory:';

    const defaultReadWriteMode = this.#lib.OPEN_READWRITE | this.#lib.OPEN_CREATE;
    const readWriteMode = options.mode ?? defaultReadWriteMode;

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

          debug(`sqlite connection acquired`);

          resolve(connectionInstance);
        },
      ) as SqliteConnection;
    });

    if (options.password) {
      // Make it possible to define and use password for sqlite encryption plugin like sqlcipher
      connection.run(`PRAGMA KEY=${this.sequelize.escape(options.password)}`);
    }

    if (this.dialect.options.foreignKeys !== false) {
      // Make it possible to define and use foreign key constraints unless
      // explicitly disallowed. It's still opt-in per relation
      connection.run('PRAGMA FOREIGN_KEYS=ON');
    }

    return connection;
  }

  async disconnect(connection: SqliteConnection): Promise<void> {
    if (connection.filename === ':memory:') {
      return;
    }

    return new Promise((resolve, reject) => {
      connection.close(err => {
        if (err) {
          return reject(err);
        }

        debug(`sqlite connection released`);

        resolve();
      });
    });
  }
}
