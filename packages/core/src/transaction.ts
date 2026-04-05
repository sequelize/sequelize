import type { StrictRequiredBy } from '@sequelize/utils';
import { EMPTY_OBJECT } from '@sequelize/utils';
import assert from 'node:assert';
import type { Class } from 'type-fest';
import type { AbstractConnection, ConstraintChecking, Logging, Sequelize } from './index.js';

type TransactionCallback = (transaction: Transaction) => void | Promise<void>;

/**
 * This an option for {@link QueryRawOptions} which indicates if the query completes the transaction
 *
 * @private do not expose outside sequelize
 */
export const COMPLETES_TRANSACTION = Symbol('completesTransaction');

/**
 * The transaction object is used to identify a running transaction.
 * It is created by calling `Sequelize.transaction()`.
 * To run a query under a transaction, you should pass the transaction in the options object.
 *
 * @class Transaction
 * @see {Sequelize.transaction}
 */
export class Transaction {
  sequelize: Sequelize;

  readonly #afterCommitHooks = new Set<TransactionCallback>();
  readonly #afterRollbackHooks = new Set<TransactionCallback>();
  readonly #afterHooks = new Set<TransactionCallback>();

  readonly #name: string;
  readonly #savepoints = new Map<string, Transaction>();
  readonly options: Readonly<NormalizedTransactionOptions>;
  readonly parent: Transaction | null;
  readonly id: string;
  #finished: 'commit' | 'rollback' | undefined;
  #connection: AbstractConnection | undefined;

  /**
   * Creates a new transaction instance
   *
   * @param sequelize A configured sequelize Instance
   * @param options The transaction options.
   */
  constructor(sequelize: Sequelize, options: TransactionOptions) {
    this.sequelize = sequelize;

    // get dialect specific transaction options
    const generateTransactionId = this.sequelize.dialect.queryGenerator.generateTransactionId;

    const normalizedOptions = normalizeTransactionOptions(this.sequelize, options);
    this.parent = normalizedOptions.transaction ?? null;
    delete normalizedOptions.transaction;

    this.options = Object.freeze(normalizedOptions);

    if (this.parent) {
      this.id = this.parent.id;
      this.#name = `${this.id}-sp-${this.parent.#savepoints.size}`;
      this.parent.#savepoints.set(this.#name, this);
    } else {
      const id = generateTransactionId();
      this.id = id;
      this.#name = id;
    }
  }

  get finished(): 'commit' | 'rollback' | undefined {
    return this.#finished;
  }

  getConnection(): AbstractConnection {
    if (!this.#connection) {
      throw new Error('This transaction is not bound to a connection.');
    }

    return this.#connection;
  }

  getConnectionIfExists(): AbstractConnection | undefined {
    return this.#connection;
  }

  /**
   * Commit the transaction.
   */
  async commit(): Promise<void> {
    if (this.#finished) {
      throw new Error(
        `Transaction cannot be committed because it has been finished with state: ${this.#finished}`,
      );
    }

    this.#finished = 'commit';
    if (this.parent) {
      // Savepoints cannot be committed
      return;
    }

    try {
      await this.sequelize.queryInterface._commitTransaction(this, this.options);

      await this.#dispatchHooks(this.#afterCommitHooks);
      await this.#dispatchHooks(this.#afterHooks);

      this.#cleanup();
    } catch (error) {
      console.warn(
        `Committing transaction ${this.id} failed with error ${error instanceof Error ? JSON.stringify(error.message) : String(error)}. We are killing its connection as it is now in an undetermined state.`,
      );
      await this.#forceCleanup();

      throw error;
    } finally {
      this.#finished = 'commit';
    }
  }

