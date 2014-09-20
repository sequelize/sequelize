'use strict';

var Promise = require('sequelize-bluebird')
  , EventEmitter = require('events').EventEmitter
  , proxyEventKeys = ['success', 'error', 'sql']
  , Utils = require('./utils')
  , deprecatedSeen = {}
  , deprecated = function(message) {
    if (deprecatedSeen[message]) return;
    console.warn(message);
    deprecatedSeen[message] = true;
  };

/**
 * A slightly modified version of bluebird promises. This means that, on top of the methods below, you can also call all the methods listed on the link below.
 *
 * The main difference is that sequelize promises allows you to attach a listener that will be called with the generated SQL, each time a query is run.
 *
 * @mixes https://github.com/petkaantonov/bluebird/blob/master/API.md
 * @class Promise
 */
var SequelizePromise = Promise;

/**
 * Listen for events, event emitter style. Mostly for backwards compat. with EventEmitter
 *
 * @param {String} evt
 * @param {Function} fct
 */
SequelizePromise.prototype.on = function(evt, fct) {
  if (evt === 'success') {
    this.then(fct);
  }
  else if (evt === 'error') {
    this.then(null, fct);
  }
  else {
    EventEmitter.prototype.on.call(this, evt, fct);
  }

  return this;
};

/**
 * Emit an event from the emitter
 * @param {string} type The type of event
 * @param {any}    value(s)* All other arguments will be passed to the event listeners
 */
SequelizePromise.prototype.emit = function(evt) {
  var args = arguments.length > 1 ? Array.prototype.slice.call(arguments, 1) : [];

  if (evt === 'success') {
    this.seqResolve.apply(this, args);
  } else if (evt === 'error') {
    this.seqReject.apply(this, args);
  } else {
    // Needed to transfer sql across .then() calls
    if (evt === 'sql') {
      this.$sql.push(args[0]);
    }

    EventEmitter.prototype.emit.apply(this, [evt].concat(args));
  }

  return this;
};

/**
 * Listen for success events.
 *
 * ```js
 * promise.success(function (result) {
 *  //...
 * });
 * ```
 *
 * @param {function} onSuccess
 * @method success
 * @alias ok
 * @return this
 */
SequelizePromise.prototype.success =
SequelizePromise.prototype.ok = function(fct) {
  deprecated('EventEmitter#success|ok is deprecated, please use promise-style instead.');
  if (fct.length > 1) {
    return this.spread(fct);
  } else {
    return this.then(fct);
  }
};

/**
 * Listen for error events
 *
 * ```js
 * promise.error(function (err) {
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
SequelizePromise.prototype.failure =
SequelizePromise.prototype.fail =
SequelizePromise.prototype.error = function(fct) {
  deprecated('EventEmitter#failure|fail|error is deprecated, please use promise-style instead.');
  return this.then(null, fct);
};

/**
* Listen for both success and error events.
*
* ```js
* promise.done(function (err, result) {
*  //...
* });
* ```
*
* @param {function} onDone
* @method done
* @alias complete
* @return this
*/
var bluebirdDone = Promise.prototype.done;
SequelizePromise.prototype.done =
SequelizePromise.prototype.complete = function(fct) {
  if (!fct) {
    // If no callback is provided, map to the promise.done function, which explicitly ends a promise chain
    return bluebirdDone.call(this);
  }

  if (fct.length > 2) {
    deprecated('EventEmitter#complete|done is deprecated, please use promise-style instead.');
    return this.spread(function() {
      fct.apply(null, [null].concat(Array.prototype.slice.call(arguments)));
    }, fct);
  } else {
    return this.then(function() {
      fct.apply(null, [null].concat(Array.prototype.slice.call(arguments)));
    }, fct);
  }
};

/*
 * Attach a function that is called every time the function that created this emitter executes a query.
 * @param {function} onSQL
 * @return this
 */
SequelizePromise.prototype.sql = function(fct) {
  this.on('sql', fct);
  return this;
};

/**
 * Proxy every event of this promise to another one.
 *
 * @param  {SequelizePromise} promise The promise that should receive the events.
 * @param  {Object}           [options]
 * @param  {Array}            [options.events] An array of the events to proxy. Defaults to sql, error and success
 * @return this
 */
SequelizePromise.prototype.proxy = function(promise, options) {
  options = Utils._.extend({
    events: proxyEventKeys,
    skipEvents: []
  }, options || {});

  options.events = Utils._.difference(options.events, options.skipEvents);

  options.events.forEach(function(eventKey) {
    this.on(eventKey, function() {
      var args = [eventKey].concat([].slice.apply(arguments));
      promise.emit.apply(promise, args);
    });
  }.bind(this));

  return this;
};

SequelizePromise.prototype.proxySql = function(promise) {
  return this.proxy(promise, {
    events: ['sql']
  });
};

module.exports = SequelizePromise;
