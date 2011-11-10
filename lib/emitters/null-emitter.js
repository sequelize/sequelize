var Utils = require("../utils")

module.exports = (function(){
  var NullEmitter = function(delay) {
    var self = this

    delay = delay || 10
    setTimeout(function() { self.emitNull() }, delay)
  }
  Utils.addEventEmitter(NullEmitter)

  NullEmitter.prototype.emitNull = function() {
    this.emit('success', null)
    this.emit('failure', null)
  }

  return NullEmitter
})()