  /**
   * Rollback (abort) the transaction
   */
  async rollback(): Promise<void> {
    if (this.#finished) {
      throw new Error(
        `Transaction cannot be rolled back because it has been finished with state: ${this.finished}`,
      );
    }

    if (!this.#connection) {
      throw new Error('Transaction cannot be rolled back because it never started');
    }

    this.#finished = 'rollback';
    try {
      if (this.parent) {
        await this.sequelize.queryInterface._rollbackSavepoint(this.parent, {
          ...this.options,
          savepointName: this.#name,
        });
      } else {
        await this.sequelize.queryInterface._rollbackTransaction(this, this.options);
      }

      await this.#dispatchHooks(this.#afterRollbackHooks);
      await this.#dispatchHooks(this.#afterHooks);

      this.#cleanup();
    } catch (error) {
      console.warn(
        `Rolling back transaction ${this.id} failed with error ${error instanceof Error ? JSON.stringify(error.message) : String(error)}. We are killing its connection as it is now in an undetermined state.`,
      );
      await this.#forceCleanup();

      throw error;
    }
  }

  async #dispatchHooks(hooks: Set<TransactionCallback>): Promise<void> {
    for (const hook of hooks) {
      // eslint-disable-next-line no-await-in-loop -- sequentially call hooks
      await Reflect.apply(hook, this, [this]);
    }
  }

  /**
   * Called to acquire a connection to use and set the correct options on the connection.
   * We should ensure all the environment that's set up is cleaned up in `cleanup()` below.
   */
  async prepareEnvironment(): Promise<void> {
    let connection;
    if (this.parent) {
      connection = this.parent.#connection;
    } else {
      connection = await this.sequelize.pool.acquire({
        type: this.options.readOnly ? 'read' : 'write',
      });
    }

    assert(connection != null, 'Transaction failed to acquire Connection.');

    connection.uuid = this.id;

    this.#connection = connection;

    try {
      await this.#begin();
      await this.#setDeferrable();
    } catch (error) {
      try {
        await this.rollback();
      } finally {
        throw error; // eslint-disable-line no-unsafe-finally -- while this will mask the error thrown by `rollback`, the previous error is more important.
      }
    }
  }

  async #setDeferrable(): Promise<void> {
    if (this.options.constraintChecking) {
      await this.sequelize.queryInterface.deferConstraints(this.options.constraintChecking, {
        transaction: this,
      });
    }
  }

  /**
   * Changes the isolation level of the transaction.
   *
   * @param isolationLevel
   */
  async setIsolationLevel(isolationLevel: IsolationLevel): Promise<void> {
    await this.sequelize.queryInterface._setIsolationLevel(this, {
      ...this.options,
      isolationLevel,
    });
  }

  /**
   * Begins a transaction
   */
  async #begin(): Promise<void> {
    const queryInterface = this.sequelize.queryInterface;

    if (this.parent) {
      return queryInterface._createSavepoint(this.parent, {
        ...this.options,
        savepointName: this.#name,
      });
    }

    await queryInterface._startTransaction(this, {
      ...this.options,
      readOnly: this.sequelize.dialect.supports.startTransaction.readOnly
        ? this.options.readOnly
        : false,
      transactionName: this.#name,
    });
  }

  #cleanup(): void {
    // Don't release the connection if there's a parent transaction or
    // if we've already cleaned up
    if (this.parent || this.#connection?.uuid === undefined) {
      return;
    }

    this.sequelize.pool.release(this.#connection);
    this.#connection.uuid = undefined;
    this.#connection = undefined;
  }

  /**
   * Kills the connection this transaction uses.
   * Used as a last resort, for instance because COMMIT or ROLLBACK resulted in an error
   * and the transaction is left in a broken state,
   * and releasing the connection to the pool would be dangerous.
   */
  async #forceCleanup(): Promise<void> {
    // Don't release the connection if there's a parent transaction or
    // if we've already cleaned up
    if (this.parent || this.#connection?.uuid === undefined) {
      return;
    }

    this.#connection.uuid = undefined;

    const connection = this.#connection;
    this.#connection = undefined;

    await this.sequelize.pool.destroy(connection);
  }

  /**
   * Adds a hook that is run after a transaction is committed.
   *
   * @param callback A callback function that is called with the transaction
   */
  afterCommit(callback: TransactionCallback): this {
    if (typeof callback !== 'function') {
      throw new TypeError('"callback" must be a function');
    }

    this.#afterCommitHooks.add(callback);

    return this;
  }

  /**
   * Adds a hook that is run after a transaction is rolled back.
   *
   * @param callback A callback function that is called with the transaction
   */
  afterRollback(callback: TransactionCallback): this {
    if (typeof callback !== 'function') {
      throw new TypeError('"callback" must be a function');
    }

    this.#afterRollbackHooks.add(callback);

    return this;
  }

  /**
   * Adds a hook that is run after a transaction completes, no matter if it was committed or rolled back.
   *
   * @param callback A callback function that is called with the transaction
   */
  afterTransaction(callback: TransactionCallback): this {
    if (typeof callback !== 'function') {
      throw new TypeError('"callback" must be a function');
    }

    this.#afterHooks.add(callback);

    return this;
  }

  /**
   * Types can be set per-transaction by passing `options.type` to `sequelize.transaction`.
   * Default to `DEFERRED` but you can override the default type by passing `options.transactionType` in `new Sequelize`.
   * Sqlite only.
   *
   * Pass in the desired level as the first argument:
   *
   * @example
   * try {
   *   await sequelize.transaction({ type: Sequelize.Transaction.TYPES.EXCLUSIVE }, transaction => {
   *      // your transactions
   *   });
   *   // transaction has been committed. Do something after the commit if required.
   * } catch(err) {
   *   // do something with the err.
   * }
   *
   * @property DEFERRED
   * @property IMMEDIATE
   * @property EXCLUSIVE
   *
   * @deprecated use the {@link TransactionType} export
   */
  static get TYPES() {
    return TransactionType;
  }

  /**
   * Isolation levels can be set per-transaction by passing `options.isolationLevel` to `sequelize.transaction`.
   * Sequelize uses the default isolation level of the database, you can override this by passing `options.isolationLevel` in Sequelize constructor options.
   *
   * Pass in the desired level as the first argument:
   *
   * @example
   * try {
   *   const result = await sequelize.transaction({isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE}, transaction => {
   *     // your transactions
   *   });
   *   // transaction has been committed. Do something after the commit if required.
   * } catch(err) {
   *   // do something with the err.
   * }
   *
   * @property READ_UNCOMMITTED
   * @property READ_COMMITTED
   * @property REPEATABLE_READ
   * @property SERIALIZABLE
   *
   * @deprecated use the {@link IsolationLevel} export
   */
  static get ISOLATION_LEVELS() {
    return IsolationLevel;
  }

  /**
   * Possible options for row locking. Used in conjunction with `find` calls:
   *
   * @example
   * // t1 is a transaction
   * Model.findAll({
   *   where: ...,
   *   transaction: t1,
   *   lock: t1.LOCK...
   * });
   *
   * @example Postgres also supports specific locks while eager loading by using OF:
   * ```ts
   * UserModel.findAll({
   *   where: ...,
   *   include: [TaskModel, ...],
   *   transaction: t1,
   *   lock: {
   *     level: t1.LOCK...,
   *     of: UserModel
   *   }
   * });
   * ```
   *
   * UserModel will be locked but TaskModel won't!
   *
   * @example You can also skip locked rows:
   * ```ts
   * // t1 is a transaction
   * Model.findAll({
   *   where: ...,
   *   transaction: t1,
   *   lock: true,
   *   skipLocked: true
   * });
   * ```
   *
   * The query will now return any rows that aren't locked by another transaction
   *
   * @returns possible options for row locking
   * @property UPDATE
   * @property SHARE
   * @property KEY_SHARE Postgres 9.3+ only
   * @property NO_KEY_UPDATE Postgres 9.3+ only
   *
   * @deprecated use the {@link Lock} export
   */
  static get LOCK() {
    return Lock;
  }

  /**
   * Same as {@link Transaction.LOCK}, but can also be called on instances of
   * transactions to get possible options for row locking directly from the
   * instance.
   *
   * @deprecated use the {@link Lock} export
   */
  get LOCK() {
    return Lock;
  }

  /**
   * Get the root transaction if nested, or self if this is a root transaction
   */
  get rootTransaction(): Transaction {
    if (this.parent !== null) {
      return this.parent.rootTransaction;
    }

    return this;
  }
}

