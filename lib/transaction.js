var Utils = require('./utils')

var Transaction = module.exports = function(options) {
  this.options = options || {}
  this.id      = Utils.generateUUID()
}
