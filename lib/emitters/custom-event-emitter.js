var util         = require("util")
  , EventEmitter = require("events").EventEmitter

module.exports = (function() {
  var CustomEventEmitter = function(fct) {
    this.fct = fct
  }
  util.inherits(CustomEventEmitter, EventEmitter)

  CustomEventEmitter.prototype.run = function() {
    process.nextTick(function() {
      if (this.fct) {
        this.fct.call(this, this)
      }
    }.bind(this))
    
    return this
  }

  CustomEventEmitter.prototype.success =
  CustomEventEmitter.prototype.ok =
  function(fct) {
    this.on('success', fct)
    return this
  }

  CustomEventEmitter.prototype.failure =
  CustomEventEmitter.prototype.fail =
  CustomEventEmitter.prototype.error =
  function(fct) {
    this.on('error', fct)
    return this;
  }

  CustomEventEmitter.prototype.done =
  CustomEventEmitter.prototype.complete =
  function(fct) {
    this.on('error', function(err) { fct(err, null) })
        .on('success', function(result) { fct(null, result) })
    return this
  }

  CustomEventEmitter.prototype.proxy = function(emitter) {
    this.on('error', function (err) {
      emitter.emit('error', err)
    })
    this.on('success', function (result) {
      emitter.emit('success', result)
    })
  }


  return CustomEventEmitter;
})()
