/**
 * The transaction object is used to identify a running transaction. It is created by calling `Sequelize.transaction()`.
 *
 * To run a query under a transaction, you should pass the transaction in the options object.
 *
 * @see {@link Sequelize.transaction}
 */
export class Transaction {
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

    const generateTransactionId = this.sequelize.dialect.QueryGenerator.generateTransactionId;

    this.options = Object.assign(
      {
        autocommit: null,
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

    const rootTransaction = this.rootTransaction;

    if (this.parent) {
      this.id = rootTransaction.id;
      rootTransaction.savepoints.push(this);
      this.name = this.id + '-sp-' + rootTransaction.savepoints.length;
    } else {
      this.id = this.name = generateTransactionId();
      // Savepoints currently open on this connection, innermost last. Only the root tracks this,
      // since a root transaction owns its connection exclusively.
      this._openSavepoints = [];
    }

    delete this.options.transaction;
  }

  /**
   * The outermost transaction in this chain — the one that owns the connection.
   *
   * @return {Transaction}
   */
  get rootTransaction() {
    let transaction = this;
    while (transaction.parent) {
      transaction = transaction.parent;
    }

    return transaction;
  }

  /**
   * Records this savepoint as open on the root's connection. Only tracked when savepoints are
   * released on commit, since that is the only mode in which the ordering matters.
   */
  _enterSavepoint() {
    if (!this.sequelize.options.releaseSavepointsOnCommit) {
      return;
    }

    this.rootTransaction._openSavepoints.push(this);
  }

  /**
   * Closing a savepoint, `RELEASE SAVEPOINT` on commit, `ROLLBACK TO SAVEPOINT` on rollback
   * also discards every savepoint established after it. Closing an outer savepoint first therefore
   * leaves any inner ones invalid, and closing one of those afterwards fails deep inside postgres
   * with `savepoint "..." does not exist`, reported against the victim rather than whatever closed
   * out of order.
   *
   * The overwhelmingly common cause is two nested transactions running concurrently under the same
   * parent `Promise.all` over calls that each open a transaction. Postgres gives no concurrency
   * within a transaction anyway (one connection, statements serialized), so that parallelism is not
   * buying anything; it only corrupts the savepoint stack.
   *
   * This throws before issuing any SQL, so the parent transaction stays usable and the message names
   * the actual cause.
   */
  _exitSavepoint() {
    // Without `releaseSavepointsOnCommit` nothing is ever released early, so no savepoint can be
    // discarded out from under another and there is nothing to detect.
    if (!this.sequelize.options.releaseSavepointsOnCommit) {
      return;
    }

    const root = this.rootTransaction;
    const index = root._openSavepoints.indexOf(this);

    if (index === -1) {
      throw new Error(
        `Savepoint ${this.name} was already discarded by an enclosing savepoint closing before it. ` +
          'Savepoints are released innermost-first, so nested transactions on one connection cannot ' +
          'overlap. Await each in turn rather than starting them together (e.g. under Promise.all), ' +
          'or pass `transaction: null` to run on an independent connection.'
      );
    }

    // Everything established after this savepoint is discarded along with it.
    root._openSavepoints.splice(index);
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

    if (this.parent) {
      this._exitSavepoint();
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

    if (this.parent) {
      this._exitSavepoint();
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
      this._enterSavepoint();
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
   * try {
   *   const result = await sequelize.transaction({type: Sequelize.Transaction.TYPES.EXCLUSIVE}, async transaction => {
   *     // your transactions
   *   });
   *   // transaction has been committed. Do something after the commit if required.
   * } catch (err) {
   *   // do something with the err.
   * }
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
   * try {
   *   const result = await sequelize.transaction(
   *     {isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE},
   *     async transaction => {
   *       // your transactions
   *     }
   *   );
   *   // transaction has been committed. Do something after the commit if required.
   * } catch (err) {
   *   // do something with the err.
   * }
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

export default Transaction;
