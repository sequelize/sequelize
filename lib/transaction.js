'use strict';

/**
 * The transaction object is used to identify a running transaction.
 * It is created by calling `Sequelize.transaction()`.
 * To run a query under a transaction, you should pass the transaction in the options object.
 *
 * @class Transaction
 * @see {@link Sequelize.transaction}
 */
class Transaction {
  /**
   * Creates a new transaction instance
   *
   * @param {Sequelize} sequelize A configured sequelize Instance
   * @param {object} options An object with options
   * @param {string} [options.type] Sets the type of the transaction. Sqlite only
   * @param {string} [options.isolationLevel] Sets the isolation level of the transaction.
   * @param {string} [options.deferrable] Sets the constraints to be deferred or immediately checked. PostgreSQL only
   */
  constructor(sequelize, options) {
    this.sequelize = sequelize;
    this.savepoints = [];
    this._afterCommitHooks = [];

    // get dialect specific transaction options
    const generateTransactionId = this.sequelize.dialect.queryGenerator.generateTransactionId;

    this.options = {
      type: sequelize.options.transactionType,
      isolationLevel: sequelize.options.isolationLevel,
      readOnly: false,
      ...options
    };

    this.parent = this.options.transaction;

    if (this.parent) {
      this.id = this.parent.id;
      this.parent.savepoints.push(this);
      this.name = `${this.id}-sp-${this.parent.savepoints.length}`;
    } else {
      this.id = this.name = generateTransactionId();
    }

    delete this.options.transaction;
  }

  /**
   * Commit the transaction
   *
   * @returns {Promise}
   */
  async commit() {
    if (this.finished) {
      throw new Error(`Transaction cannot be committed because it has been finished with state: ${this.finished}`);
    }

    try {
      return await this.sequelize.getQueryInterface().commitTransaction(this, this.options);
    } finally {
      this.finished = 'commit';
      this.cleanup();
      for (const hook of this._afterCommitHooks) {
        await hook.apply(this, [this]);
      }
    }
  }

  /**
   * Rollback (abort) the transaction
   *
   * @returns {Promise}
   */
  async rollback() {
    if (this.finished) {
      throw new Error(`Transaction cannot be rolled back because it has been finished with state: ${this.finished}`);
    }

    if (!this.connection) {
      throw new Error('Transaction cannot be rolled back because it never started');
    }

    try {
      return await this
        .sequelize
        .getQueryInterface()
        .rollbackTransaction(this, this.options);
    } finally {
      this.cleanup();
    }
  }

  /**
   * Called to acquire a connection to use and set the correct options on the connection.
   * We should ensure all of the environment that's set up is cleaned up in `cleanup()` below.
   *
   * @param {boolean} useCLS Defaults to true: Use CLS (Continuation Local Storage) with Sequelize. With CLS, all queries within the transaction callback will automatically receive the transaction object.
   * @returns {Promise}
   */
  async prepareEnvironment(useCLS) {
    let connectionPromise;

    if (useCLS === undefined) {
      useCLS = true;
    }

    if (this.parent) {
      connectionPromise = Promise.resolve(this.parent.connection);
    } else {
      const acquireOptions = { uuid: this.id };
      if (this.options.readOnly) {
        acquireOptions.type = 'SELECT';
      }
      connectionPromise = this.sequelize.connectionManager.getConnection(acquireOptions);
    }

    let result;
    const connection = await connectionPromise;
    this.connection = connection;
    this.connection.uuid = this.id;

    try {
      await this.begin();
      result = await this.setDeferrable();
    } catch (setupErr) {
      try {
        result = await this.rollback();
      } finally {
        throw setupErr; // eslint-disable-line no-unsafe-finally
      }
    }

    if (useCLS && this.sequelize.constructor._cls) {
      this.sequelize.constructor._cls.set('transaction', this);
    }

    return result;
  }

  async setDeferrable() {
    if (this.options.deferrable) {
      return await this
        .sequelize
        .getQueryInterface()
        .deferConstraints(this, this.options);
    }
  }

  async begin() {
    const queryInterface = this.sequelize.getQueryInterface();

    if ( this.sequelize.dialect.supports.settingIsolationLevelDuringTransaction ) {
      await queryInterface.startTransaction(this, this.options);
      return queryInterface.setIsolationLevel(this, this.options.isolationLevel, this.options);
    }

    await queryInterface.setIsolationLevel(this, this.options.isolationLevel, this.options);

    return queryInterface.startTransaction(this, this.options);
  }

  cleanup() {
    // Don't release the connection if there's a parent transaction or
    // if we've already cleaned up
    if (this.parent || this.connection.uuid === undefined) return;

    this._clearCls();
    const res = this.sequelize.connectionManager.releaseConnection(this.connection);
    this.connection.uuid = undefined;
    return res;
  }

  _clearCls() {
    const cls = this.sequelize.constructor._cls;

    if (cls) {
      if (cls.get('transaction') === this) {
        cls.set('transaction', null);
      }
    }
  }

  /**
   * A hook that is run after a transaction is committed
   *
   * @param {Function} fn   A callback function that is called with the committed transaction
   * @name afterCommit
   * @memberof Sequelize.Transaction
   */
  afterCommit(fn) {
    if (!fn || typeof fn !== 'function') {
      throw new Error('"fn" must be a function');
    }
    this._afterCommitHooks.push(fn);
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
    return {
      DEFERRED: 'DEFERRED',
      IMMEDIATE: 'IMMEDIATE',
      EXCLUSIVE: 'EXCLUSIVE'
    };
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
    return {
      READ_UNCOMMITTED: 'READ UNCOMMITTED',
      READ_COMMITTED: 'READ COMMITTED',
      REPEATABLE_READ: 'REPEATABLE READ',
      SERIALIZABLE: 'SERIALIZABLE'
    };
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
   * @returns {object}
   * @property UPDATE
   * @property SHARE
   * @property KEY_SHARE Postgres 9.3+ only
   * @property NO_KEY_UPDATE Postgres 9.3+ only
   */
  static get LOCK() {
    return {
      UPDATE: 'UPDATE',
      SHARE: 'SHARE',
      KEY_SHARE: 'KEY SHARE',
      NO_KEY_UPDATE: 'NO KEY UPDATE'
    };
  }

  /**
   * Please see {@link Transaction.LOCK}
   */
  get LOCK() {
    return Transaction.LOCK;
  }
}

module.exports = Transaction;
module.exports.Transaction = Transaction;
module.exports.default = Transaction;
