import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';
import type { Database } from 'sqlite3';
import { ConnectionError } from '../../errors/index.js';
import type { Sequelize } from '../../sequelize.js';
import { map } from '../../utils/iterators.js';
import { logger } from '../../utils/logger';
import type { Connection, GetConnectionOptions } from '../abstract/connection-manager';
import { AbstractConnectionManager } from '../abstract/connection-manager';
import type { SqliteDialect } from './index.js';

const debug = logger.debugContext('connection:sqlite');

// TODO: once the code has been split into packages, we won't need to lazy load this anymore
// eslint-disable-next-line @typescript-eslint/consistent-type-imports
type Lib = typeof import('sqlite3');

interface SqliteConnection extends Connection, Database {
  // Not declared by sqlite3's typings
  filename: string;
}

export class SqliteConnectionManager extends AbstractConnectionManager<SqliteConnection> {
  private readonly lib: Lib;
  private readonly connections = new Map<string, SqliteConnection>();

  constructor(dialect: SqliteDialect, sequelize: Sequelize) {
    super(dialect, sequelize);

    // We attempt to parse file location from a connection uri
    // but we shouldn't match sequelize default host.
    if (this.sequelize.options.host === 'localhost') {
      delete this.sequelize.options.host;
    }

    this.lib = this._loadDialectModule('sqlite3') as Lib;
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

    // Using ?? instead of || is important because an empty string signals to SQLite to create a temporary disk-based database.
    const storage = this.sequelize.options.storage
      ?? this.sequelize.options.host
      ?? ':memory:';

    const inMemory = storage === ':memory:';

    const defaultReadWriteMode = this.lib.OPEN_READWRITE | this.lib.OPEN_CREATE;
    const readWriteMode = this.sequelize.options.dialectOptions?.mode || defaultReadWriteMode;

    const connectionCacheKey = inMemory ? ':memory:' : connectionUuid;

    if (this.connections.has(connectionCacheKey)) {
      return this.connections.get(connectionCacheKey)!;
    }

    const storageDir = path.dirname(storage);

    if (!inMemory && (readWriteMode & this.lib.OPEN_CREATE) !== 0 && !fs.existsSync(storageDir)) {
      // automatic path provision for `options.storage`
      fs.mkdirSync(storageDir, { recursive: true });
    }

    const connection = await new Promise<SqliteConnection>((resolve, reject) => {
      const connectionInstance = new this.lib.Database(
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
