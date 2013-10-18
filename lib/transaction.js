var Utils = require('./utils')
  , util  = require('util')

var Transaction = module.exports = function(sequelize, options) {
  this.sequelize = sequelize
  this.options   = options || {}
  this.id        = Utils.generateUUID()
}

util.inherits(Transaction, Utils.CustomEventEmitter)

Transaction.prototype.commit = function() {
  return this
    .sequelize
    .getQueryInterface()
    .commitTransaction(this, {})
    .proxy(this)
}


Transaction.prototype.rollback = function() {
  return this
    .sequelize
    .getQueryInterface()
    .rollbackTransaction(this, {})
    .proxy(this)
}
