'use strict';

const Promise = require('./promise');
const { Hooks } = require('./hooks');

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
   * @param {string} options.type=true Sets the type of the transaction.
   * @param {string} options.isolationLevel=true Sets the isolation level of the transaction.
   * @param {string} options.deferrable Sets the constraints to be deferred or immediately checked.
   */
  constructor(sequelize, options = {}) {
    this.hooks = new Hooks();
    this.sequelize = sequelize;
    this.savepoints = [];

    // get dialect specific transaction options
    const generateTransactionId = this.sequelize.dialect.QueryGenerator.generateTransactionId;

    this.options = Object.assign({
      type: sequelize.options.transactionType,
      isolationLevel: sequelize.options.isolationLevel,
      readOnly: false
    }, options);

    this.parent = this.options.transaction;
    this.id = this.parent ? this.parent.id : generateTransactionId();

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
  commit() {
    if (this.finished) {
      return Promise.reject(new Error(`Transaction cannot be committed because it has been finished with state: ${this.finished}`));
    }

    return this
      .sequelize
      .getQueryInterface()
      .commitTransaction(this, this.options)
      .finally(() => {
        this.finished = 'commit';
        if (!this.parent) {
          return this.cleanup();
        }
        return null;
      }).tap(() => this.hooks.run('afterCommit', this));
  }

  /**
   * Rollback (abort) the transaction
   *
   * @returns {Promise}
   */
  rollback() {
    if (this.finished) {
      return Promise.reject(new Error(`Transaction cannot be rolled back because it has been finished with state: ${this.finished}`));
    }

    if (!this.connection) {
      return Promise.reject(new Error('Transaction cannot be rolled back because it never started'));
    }

    return this
      .sequelize
      .getQueryInterface()
      .rollbackTransaction(this, this.options)
      .finally(() => {
        if (!this.parent) {
          return this.cleanup();
        }
        return this;
      });
  }

  prepareEnvironment() {
    let connectionPromise;

    if (this.parent) {
      connectionPromise = Promise.resolve(this.parent.connection);
    } else {
      const acquireOptions = { uuid: this.id };
      if (this.options.readOnly) {
        acquireOptions.type = 'SELECT';
      }
      connectionPromise = this.sequelize.connectionManager.getConnection(acquireOptions);
    }

    return connectionPromise
      .then(connection => {
        this.connection = connection;
        this.connection.uuid = this.id;
      })
      .then(() => {
        return this.begin()
          .then(() => this.setDeferrable())
          .then(() => this.setIsolationLevel())
          .catch(setupErr => this.rollback().finally(() => {
            throw setupErr;
          }));
      });
  }

  begin() {
    return this
      .sequelize
      .getQueryInterface()
      .startTransaction(this, this.options);
  }

  setDeferrable() {
    if (this.options.deferrable) {
      return this
        .sequelize
        .getQueryInterface()
        .deferConstraints(this, this.options);
    }
  }

  setIsolationLevel() {
    return this
      .sequelize
      .getQueryInterface()
      .setIsolationLevel(this, this.options.isolationLevel, this.options);
  }

  cleanup() {
    const res = this.sequelize.connectionManager.releaseConnection(this.connection);
    this.connection.uuid = undefined;
    return res;
  }

  /**
   * Types can be set per-transaction by passing `options.type` to `sequelize.transaction`.
   * Default to `DEFERRED` but you can override the default type by passing `options.transactionType` in `new Sequelize`.
   * Sqlite only.
   *
   * Pass in the desired level as the first argument:
   *
   * @example
   * return sequelize.transaction({type: Sequelize.Transaction.TYPES.EXCLUSIVE}, transaction => {
   *   // your transactions
   * }).then(result => {
   *   // transaction has been committed. Do something after the commit if required.
   * }).catch(err => {
   *   // do something with the err.
   * });
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
   * return sequelize.transaction({isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.SERIALIZABLE}, transaction => {
   *   // your transactions
   * }).then(result => {
   *   // transaction has been committed. Do something after the commit if required.
   * }).catch(err => {
   *   // do something with the err.
   * });
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
