var sys          = require("sys")
  , EventEmitter = require("events").EventEmitter

module.exports = (function() {
  var CustomEventEmitter = function(fct) {
    this.fct = fct
  }
  sys.inherits(CustomEventEmitter, EventEmitter)

  CustomEventEmitter.prototype.run = function() {
    var self = this

    // delay the function call and return the emitter
    setTimeout(function(){
      self.fct.call(self, self)
    }, 5)

    return this
  }

  CustomEventEmitter.prototype.success = CustomEventEmitter.prototype.ok = function(fct) {
    this.on('success', fct)
    return this
  }

  CustomEventEmitter.prototype.failure =
  CustomEventEmitter.prototype.fail =
  CustomEventEmitter.prototype.error =
  function(fct) {
    this.on('failure', fct)
    return this
  }

  return CustomEventEmitter
})()
