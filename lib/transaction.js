var Utils = require('./utils')
  , util  = require('util')

/**
 * The transaction object is used to identify a running transaction. It is created by calling `Sequelize.transaction()`. 
 *
 * To run a query under a transaction, you should pass the transaction in the options object.
 * @class Transaction
 */ 
var Transaction = module.exports = function(sequelize, options) {
  this.sequelize = sequelize
  this.id        = Utils.generateUUID()
  this.options   = Utils._.extend({
    autocommit: true,
    isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ
  }, options || {})
}

util.inherits(Transaction, Utils.CustomEventEmitter)

/**
 * The possible isolations levels to use when starting a transaction
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
  READ_UNCOMMITTED: "READ UNCOMMITTED",
  READ_COMMITTED: "READ COMMITTED",
  REPEATABLE_READ: "REPEATABLE READ",
  SERIALIZABLE: "SERIALIZABLE"
}

/**
 * Possible options for row locking. Used in conjuction with `find` calls:
 *
 * ```js
 * t1 // is a transaction
 * Model.findAll({
 *   where: ...
 * }, {
 *   transaction: t1,
 *   lock: t1.LOCK.UPDATE,
 *   lock: t1.LOCK.SHARE
 * })
 * ```
 * @property LOCK
 */
Transaction.LOCK = Transaction.prototype.LOCK = {
  UPDATE: 'UPDATE',
  SHARE: 'SHARE'
}

/**
 * Commit the transaction
 * 
 * @return {this}
 */ 
Transaction.prototype.commit = function() {
  return this
    .sequelize
    .getQueryInterface()
    .commitTransaction(this, {})
    .proxy(this)
    .done(this.cleanup.bind(this))
}


/**
 * Rollback (abort) the transaction
 * 
 * @return {this}
 */
Transaction.prototype.rollback = function() {
  return this
    .sequelize
    .getQueryInterface()
    .rollbackTransaction(this, {})
    .proxy(this)
    .done(this.cleanup.bind(this))
}

Transaction.prototype.prepareEnvironment = function(callback) {
  var self             = this
    , connectorManager = self.sequelize.transactionManager.getConnectorManager(this.id)

  this.begin(function() {
    self.setIsolationLevel(function() {
      self.setAutocommit(function() {
        connectorManager.afterTransactionSetup(callback)
      })
    })
  })
}

Transaction.prototype.begin = function(callback) {
  this
    .sequelize
    .getQueryInterface()
    .startTransaction(this, {})
    .success(callback)
    .error(onError.bind(this))
}

Transaction.prototype.setAutocommit = function(callback) {
  this
    .sequelize
    .getQueryInterface()
    .setAutocommit(this, this.options.autocommit)
    .success(callback)
    .error(onError.bind(this))
}

Transaction.prototype.setIsolationLevel = function(callback) {
  this
    .sequelize
    .getQueryInterface()
    .setIsolationLevel(this, this.options.isolationLevel)
    .success(callback)
    .error(onError.bind(this))
}

Transaction.prototype.cleanup = function() {
  this.sequelize.transactionManager.releaseConnectionManager(this.id)
}

// private

var onError = function(err) {
  this.emit('error', err)
}
