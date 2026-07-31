'use strict';

/**
 * The transaction object is used to identify a running transaction. It is created by calling `Sequelize.transaction()`.
 *
 * To run a query under a transaction, you should pass the transaction in the options object.
 *
 * @see {@link Sequelize.transaction}
 */
class Transaction {
  /**
   * @param {Sequelize} sequelize A configured sequelize Instance
   * @param {Object} options An object with options
   * @param {Boolean} options.autocommit Sets the autocommit property of the transaction.
   * @param {String} options.type=true Sets the type of the transaction.
   * @param {String} options.isolationLevel=true Sets the isolation level of the transaction.
   * @param {String} options.deferrable Sets the constraints to be deferred or immediately checked.
   */
  constructor(sequelize, options) {
    this.sequelize = sequelize;
    this.savepoints = [];
    this._afterCommitHooks = [];

    // get dialect specific transaction options
    const transactionOptions = sequelize.dialect.supports.transactionOptions || {};
    const generateTransactionId = this.sequelize.dialect.QueryGenerator.generateTransactionId;

    this.options = Object.assign(
      {
        autocommit: transactionOptions.autocommit || null,
        type: sequelize.options.transactionType,
        isolationLevel: sequelize.options.isolationLevel,
        readOnly: false
      },
      options || {}
    );

    this.parent = this.options.transaction;
    this.id = this.parent ? this.parent.id : generateTransactionId();

    // Patch: partially mimics the “reuse” behavior in nested transactions, but reusing the parent transaction for all nested ones.
    // Ref in docs: https://sequelize.org/docs/v7/querying/transactions/#nested-transactions
    // Ref in code: https://github.com/sequelize/sequelize/blob/v7.0.0-alpha.44/packages/core/src/transaction.ts#L535
    // This modification forces all nested transactions to share the root transaction’s identifier, so that every nested transaction is really just a savepoint in the same underlying connection. E.g. instead of getting its own unique ID, it “walks up” to the root and uses that ID for all nested transactions.

    let rootTransaction = this;
    while (rootTransaction.parent) {
      rootTransaction = rootTransaction.parent;
    }

    if (this.parent) {
      this.id = rootTransaction.id;
      rootTransaction.savepoints.push(this);
      this.name = this.id + '-sp-' + rootTransaction.savepoints.length;
    } else {
      this.id = this.name = generateTransactionId();
    }

    delete this.options.transaction;
  }

  /**
   * Commit the transaction
   *
   * @return {Promise}
   */
  async commit() {
    if (this.finished) {
      throw new Error('Transaction cannot be committed because it has been finished with state: ' + this.finished);
    }

    this._clearCls();

    let result;
    try {
      result = await this.sequelize.getQueryInterface().commitTransaction(this, this.options);
    } finally {
      this.finished = 'commit';
      if (!this.parent) {
        await this.cleanup();
      }
    }

    if (this.parent) {
      // Committing a savepoint is a no-op — the work only becomes durable when the root transaction
      // commits — so hand our hooks up to the parent instead of running them here. Rolling a savepoint
      // back discards them with it, since rollback() never reads _afterCommitHooks.
      for (const hook of this._afterCommitHooks) {
        this.parent._afterCommitHooks.push(() => hook.apply(this, [this]));
      }
    } else {
      for (const hook of this._afterCommitHooks) {
        await hook.apply(this, [this]);
      }
    }

    return result;
  }

  /**
   * Rollback (abort) the transaction
   *
   * @return {Promise}
   */
  async rollback() {
    if (this.finished) {
      throw new Error('Transaction cannot be rolled back because it has been finished with state: ' + this.finished);
    }

    if (!this.connection) {
      throw new Error('Transaction cannot be rolled back because it never started');
    }

    this._clearCls();

    try {
      return await this.sequelize.getQueryInterface().rollbackTransaction(this, this.options);
    } finally {
      if (!this.parent) {
        await this.cleanup();
      }
    }
  }

  async prepareEnvironment(useCLS) {
    if (typeof useCLS === 'undefined') {
      useCLS = true;
    }

    let connection;
    if (this.parent) {
      connection = this.parent.connection;
    } else {
      const acquireOptions = { uuid: this.id };

      if (this.options.readOnly) {
        acquireOptions.type = 'SELECT';
      }

      connection = await this.sequelize.connectionManager.getConnection(acquireOptions);
    }

    this.connection = connection;
    this.connection.uuid = this.id;

    let result;
    try {
      await this.begin();
      await this.setDeferrable();
      await this.setIsolationLevel();

      result = await this.setAutocommit();
    } catch (setupErr) {
      await this.rollback().catch(() => {});

      throw setupErr;
    }

    if (useCLS && this.sequelize.constructor._cls) {
      this.sequelize.constructor._cls.set('transaction', this);
    }

    return result;
  }

  begin() {
    return this.sequelize.getQueryInterface().startTransaction(this, this.options);
  }

  setDeferrable() {
    if (this.options.deferrable) {
      return this.sequelize.getQueryInterface().deferConstraints(this, this.options);
    }
  }

  setAutocommit() {
    return this.sequelize.getQueryInterface().setAutocommit(this, this.options.autocommit, this.options);
  }

  setIsolationLevel() {
    return this.sequelize.getQueryInterface().setIsolationLevel(this, this.options.isolationLevel, this.options);
  }

  cleanup() {
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
   * On a nested transaction (a SAVEPOINT) the hook is deferred to the root transaction rather than run
   * when the savepoint itself commits, so it never observes work that is not yet durable. Rolling the
   * savepoint back — or any transaction it was handed up to — discards the hook without running it.
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
   * ```js
   * return sequelize.transaction({type: Sequelize.Transaction.TYPES.EXCLUSIVE}, transaction => {
   *
   *  // your transactions
   *
   * }).then(result => {
   *   // transaction has been committed. Do something after the commit if required.
   * }).catch(err => {
   *   // do something with the err.
   * });
   * ```
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
   * Isolations levels can be set per-transaction by passing `options.isolationLevel` to `sequelize.transaction`.
   * Default to `REPEATABLE_READ` but you can override the default isolation level by passing `options.isolationLevel` in `new Sequelize`.
   *
   * Pass in the desired level as the first argument:
   *
   * ```js
   * return sequelize.transaction({isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE}, transaction => {
   *
   *  // your transactions
   *
   * }).then(result => {
   *   // transaction has been committed. Do something after the commit if required.
   * }).catch(err => {
   *   // do something with the err.
   * });
   * ```
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
   *     level: t1.LOCK...,
   *     of: UserModel
   *   }
   * });
   * ```
   * UserModel will be locked but TaskModel won't!
   *
   * @return {Object}
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
   * @see {@link Transaction.LOCK}
   */
  get LOCK() {
    return Transaction.LOCK;
  }
}

module.exports = Transaction;
module.exports.Transaction = Transaction;
module.exports.default = Transaction;