/**
 * Isolations levels can be set per-transaction by passing `options.isolationLevel` to `sequelize.transaction`.
 * Default to `REPEATABLE_READ` but you can override the default isolation level by passing `options.isolationLevel` in `new Sequelize`.
 *
 * The possible isolations levels to use when starting a transaction:
 *
 * ```js
 * {
 *   READ_UNCOMMITTED: "READ UNCOMMITTED",
 *   READ_COMMITTED: "READ COMMITTED",
 *   REPEATABLE_READ: "REPEATABLE READ",
 *   SERIALIZABLE: "SERIALIZABLE"
 * }
 * ```
 *
 * Pass in the desired level as the first argument:
 *
 * ```js
 * try {
 *   await sequelize.transaction({isolationLevel: Sequelize.Transaction.SERIALIZABLE}, transaction => {
 *      // your transactions
 *   });
 *   // transaction has been committed. Do something after the commit if required.
 * } catch(err) {
 *   // do something with the err.
 * }
 * ```
 */
export enum IsolationLevel {
  READ_UNCOMMITTED = 'READ UNCOMMITTED',
  READ_COMMITTED = 'READ COMMITTED',
  REPEATABLE_READ = 'REPEATABLE READ',
  SERIALIZABLE = 'SERIALIZABLE',
}

