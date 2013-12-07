var util           = require("util")
  , EventEmitter   = require("events").EventEmitter
  , Promise        = require("bluebird")
  , proxyEventKeys = ['success', 'error', 'sql']
  , Utils          = require('../utils')

var bindToProcess = function(fct) {
  if (fct && process.domain) {
    return process.domain.bind(fct)
  }

  return fct
}

module.exports = (function() {
  var CustomEventEmitter = function(fct) {
    this.fct = bindToProcess(fct)
  }
  util.inherits(CustomEventEmitter, EventEmitter)

  CustomEventEmitter.prototype.run = function() {
    Utils.tick(function() {
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
        .on('success', function() {
          var args = Array.prototype.slice.call(arguments);
          args.unshift(null);
          fct.apply(fct, args);
        })
    return this
  }

  CustomEventEmitter.prototype.sql = function(fct) {
    this.on('sql', bindToProcess(fct))
    return this;
  }

  /**
   * Proxy every event of this custom event emitter to another one.
   *
   * @param  {CustomEventEmitter} emitter The event emitter that should receive the events.
   * @return {void}
   */
  CustomEventEmitter.prototype.proxy = function(emitter, options) {
    options = Utils._.extend({
      events:     proxyEventKeys,
      skipEvents: []
    }, options || {})

    options.events = Utils._.difference(options.events, options.skipEvents)

    options.events.forEach(function (eventKey) {
      this.on(eventKey, function (result) {
        emitter.emit(eventKey, result)
      })
    }.bind(this))

    return this
  }

  CustomEventEmitter.prototype.then = function(onFulfilled, onRejected) {
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
