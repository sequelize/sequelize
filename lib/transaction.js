'use strict';

var Utils = require('./utils');

/**
 * The transaction object is used to identify a running transaction. It is created by calling `Sequelize.transaction()`.
 *
 * To run a query under a transaction, you should pass the transaction in the options object.
 * @class Transaction
 * @constructor
 *
 * @param {Sequelize} sequelize A configured sequelize Instance
 * @param {Object} options An object with options
 * @param {Boolean} options.autocommit=true Sets the autocommit property of the transaction.
 * @param {String} options.type=true Sets the type of the transaction.
 * @param {String} options.isolationLevel=true Sets the isolation level of the transaction.
 * @param {String} options.deferrable Sets the constraints to be deferred or immediately checked.
 * @param {String} options.readOnly=false Sets the read-only property of the transaction. Such transactions
 *   will use read replicas when available
 */
function Transaction(sequelize, options) {
  this.sequelize = sequelize;
  this.savepoints = [];
  var generateTransactionId = this.sequelize.dialect.QueryGenerator.generateTransactionId;

  this.options = Utils._.extend({
    autocommit: true,
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
 * Types can be set per-transaction by passing `options.type` to `sequelize.transaction`.
 * Default to `DEFERRED` but you can override the default type by passing `options.transactionType` in `new Sequelize`.
 * Sqlite only.
 *
 * The possible types to use when starting a transaction:
 *
 * ```js
 * {
 *   DEFERRED: "DEFERRED",
 *   IMMEDIATE: "IMMEDIATE",
 *   EXCLUSIVE: "EXCLUSIVE"
 * }
 * ```
 *
 * Pass in the desired level as the first argument:
 *
 * ```js
 * return sequelize.transaction({
 *   type: Sequelize.Transaction.EXCLUSIVE
 * }, function (t) {
 *
 *  // your transactions
 *
 * }).then(function(result) {
 *   // transaction has been committed. Do something after the commit if required.
 * }).catch(function(err) {
 *   // do something with the err.
 * });
 * ```
 *
 * @property TYPES
 */
Transaction.TYPES = {
  DEFERRED: 'DEFERRED',
  IMMEDIATE: 'IMMEDIATE',
  EXCLUSIVE: 'EXCLUSIVE'
};


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
 * return sequelize.transaction({
 *   isolationLevel: Sequelize.Transaction.SERIALIZABLE
 * }, function (t) {
 *
 *  // your transactions
 *
 * }).then(function(result) {
 *   // transaction has been committed. Do something after the commit if required.
 * }).catch(function(err) {
 *   // do something with the err.
 * });
 * ```
 *
 * @property ISOLATION_LEVELS
 */
Transaction.ISOLATION_LEVELS = {
  READ_UNCOMMITTED: 'READ UNCOMMITTED',
  READ_COMMITTED: 'READ COMMITTED',
  REPEATABLE_READ: 'REPEATABLE READ',
  SERIALIZABLE: 'SERIALIZABLE'
};

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
 *     level: t1.LOCK...,
 *     of: UserModel
 *   }
 * });
 * ```
 * UserModel will be locked but TaskModel won't!
 *
 * @property LOCK
 */
Transaction.LOCK = Transaction.prototype.LOCK = {
  UPDATE: 'UPDATE',
  SHARE: 'SHARE',
  KEY_SHARE: 'KEY SHARE',
  NO_KEY_UPDATE: 'NO KEY UPDATE'
};

/**
 * Commit the transaction
 *
 * @return {Promise}
 */
Transaction.prototype.commit = function() {
  var self = this;

  if (this.finished) {
    throw new Error('Transaction cannot be committed because it has been finished with state: ' + self.finished);
  }

  this.$clearCls();

  return this
    .sequelize
    .getQueryInterface()
    .commitTransaction(this, this.options)
    .finally(function() {
      self.finished = 'commit';
      if (!self.parent) {
        return self.cleanup();
      }
      return null;
    });
};


/**
 * Rollback (abort) the transaction
 *
 * @return {Promise}
 */
Transaction.prototype.rollback = function() {
  var self = this;

  if (this.finished) {
    throw new Error('Transaction cannot be rolled back because it has been finished with state: ' + self.finished);
  }

  this.$clearCls();

  return this
    .sequelize
    .getQueryInterface()
    .rollbackTransaction(this, this.options)
    .finally(function() {
      if (!self.parent) {
        return self.cleanup();
      }
      return self;
    });
};

Transaction.prototype.prepareEnvironment = function() {
  var self = this;
  var connectionPromise;

  if (this.parent) {
    connectionPromise = Utils.Promise.resolve(this.parent.connection);
  } else {
    var acquireOptions = {uuid: this.id};

    if (this.options.readOnly) {
      acquireOptions.type = 'SELECT';
    }

    connectionPromise = this.sequelize.connectionManager.getConnection(acquireOptions);
  }

  return connectionPromise
  .then(function (connection) {
    self.connection = connection;
    self.connection.uuid = self.id;
  }).then(function () {
    return self.begin();
  }).then(function () {
    return self.setDeferrable();
  }).then(function () {
    return self.setIsolationLevel();
  }).then(function () {
    return self.setAutocommit();
  }).catch(function (setupErr) {
    return self.rollback().finally(function () {
      throw setupErr;
    });
  }).tap(function () {
    if (self.sequelize.constructor.cls) {
      self.sequelize.constructor.cls.set('transaction', self);
    }
    return null;
  });
};

Transaction.prototype.begin = function() {
  return this
    .sequelize
    .getQueryInterface()
    .startTransaction(this, this.options);
};

Transaction.prototype.setDeferrable = function () {
  if (this.options.deferrable) {
    return this
      .sequelize
      .getQueryInterface()
      .deferConstraints(this, this.options);
  }
};

Transaction.prototype.setAutocommit = function() {
  return this
    .sequelize
    .getQueryInterface()
    .setAutocommit(this, this.options.autocommit, this.options);
};

Transaction.prototype.setIsolationLevel = function() {
  return this
    .sequelize
    .getQueryInterface()
    .setIsolationLevel(this, this.options.isolationLevel, this.options);
};

Transaction.prototype.cleanup = function() {
  var res = this.sequelize.connectionManager.releaseConnection(this.connection);
  this.connection.uuid = undefined;
  return res;
};

Transaction.prototype.$clearCls = function () {
  var cls = this.sequelize.constructor.cls;

  if (cls) {
    if (cls.get('transaction') === this) {
      cls.set('transaction', null);
    }
  }
};

module.exports = Transaction;
module.exports.Transaction = Transaction;
module.exports.default = Transaction;
