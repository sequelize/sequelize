'use strict';

const _ = require('lodash');
const Utils = require('./utils');

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

    // get dialect specific transaction options
    const transactionOptions = sequelize.dialect.supports.transactionOptions || {};
    const generateTransactionId = this.sequelize.dialect.QueryGenerator.generateTransactionId;

    this.options = _.extend({
      autocommit: transactionOptions.autocommit || null,
      type: sequelize.options.transactionType,
      isolationLevel: sequelize.options.isolationLevel,
      readOnly: false
    }, options || {});

    this.parent = this.options.transaction;
    this.id = this.parent ? this.parent.id : generateTransactionId();

    if (this.parent) {
      this.id = this.parent.id;
      this.parent.savepoints.push(this);
      this.name = this.id + '-savepoint-' + this.parent.savepoints.length;
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
  commit() {

    if (this.finished) {
      return Utils.Promise.reject(new Error('Transaction cannot be committed because it has been finished with state: ' + this.finished));
    }

    this._clearCls();

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
      });
  }

  /**
   * Rollback (abort) the transaction
   *
   * @return {Promise}
   */
  rollback() {

    if (this.finished) {
      return Utils.Promise.reject(new Error('Transaction cannot be rolled back because it has been finished with state: ' + this.finished));
    }

    this._clearCls();

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

  prepareEnvironment(useCLS) {
    let connectionPromise;

    if (typeof useCLS === 'undefined') {
      useCLS = true;
    }

    if (this.parent) {
      connectionPromise = Utils.Promise.resolve(this.parent.connection);
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
      .then(() => this.begin())
      .then(() => this.setDeferrable())
      .then(() => this.setIsolationLevel())
      .then(() => this.setAutocommit())
      .catch(setupErr => this.rollback().finally(() => {
        throw setupErr;
      }))
      .tap(() => {
        if (useCLS && this.sequelize.constructor._cls) {
          this.sequelize.constructor._cls.set('transaction', this);
        }
        return null;
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

  setAutocommit() {
    return this
      .sequelize
      .getQueryInterface()
      .setAutocommit(this, this.options.autocommit, this.options);
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

  _clearCls() {
    const cls = this.sequelize.constructor._cls;

    if (cls) {
      if (cls.get('transaction') === this) {
        cls.set('transaction', null);
      }
    }
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
