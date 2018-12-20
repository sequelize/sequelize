import { Deferrable } from './deferrable';
import { Logging } from './model';
import { Promise } from './promise';
import { Sequelize } from './sequelize';

/**
 * The transaction object is used to identify a running transaction. It is created by calling
 * `Sequelize.transaction()`.
 *
 * To run a query under a transaction, you should pass the transaction in the options object.
 */
export class Transaction {
  constructor(sequelize: Sequelize, options: TransactionOptions);

  /**
   * Commit the transaction
   */
  public commit(): Promise<void>;

  /**
   * Rollback (abort) the transaction
   */
  public rollback(): Promise<void>;

  /**
   * Adds hook that is run after a transaction is committed
   */
  public afterCommit(fn: (transaction: this) => void | Promise<void>): void;
}

// tslint:disable-next-line no-namespace
export namespace Transaction {
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
   * return sequelize.transaction({isolationLevel: Sequelize.Transaction.SERIALIZABLE}, transaction => {
   *
   *  // your transactions
   *
   * }).then(result => {
   *   // transaction has been committed. Do something after the commit if required.
   * }).catch(err => {
   *   // do something with the err.
   * });
   * ```
   */
  const enum ISOLATION_LEVELS {
    READ_UNCOMMITTED = 'READ UNCOMMITTED',
    READ_COMMITTED = 'READ COMMITTED',
    REPEATABLE_READ = 'REPEATABLE READ',
    SERIALIZABLE = 'SERIALIZABLE',
  }

  const enum TYPES {
    DEFERRED = 'DEFERRED',
    IMMEDIATE = 'IMMEDIATE',
    EXCLUSIVE = 'EXCLUSIVE',
  }

  /**
   * Possible options for row locking. Used in conjunction with `find` calls:
   *
   * ```js
   * t1 // is a transaction
   * t1.LOCK.UPDATE,
   * t1.LOCK.SHARE,
   * t1.LOCK.KEY_SHARE, // Postgres 9.3+ only
   * t1.LOCK.NO_KEY_UPDATE // Postgres 9.3+ only
   * ```
   *
   * Usage:
   * ```js
   * t1 // is a transaction
   * Model.findAll({
   *   where: ...,
   *   transaction: t1,
   *   lock: t1.LOCK...
   * });
   * ```
   *
   * Postgres also supports specific locks while eager loading by using OF:
   * ```js
   * UserModel.findAll({
   *   where: ...,
   *   include: [TaskModel, ...],
   *   transaction: t1,
   *   lock: {
   *   level: t1.LOCK...,
   *   of: UserModel
   *   }
   * });
   * ```
   * UserModel will be locked but TaskModel won't!
   */
  const enum LOCK {
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
}

/**
 * Options provided when the transaction is created
 */
export interface TransactionOptions extends Logging {
  autocommit?: boolean;
  isolationLevel?: Transaction.ISOLATION_LEVELS;
  type?: Transaction.TYPES;
  deferrable?: string | Deferrable;
}

export default Transaction;