export enum TransactionType {
  DEFERRED = 'DEFERRED',
  IMMEDIATE = 'IMMEDIATE',
  EXCLUSIVE = 'EXCLUSIVE',
}

/**
 * Possible options for row locking. Used in conjunction with `find` calls:
 *
 * Usage:
 * ```js
 * import { LOCK } from '@sequelize/core';
 *
 * Model.findAll({
 *   transaction,
 *   lock: LOCK.UPDATE,
 * });
 * ```
 *
 * Postgres also supports specific locks while eager loading by using OF:
 * ```js
 * import { LOCK } from '@sequelize/core';
 *
 * UserModel.findAll({
 *   transaction,
 *   lock: {
 *     level: LOCK.KEY_SHARE,
 *     of: UserModel,
 *   },
 * });
 * ```
 * UserModel will be locked but other models won't be!
 *
 * [Read more on transaction locks here](https://sequelize.org/docs/v7/querying/transactions/#locks)
 */
export enum Lock {
  UPDATE = 'UPDATE',
  SHARE = 'SHARE',
  /**
   * Postgres 9.3+ only
   */
  KEY_SHARE = 'KEY SHARE',
  /**
   * Postgres 9.3+ only
   */
  NO_KEY_UPDATE = 'NO KEY UPDATE',
}

export enum TransactionNestMode {
  /**
   * In this mode, nesting a transaction block in another will reuse the parent transaction
   * if its options are compatible (or throw an error otherwise).
   *
   * This is the default mode.
   */
  reuse = 'reuse',

  /**
   * In this mode, nesting a transaction block will cause the creation of a SAVEPOINT
   * on the current transaction if the options provided to the nested transaction block are compatible with the parent one.
   */
  savepoint = 'savepoint',

  /**
   * In this mode, nesting a transaction block will always create a new transaction, in a separate connection.
   * This mode is equivalent to setting the "transaction" option to "null" in the nested transaction block.
   *
   * Be very careful when using this mode, as it can easily lead to transaction deadlocks if used improperly.
   */
  separate = 'separate',
}

