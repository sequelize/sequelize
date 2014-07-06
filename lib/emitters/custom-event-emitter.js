'use strict';

var util = require('util')
  , EventEmitter = require('events').EventEmitter
  , Promise = require('../promise')
  , proxyEventKeys = ['success', 'error', 'sql']
  , Utils = require('../utils');

var bindToProcess = function(fct) {
  if (fct && process.domain) {
    return process.domain.bind(fct);
  }

  return fct;
};

/**
   * The EventEmitter is returned from all asynchronous Sequelize calls - So almost all of them.
   * The emitter provides a lovely mix of native node.js `EventEmitter` and promise methods.
   *
   * There are several different syntaxes for attaching listeners to the emitter:
   *
   * ```js
   * Model.find(...).on('success', function (dao) {
   *   // Using it as a regular node emitter
   * })
   *
   * Model.find(...).success(function (dao) {
   *   // Using the shortcut methods
   * })
   *
   * Model.find(...).done(function (err, dao) {
   *   // Using the done method, which is called both if the operation succeeds,
   *   // and if it fails. On success, the err argument will be null
   * })
   *
   * Model.find(...).then(function (dao) {
   *   // Using the emitter as a promise. The first function is the success handler,
   *   // and the second is the error handler.
   * }, function (err) {
   *
   * })
   * ```
   *
   * @deprecated The event emitter is deprecated, and due for removal soon. Please use promises instead!
   * @mixes http://nodejs.org/api/events.html#events_class_events_eventemitter
   * @class EventEmitter
   */
module.exports = (function() {
  /**
   * Create a new emitter instance.
   *
   * @constructor CustomEventEmitter
   * @param {function} fct A function that this emitter should run. The function is called with the emitter as first argument and as context
   */
  var CustomEventEmitter = function(fct) {
    this.fct = bindToProcess(fct);
  };
  util.inherits(CustomEventEmitter, EventEmitter);

  /**
   * Run the function that was passed when the emitter was instantiated.
   * @return this
   */
  CustomEventEmitter.prototype.run = function() {
    Utils.tick(function() {
      if (this.fct) {
        this.fct.call(this, this);
      }
    }.bind(this));

    return this;
  };

  /**
   * Emit an event from the emitter
   * @param {string} type The type of event
   * @param {any}    value(s)* All other arguments will be passed to the event listeners
   */
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
        er = er[Object.keys(er)[0]];
      }

      // If error argument is an array, make sure we
      // pass only the first error to the original
      // .emit() function of EventEmitter
      if (er instanceof Array) {
        er = Utils._.flatten(er)[0];
      }

      // We don't want to throw strings. Make them Errors!
      if (typeof er === 'string') {
        er = new Error(er);
      }

      arguments[1] = er;
    }

    EventEmitter.prototype.emit.apply(this, arguments);
  };

  /**
   * Listen for success events.
   *
   * ```js
   * emitter.success(function (result) {
   *  //...
   * });
   * ```
   *
   * @param {function} onSuccess
   * @method success
   * @alias ok
   * @return this
   */
  CustomEventEmitter.prototype.success =
  CustomEventEmitter.prototype.ok =
  function(fct) {
    this.on('success', bindToProcess(fct));
    return this;
  };

  /**
   * Listen for error events
   *
   * ```js
   * emitter.error(function (err) {
   *  //...
   * });
   * ```
   *
   * @param {function} onError
   * @method error
   * @alias fail
   * @alias failure
   * @return this
   */
  CustomEventEmitter.prototype.failure =
  CustomEventEmitter.prototype.fail =
  CustomEventEmitter.prototype.error =
  function(fct) {
    this.on('error', bindToProcess(fct));
    return this;
  };

  /**
   * Listen for both success and error events.
   *
   * ```js
   * emitter.done(function (err, result) {
   *  //...
   * });
   * ```
   *
   * @param {function} onDone
   * @method done
   * @alias complete
   * @return this
   */
  CustomEventEmitter.prototype.done =
  CustomEventEmitter.prototype.complete =
  function(fct) {
    fct = bindToProcess(fct);
    this.on('error', function(err) { fct(err, null); })
        .on('success', function() {
          var args = Array.prototype.slice.call(arguments);
          args.unshift(null);
          fct.apply(fct, args);
        });
    return this;
  };

  /*
   * Attach a function that is called every time the function that created this emitter executes a query.
   * @param {function} onSQL
   * @return this
   */
  CustomEventEmitter.prototype.sql = function(fct) {
    this.on('sql', bindToProcess(fct));
    return this;
  };

  /**
   * Proxy every event of this event emitter to another one.
   *
   * @param  {EventEmitter} emitter The event emitter that should receive the events.
   * @param  {Object}       [options]
   * @param  {Array}        [options.events] An array of the events to proxy. Defaults to sql, error and success
   * @return this
   */
  CustomEventEmitter.prototype.proxy = function(emitter, options) {
    options = Utils._.extend({
      events: proxyEventKeys,
      skipEvents: []
    }, options ||  {});

    options.events = Utils._.difference(options.events, options.skipEvents);

    options.events.forEach(function(eventKey) {
      this.on(eventKey, function() {
        var args = [eventKey].concat([].slice.apply(arguments));
        emitter.emit.apply(emitter, args);
      });
    }.bind(this));

    return this;
  };

  CustomEventEmitter.prototype.proxySql = function(promise) {
    return this.proxy(promise, {
      events: ['sql']
    });
  };

  /**
   * Attach listeners to the emitter, promise style.
   *
   * @param  {Function} onFulfilled The function to call if the promise is fulfilled (if the emitter emits success). Note that this function will always only be called with one argument, as per the promises/A spec. For functions that emit multiple arguments (e.g. findOrCreate) see `spread`
   * @param  {Function} onRejected
   * @return {Bluebird.Promise}
   */
  CustomEventEmitter.prototype.then = function(onFulfilled, onRejected) {
    var self = this;

    onFulfilled = bindToProcess(onFulfilled);
    onRejected = bindToProcess(onRejected);

    var promise = (new Promise(function(resolve, reject) {
      self.on('error', reject)
          .on('success', resolve);
    })).then(onFulfilled, onRejected);

    this.proxySql(promise);
    return promise;
  };

  /**
   * Attach listeners to the emitter, promise style. This listener will recieve all arguments emitted by the emitter, as opposed to `then` which will only recieve the first argument.
   *
   * @param  {Function} onFulfilled The function to call if the promise is fulfilled (if the emitter emits success).
   * @param  {Function} onRejected
   * @return {Bluebird.Promise}
   */
  CustomEventEmitter.prototype.spread = function(onFulfilled, onRejected) {
    var self = this;

    onFulfilled = bindToProcess(onFulfilled);
    onRejected = bindToProcess(onRejected);

    var promise = (new Promise(function(resolve, reject) {
      self.on('error', reject)
          .on('success', function() {
            resolve(Array.prototype.slice.apply(arguments)); // Transform args to an array
          });
    })).spread(onFulfilled, onRejected);

    this.proxySql(promise);
    return promise;
  };

  /**
   * Shorthand for `then(null, onRejected)`
   *
   * @param  {Function} onRejected
   * @return {Bluebird.Promise}
   */
  CustomEventEmitter.prototype.catch = function(onRejected) {
    return this.then(null, onRejected);
  };

  return CustomEventEmitter;
})();
