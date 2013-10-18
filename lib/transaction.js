var Utils = require('./utils')
  , util  = require('util')

var Transaction = module.exports = function(sequelize, options) {
  this.sequelize = sequelize
  this.options   = options || {}
  this.id        = Utils.generateUUID()
}

util.inherits(Transaction, Utils.CustomEventEmitter)

Transaction.prototype.commit = function() {
  this
    .sequelize
    .getQueryInterface()
    .commitTransaction({ transaction: this })
    .proxy(this)
}


Transaction.prototype.rollback = function() {
  this
    .sequelize
    .getQueryInterface()
    .rollbackTransaction({ transaction: this })
    .proxy(this)
}