/**
 * Options provided when the transaction is created
 */
export interface TransactionOptions extends Logging {
  /**
   * Whether this transaction will only be used to read data.
   * Used to determine whether sequelize is allowed to use a read replication server.
   */
  readOnly?: boolean | undefined;

  /**
   * Sets the isolation level of the transaction.
   */
  isolationLevel?: IsolationLevel | null | undefined;

  /**
   * Sets the type of the transaction. Sqlite only
   */
  type?: TransactionType | undefined;

  /**
   * Sets the constraints to be deferred or immediately checked. PostgreSQL only
   */
  constraintChecking?: ConstraintChecking | Class<ConstraintChecking> | undefined;

  /**
   * Parent transaction.
   * Will be retrieved from CLS automatically if not provided or if null.
   */
  transaction?: Transaction | null | undefined;
}

export type NormalizedTransactionOptions = StrictRequiredBy<
  Omit<TransactionOptions, 'constraintChecking' | 'type'>,
  'isolationLevel' | 'readOnly'
> & {
  constraintChecking?: ConstraintChecking | undefined;
  transactionType?: TransactionType | undefined;
};

/**
 * Options accepted by {@link Sequelize#transaction}.
 */
export interface ManagedTransactionOptions extends TransactionOptions {
  /**
   * How the transaction block should behave if a parent transaction block exists.
   */
  nestMode?: TransactionNestMode;
}

export function normalizeTransactionOptions(
  sequelize: Sequelize,
  options: TransactionOptions = EMPTY_OBJECT,
): NormalizedTransactionOptions {
  assertSupportedTransactionOptions(sequelize, options);

  return {
    ...options,
    transactionType:
      options.type ??
      (sequelize.dialect.supports.startTransaction.transactionType
        ? sequelize.options.transactionType
        : undefined),
    isolationLevel:
      options.isolationLevel === undefined
        ? (sequelize.options.isolationLevel ?? null)
        : options.isolationLevel,
    readOnly: options.readOnly ?? false,
    constraintChecking:
      typeof options.constraintChecking === 'function'
        ? new options.constraintChecking()
        : options.constraintChecking,
  };
}

export function assertTransactionIsCompatibleWithOptions(
  transaction: Transaction,
  options: NormalizedTransactionOptions,
) {
  if (options.isolationLevel !== transaction.options.isolationLevel) {
    throw new Error(
      `Requested isolation level (${options.isolationLevel ?? 'unspecified'}) is not compatible with the one of the existing transaction (${transaction.options.isolationLevel ?? 'unspecified'})`,
    );
  }

  if (options.readOnly !== transaction.options.readOnly) {
    throw new Error(
      `Requested a transaction in ${options.readOnly ? 'read-only' : 'read/write'} mode, which is not compatible with the existing ${transaction.options.readOnly ? 'read-only' : 'read/write'} transaction`,
    );
  }

  if (options.transactionType !== transaction.options.transactionType) {
    throw new Error(
      `Requested transaction type (${options.transactionType}) is not compatible with the one of the existing transaction (${transaction.options.transactionType})`,
    );
  }

  if (
    options.constraintChecking !== transaction.options.constraintChecking &&
    !options.constraintChecking?.isEqual(transaction.options.constraintChecking)
  ) {
    throw new Error(
      `Requested transaction constraintChecking (${options.constraintChecking ?? 'none'}) is not compatible with the one of the existing transaction (${transaction.options.constraintChecking ?? 'none'})`,
    );
  }
}

function assertSupportedTransactionOptions(
  sequelize: Sequelize,
  options: TransactionOptions | NormalizedTransactionOptions,
) {
  if (
    (('type' in options && options.type) ||
      ('transactionType' in options && options.transactionType)) &&
    !sequelize.dialect.supports.startTransaction.transactionType
  ) {
    throw new Error(`The ${sequelize.dialect.name} dialect does not support transaction types.`);
  }
}
