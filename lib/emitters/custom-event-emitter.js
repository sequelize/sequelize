var util           = require("util")
  , EventEmitter   = require("events").EventEmitter
  , Promise        = require("promise")
  , proxyEventKeys = ['success', 'error', 'sql']


var bindToProcess = function(fct) {
  if (fct) {
    if (process.domain) {
      return process.domain.bind(fct)
    }
  }

  return fct
}

module.exports = (function() {
  var CustomEventEmitter = function(fct) {
    this.fct = bindToProcess(fct);
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
    this.on('success', bindToProcess(fct))
    return this
  }

  CustomEventEmitter.prototype.failure =
  CustomEventEmitter.prototype.fail =
  CustomEventEmitter.prototype.error =
  function(fct) {
    this.on('error', bindToProcess(fct))
    return this;
  }

  CustomEventEmitter.prototype.done =
  CustomEventEmitter.prototype.complete =
  function(fct) {
    fct = bindToProcess(fct);
    this.on('error', function(err) { fct(err, null) })
        .on('success', function(result) { fct(null, result) })
    return this
  }

  CustomEventEmitter.prototype.sql =
  function(fct) {
    this.on('sql', bindToProcess(fct))
    return this;
  }

  // emit the events on the foreign emitter once events got triggered for me
  CustomEventEmitter.prototype.proxy = function(emitter) {
    proxyEventKeys.forEach(function (eventKey) {
      this.on(eventKey, function (result) {
        emitter.emit(eventKey, result)
      })
    }.bind(this))
  }

  CustomEventEmitter.prototype.then =
  function (onFulfilled, onRejected) {
    var self = this
    onFulfilled = bindToProcess(onFulfilled)
    onRejected = bindToProcess(onRejected)
    return new Promise(function (resolve, reject) {
      self.on('error', reject)
          .on('success', resolve);
    }).then(onFulfilled, onRejected)
  }

  return CustomEventEmitter
})()
