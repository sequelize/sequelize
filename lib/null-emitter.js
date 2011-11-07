var Utils = require("./utils")
var NullEmitter = module.exports = function(delay) {
  var self = this
  
  delay = delay || 10
  setTimeout(function() { self.emitNull() }, delay)
}
Utils.addEventEmitter(NullEmitter)

NullEmitter.prototype.emitNull = function() {
  this.emit('success', null)
  this.emit('failure', null)
}