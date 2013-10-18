var Utils = require('./utils')
  , util  = require('util')

var Transaction = module.exports = function(options) {
  this.options = options || {}
  this.id      = Utils.generateUUID()
}

util.inherits(Transaction, Utils.CustomEventEmitter)

Transaction.prototype.commit = function() {
  this.emit('success')
}


Transaction.prototype.rollback = function() {
  this.emit('success')
}
