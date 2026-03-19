import type { AbstractConnection, ConnectionOptions } from '@sequelize/core';
import { AbstractConnectionManager, ConnectionError } from '@sequelize/core';
import { logger } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/logger.js';
import type { FirebirdDialect } from './dialect.js';

const debug = logger.debugContext('connection:firebird');

// ── node-firebird type shims ───────────────────────────────────────────────────

export interface FirebirdDatabase {
  query(
    sql: string,
    params: unknown[],
    callback: (err: Error | null, result: unknown[]) => void,
  ): void;
  sequenceTransaction(
    callback: (err: Error | null, transaction: FirebirdTransaction) => void,
  ): void;
  detach(callback?: (err: Error | null) => void): void;
}

export interface FirebirdTransaction {
  query(
    sql: string,
    params: unknown[],
    callback: (err: Error | null, result: unknown[]) => void,
  ): void;
  commit(callback?: (err: Error | null) => void): void;
  rollback(callback?: (err: Error | null) => void): void;
}

export interface FirebirdModule {
  attach(
    options: FirebirdConnectionOptions,
    callback: (err: Error | null, db: FirebirdDatabase) => void,
  ): void;
  attachOrCreate(
    options: FirebirdConnectionOptions,
    callback: (err: Error | null, db: FirebirdDatabase) => void,
  ): void;
}

// ── Connection options ─────────────────────────────────────────────────────────

export interface FirebirdConnectionOptions {
  /**
   * Hostname of the Firebird server.
   *
   * @default 'localhost'
   */
  host?: string;

  /**
   * Port of the Firebird server.
   *
   * @default 3050
   */
  port?: number;

  /**
   * Full path to the Firebird database file on the server.
   *
   * @example '/var/data/myapp.fdb'
   */
  database: string;

  /**
   * Firebird username.
   *
   * @default 'SYSDBA'
   */
  user?: string;

  /**
   * Firebird password.
   *
   * @default ''
   */
  password?: string;

  /**
   * Firebird role to connect with.
   */
  role?: string;

  /**
   * Character set to use for the connection.
   *
   * @default 'UTF8'
   */
  charset?: string;

  /**
   * Page size used when creating a new database via attachOrCreate.
   *
   * @default 4096
   */
  pageSize?: number;

  /**
   * Milliseconds between reconnect attempts on connection failure.
   *
   * @default 1000
   */
  retryConnectionInterval?: number;

  /**
   * When true, BLOB SUB_TYPE TEXT columns are returned as strings instead of
   * requiring an additional async read call.
   *
   * @default true
   */
  blobAsText?: boolean;

  /**
   * When true, all column names returned by node-firebird are lowercased.
   *
   * @default false
   */
  lowercase_keys?: boolean;
}

// ── Firebird connection (wraps a node-firebird Database) ──────────────────────

const CLOSED_SYMBOL = Symbol('closed');

export interface FirebirdConnection extends AbstractConnection, FirebirdDatabase {
  [CLOSED_SYMBOL]?: boolean;
}

// ── Connection Manager ────────────────────────────────────────────────────────

export class FirebirdConnectionManager extends AbstractConnectionManager<
  FirebirdDialect,
  FirebirdConnection
> {
  readonly #lib: FirebirdModule;

  constructor(dialect: FirebirdDialect) {
    super(dialect);
    // Allow injecting a custom node-firebird-compatible module via dialectOptions
    this.#lib =
      (this.dialect.options.firebirdModule as FirebirdModule | undefined) ??
      (require('node-firebird') as FirebirdModule);
  }

  async connect(options: ConnectionOptions<FirebirdDialect>): Promise<FirebirdConnection> {
    const connectOptions: FirebirdConnectionOptions = {
      host: options.host ?? 'localhost',
      port: options.port ?? 3050,
      database: options.database,
      user: options.user ?? 'SYSDBA',
      password: options.password ?? '',
      charset: options.charset ?? 'UTF8',
      blobAsText: options.blobAsText ?? true,
      lowercase_keys: options.lowercase_keys ?? false,
      ...(options.role !== undefined && { role: options.role }),
      ...(options.pageSize !== undefined && { pageSize: options.pageSize }),
      ...(options.retryConnectionInterval !== undefined && {
        retryConnectionInterval: options.retryConnectionInterval,
      }),
    };

    return new Promise<FirebirdConnection>((resolve, reject) => {
      this.#lib.attach(connectOptions, (err, db) => {
        if (err) {
          debug('connection error: %O', err);

          return reject(this.#translateError(err));
        }

        debug('connection acquired');
        resolve(db as FirebirdConnection);
      });
    });
  }

  validate(connection: FirebirdConnection): boolean {
    return !connection[CLOSED_SYMBOL];
  }

  async disconnect(connection: FirebirdConnection): Promise<void> {
    if (connection[CLOSED_SYMBOL]) {
      return;
    }

    return new Promise<void>((resolve, reject) => {
      connection.detach(err => {
        if (err) {
          return reject(err);
        }

        debug('connection released');
        connection[CLOSED_SYMBOL] = true;
        resolve();
      });
    });
  }

  // ── Error translation ───────────────────────────────────────────────────────

  #translateError(err: Error & { gdscode?: number }): ConnectionError {
    const msg = err.message ?? '';

    if (/connection refused/i.test(msg)) {
      const { ConnectionRefusedError } = require('@sequelize/core');

      return new ConnectionRefusedError(err);
    }

    if (/access denied/i.test(msg) || err.gdscode === 335_544_472) {
      const { AccessDeniedError } = require('@sequelize/core');

      return new AccessDeniedError(err);
    }

    if (/host not found/i.test(msg)) {
      const { HostNotFoundError } = require('@sequelize/core');

      return new HostNotFoundError(err);
    }

    if (/host not reachable/i.test(msg)) {
      const { HostNotReachableError } = require('@sequelize/core');

      return new HostNotReachableError(err);
    }

    if (/invalid connection/i.test(msg)) {
      const { InvalidConnectionError } = require('@sequelize/core');

      return new InvalidConnectionError(err);
    }

    return new ConnectionError(err);
  }
}
