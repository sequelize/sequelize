import assert from 'assert';
import type { Class } from 'type-fest';
import type { Logging, Deferrable, PartlyRequired, Connection, Sequelize } from './index.js';

type AfterTransactionCommitCallback = (transaction: Transaction) => void | Promise<void>;

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

  private readonly _afterCommitHooks: Set<AfterTransactionCommitCallback> = new Set();
  private readonly savepoints: Transaction[] = [];
  private readonly options: PartlyRequired<TransactionOptions, 'type' | 'isolationLevel' | 'readOnly'>;
  readonly parent: Transaction | null;
  readonly id: string;
  readonly name: string;
  private finished: 'commit' | undefined;
  private connection: Connection | undefined;

  /**
   * Creates a new transaction instance
   *
   * @param sequelize A configured sequelize Instance
   * @param options An object with options
   * @param [options.type] Sets the type of the transaction. Sqlite only
   * @param [options.isolationLevel] Sets the isolation level of the transaction.
   * @param [options.deferrable] Sets the constraints to be deferred or immediately checked. PostgreSQL only
   */
  constructor(sequelize: Sequelize, options: TransactionOptions) {
    this.sequelize = sequelize;

    // get dialect specific transaction options
    const generateTransactionId = this.sequelize.dialect
      .queryGenerator
      .generateTransactionId;

    this.options = {
      type: sequelize.options.transactionType,
      isolationLevel: sequelize.options.isolationLevel,
      readOnly: false,
      ...options,
    };

    this.parent = this.options.transaction ?? null;

    if (this.parent) {
      this.id = this.parent.id;
      this.parent.savepoints.push(this);
      this.name = `${this.id}-sp-${this.parent.savepoints.length}`;
    } else {
      const id = generateTransactionId();
      this.id = id;
      this.name = id;
    }

    delete this.options.transaction;
  }

  /**
   * Commit the transaction.
   */
  async commit(): Promise<void> {
    if (this.finished) {
      throw new Error(`Transaction cannot be committed because it has been finished with state: ${this.finished}`);
    }

    try {
      await this.sequelize.getQueryInterface().commitTransaction(this, this.options);
      for (const hook of this._afterCommitHooks) {
        // eslint-disable-next-line no-await-in-loop -- sequentially call hooks
        await Reflect.apply(hook, this, [this]);
      }

      this.cleanup();
    } catch (error) {
      console.warn(`Committing transaction ${this.id} failed with error ${error instanceof Error ? JSON.stringify(error.message) : String(error)}. We are killing its connection as it is now in an undetermined state.`);
      await this.forceCleanup();

      throw error;
    } finally {
      this.finished = 'commit';
    }
  }

  /**
   * Rollback (abort) the transaction
   */
  async rollback(): Promise<void> {
    if (this.finished) {
      throw new Error(`Transaction cannot be rolled back because it has been finished with state: ${this.finished}`);
    }

    if (!this.connection) {
      throw new Error('Transaction cannot be rolled back because it never started');
    }

    try {
      await this
        .sequelize
        .getQueryInterface()
        .rollbackTransaction(this, this.options);

      this.cleanup();
    } catch (error) {
      console.warn(`Rolling back transaction ${this.id} failed with error ${error instanceof Error ? JSON.stringify(error.message) : String(error)}. We are killing its connection as it is now in an undetermined state.`);
      await this.forceCleanup();

      throw error;
    }
  }

  /**
   * Called to acquire a connection to use and set the correct options on the connection.
   * We should ensure all the environment that's set up is cleaned up in `cleanup()` below.
   */
  async prepareEnvironment() {
    let connection;
    if (this.parent) {
      connection = this.parent.connection;
    } else {
      connection = await this.sequelize.connectionManager.getConnection({
        type: this.options.readOnly ? 'read' : 'write',
        uuid: this.id,
      });
    }

    assert(connection != null, 'Transaction failed to acquire Connection.');

    connection.uuid = this.id;

    this.connection = connection;

    let result;
    try {
      await this.begin();

      result = await this.setDeferrable();
    } catch (error) {
      try {
        await this.rollback();
      } finally {
        throw error; // eslint-disable-line no-unsafe-finally -- while this will mask the error thrown by `rollback`, the previous error is more important.
      }
    }

    return result;
  }

  async setDeferrable(): Promise<void> {
    if (this.options.deferrable) {
      await this
        .sequelize
        .getQueryInterface()
        .deferConstraints(this, this.options);
    }
  }

  async begin() {
    const queryInterface = this.sequelize.getQueryInterface();

    if (this.sequelize.dialect.supports.settingIsolationLevelDuringTransaction) {
      await queryInterface.startTransaction(this, this.options);

      return queryInterface.setIsolationLevel(this, this.options.isolationLevel, this.options);
    }

    await queryInterface.setIsolationLevel(this, this.options.isolationLevel, this.options);

    return queryInterface.startTransaction(this, this.options);
  }

  cleanup(): void {
    // Don't release the connection if there's a parent transaction or
    // if we've already cleaned up
    if (this.parent || this.connection?.uuid === undefined) {
      return;
    }

    this.sequelize.connectionManager.releaseConnection(this.connection);
    this.connection.uuid = undefined;
  }

  /**
   * Kills the connection this transaction uses.
   * Used as a last resort, for instance because COMMIT or ROLLBACK resulted in an error
   * and the transaction is left in a broken state,
   * and releasing the connection to the pool would be dangerous.
   */
  async forceCleanup() {
    // Don't release the connection if there's a parent transaction or
    // if we've already cleaned up
    if (this.parent || this.connection?.uuid === undefined) {
      return;
    }

    await this.sequelize.connectionManager.destroyConnection(this.connection);
    this.connection.uuid = undefined;
  }

  /**
   * Adds a hook that is run after a transaction is committed.
   *
   * @param fn   A callback function that is called with the committed transaction
   * @name afterCommit
   * @memberof Sequelize.Transaction
   */
  afterCommit(fn: AfterTransactionCommitCallback): this {
    if (typeof fn !== 'function') {
      throw new TypeError('"fn" must be a function');
    }

    this._afterCommitHooks.add(fn);

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
   */
  static get TYPES() {
    return TRANSACTION_TYPES;
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
   */
  static get ISOLATION_LEVELS() {
    return ISOLATION_LEVELS;
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
   * @example <caption>Postgres also supports specific locks while eager loading by using OF:</caption>
   * UserModel.findAll({
   *   where: ...,
   *   include: [TaskModel, ...],
   *   transaction: t1,
   *   lock: {
   *     level: t1.LOCK...,
   *     of: UserModel
   *   }
   * });
   *
   * # UserModel will be locked but TaskModel won't!
   *
   * @example <caption>You can also skip locked rows:</caption>
   * // t1 is a transaction
   * Model.findAll({
   *   where: ...,
   *   transaction: t1,
   *   lock: true,
   *   skipLocked: true
   * });
   * # The query will now return any rows that aren't locked by another transaction
   *
   * @returns possible options for row locking
   * @property UPDATE
   * @property SHARE
   * @property KEY_SHARE Postgres 9.3+ only
   * @property NO_KEY_UPDATE Postgres 9.3+ only
   */
  static get LOCK() {
    return LOCK;
  }

  /**
   * Same as {@link Transaction.LOCK}, but can also be called on instances of
   * transactions to get possible options for row locking directly from the
   * instance.
   */
  get LOCK() {
    return LOCK;
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
export enum ISOLATION_LEVELS {
  READ_UNCOMMITTED = 'READ UNCOMMITTED',
  READ_COMMITTED = 'READ COMMITTED',
  REPEATABLE_READ = 'REPEATABLE READ',
  SERIALIZABLE = 'SERIALIZABLE',
}

export enum TRANSACTION_TYPES {
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
 * [Read more on transaction locks here](https://sequelize.org/docs/v7/other-topics/transactions/#locks)
 */
export enum LOCK {
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

/**
 * Options provided when the transaction is created
 */
export interface TransactionOptions extends Logging {
  readOnly?: boolean;
  autocommit?: boolean;
  isolationLevel?: ISOLATION_LEVELS;
  type?: TRANSACTION_TYPES;
  deferrable?: string | Deferrable | Class<Deferrable>;
  /**
   * Parent transaction.
   */
  transaction?: Transaction | null;
}
