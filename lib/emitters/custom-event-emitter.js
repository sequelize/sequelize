var util         = require("util")
  , EventEmitter = require("events").EventEmitter;

module.exports = (function() {
  var CustomEventEmitter = function(fct) {
    this.fct = fct;
    var self = this;
  }
  util.inherits(CustomEventEmitter, EventEmitter);

  CustomEventEmitter.prototype.run = function() {
    var self = this;
    
    process.nextTick(function() {
      if (self.fct) {
        self.fct.call(self, self)
      }
    }.bind(this));
    
    return this;
  }

  CustomEventEmitter.prototype.success =
  CustomEventEmitter.prototype.ok =
  function(fct) {
    this.on('success', fct);
    return this;
  }

  CustomEventEmitter.prototype.failure =
  CustomEventEmitter.prototype.fail =
  CustomEventEmitter.prototype.error =
  function(fct) {
    this.on('error', fct);
    return this;
  }

  CustomEventEmitter.prototype.done =
  CustomEventEmitter.prototype.complete =
  function(fct) {
    this.on('error', function(err) { fct(err, null) })
        .on('success', function(result) { fct(null, result) });
    return this;
  }


  return CustomEventEmitter;
})();
