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

  return CustomEventEmitter
})()
