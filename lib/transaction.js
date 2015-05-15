'use strict';

var Utils = require('./utils');

/**
 * The transaction object is used to identify a running transaction. It is created by calling `Sequelize.transaction()`.
 *
 * To run a query under a transaction, you should pass the transaction in the options object.
 * @class Transaction
 */
var Transaction = module.exports = function(sequelize, options) {
  this.sequelize = sequelize;
  this.savepoints = [];
  this.options = Utils._.extend({
    autocommit: true,
    isolationLevel: sequelize.options.isolationLevel
  }, options || {});
  this.id = this.options.transaction ? this.options.transaction.id : Utils.generateUUID();

  if (this.options.transaction) {
    this.id = this.options.transaction.id;
    this.options.transaction.savepoints.push(this);
    this.name = this.id + '-savepoint-' + this.options.transaction.savepoints.length;
    this.parent = this.options.transaction;
  } else {
    this.id = this.name = Utils.generateUUID();
  }
};

/**
 * The possible isolations levels to use when starting a transaction.
 * Can be set per-transaction by passing `options.isolationLevel` to `sequelize.transaction`.
 * Default to `REPEATABLE_READ` but you can override the default isolation level by passing `options.isolationLevel` in `new Sequelize`.
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
 * @property ISOLATION_LEVELS
 */
Transaction.ISOLATION_LEVELS = {
  READ_UNCOMMITTED: 'READ UNCOMMITTED',
  READ_COMMITTED: 'READ COMMITTED',
  REPEATABLE_READ: 'REPEATABLE READ',
  SERIALIZABLE: 'SERIALIZABLE'
};

/**
 * Possible options for row locking. Used in conjuction with `find` calls:
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
 * @return {this}
 */
Transaction.prototype.commit = function() {
  var self = this;

  return this
    .sequelize
    .getQueryInterface()
    .commitTransaction(this, this.options)
    .finally(function() {
      self.finished = 'commit';
      if (!self.options.transaction) {
        self.cleanup();
      }
    });
};


/**
 * Rollback (abort) the transaction
 *
 * @return {this}
 */
Transaction.prototype.rollback = function() {
  var self = this;

  return this
    .sequelize
    .getQueryInterface()
    .rollbackTransaction(this, this.options)
    .finally(function() {
      self.finished = 'rollback';
      if (!self.options.transaction) {
        self.cleanup();
      }
    });
};

Transaction.prototype.prepareEnvironment = function() {
  var self = this;

  return Utils.Promise.resolve(
    self.options.transaction ? self.options.transaction.connection : self.sequelize.connectionManager.getConnection({ uuid: self.id })
  ).then(function (connection) {
    self.connection = connection;
    self.connection.uuid = self.id;

    if (self.sequelize.constructor.cls) {
      self.sequelize.constructor.cls.set('transaction', self);
    }
  }).then(function () {
    return self.begin();
  }).then(function () {
    return self.setIsolationLevel();
  }).then(function () {
    return self.setAutocommit();
  });
};

Transaction.prototype.begin = function() {
  return this
    .sequelize
    .getQueryInterface()
    .startTransaction(this, this.options);
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
  var cls = this.sequelize.constructor.cls;

  this.connection.uuid = undefined;

  if (cls) {
    if (cls.get('transaction') === this) {
      cls.set('transaction', null);
    }
  }

  return this.sequelize.connectionManager.releaseConnection(this.connection);
};
