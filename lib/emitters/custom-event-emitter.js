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
};

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

  CustomEventEmitter.prototype.emit = function(type) {
    this._events = this._events || {};

    // Override default 'error' event logic
    if (type === 'error' && !this._events.error) {
      // No error listener
      var er = arguments[1];

      // If error argument is an object but no error,
      // boil it down to the value of the first key
      // (probably an Array in most cases)
      if (Utils._.isObject(er) && !(er instanceof Error)) {
        er = er[Object.keys(er)[0]]
      }

      // If error argument is an array, make sure we
      // pass only the first error to the original
      // .emit() function of EventEmitter
      if (er instanceof Array) {
        er = Utils._.flatten(er)[0]
      }

      // We don't want to throw strings. Make them Errors!
      if (typeof er === "string") {
        er = new Error(er)
      }

      arguments[1] = er
    }

    EventEmitter.prototype.emit.apply(this, arguments);
  };

  /**
    Shortcut methods (success, ok) for listening for success events.

    Params:
      - fct: A function that gets executed once the *success* event was triggered.

    Result:
      The function returns the instance of the query.
  */
  CustomEventEmitter.prototype.success =
  CustomEventEmitter.prototype.ok =
  function(fct) {
    this.on('success', bindToProcess(fct))
    return this
  }

  /**
    Shortcut methods (failure, fail, error) for listening for error events.

    Params:
      - fct: A function that gets executed once the *error* event was triggered.

    Result:
      The function returns the instance of the query.
  */
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
          .on('success', resolve)
    }).then(onFulfilled, onRejected)
  }

  CustomEventEmitter.prototype.spread = function(onFulfilled, onRejected) {
    var self = this

    onFulfilled = bindToProcess(onFulfilled)
    onRejected = bindToProcess(onRejected)

    return new Promise(function (resolve, reject) {
      self.on('error', reject)
          .on('success', function () {
            resolve(Array.prototype.slice.apply(arguments)) // Transform args to an array
          })
    }).spread(onFulfilled, onRejected)
  }

  return CustomEventEmitter
})()

