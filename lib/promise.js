'use strict';

var Promise = require('bluebird/js/main/promise')() // use this syntax to be able to modify bluebird without affecting other users
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
 * The sequelize promise class works seamlessly with other A+/thenable libraries, with one exception.
 * If you want to propagate SQL events across `then`, `all` calls etc., you must use sequelize promises exclusively. 
 *
 * @mixes https://github.com/petkaantonov/bluebird/blob/master/API.md
 * @class Promise
 */
var SequelizePromise = function (resolver) {
  var self = this;

  var promise = new Promise(function sequelizeResolver(resolve, reject) {
    self.seqResolve = resolve;
    self.seqReject = reject;

    return resolver(resolve, reject);
  });

  promise.seqResolve = this.seqResolve;
  promise.seqReject = this.seqReject;
  promise.$sql = [];

  return promise;
};

for (var method in Promise) {
  if (Promise.hasOwnProperty(method)) {
    SequelizePromise[method] = Promise[method];
  }
}

var bluebirdThen = Promise.prototype._then;
Promise.prototype._then = function (didFulfill, didReject, didProgress, receiver, internalData) {
  var ret = bluebirdThen.call(this, didFulfill, didReject, didProgress, receiver, internalData);

  // Needed to transfer sql events accross .then() calls
  if (ret && ret.emit) {
    if (!ret.$sql) {
      ret.$sql = [];
    }
    this.proxySql(ret);
  }

  return ret;
};


var bluebirdSettle = Promise.prototype._settlePromiseAt;
Promise.prototype._settlePromiseAt = function (index) {
  bluebirdSettle.call(this, index);
  var receiver = this._receiverAt(index);

  if (this.$sql && receiver && receiver.emit) {
    this.$sql.forEach(function (sql) {
      receiver.emit("sql", sql);
    });
  }
};

var bluebirdAll = Promise.all;
SequelizePromise.all = function (promises) {
  var ret = bluebirdAll.call(this, promises);

  // Propagate sql events
  var self = this;
  if (Array.isArray(promises)) {
    promises.forEach(function (promise) {
      if (Promise.is(promise)) {
        promise.on("sql", function (sql) {
          ret.emit("sql", sql);
        });

        if (!promise.$sql) {
          promise.$sql = [];
        }
        promise.$sql.forEach(function (sql) {
          ret.emit("sql", sql);
        });
      }
    });
  }

  return ret;
};

/**
 * Listen for events, event emitter style. Mostly for backwards compat. with EventEmitter
 *
 * @param {String} evt
 * @param {Function} fct
 */
Promise.prototype.on = function(evt, fct) {
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
Promise.prototype.emit = function(evt) {
  var args = arguments.length > 1 ? Array.prototype.slice.call(arguments, 1) : [];

  if (evt === 'success') {
    this.seqResolve.apply(this, args);
  } else if (evt === 'error') {
    this.seqReject.apply(this, args);
  } else {
    // Needed to transfer sql across .then() calls
    if (evt === 'sql') {
      if (!this.$sql) {
        this.$sql = [];
      }
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
Promise.prototype.success =
Promise.prototype.ok = function(fct) {
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
Promise.prototype.error =
Promise.prototype.failure =
Promise.prototype.fail = function(fct) {
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
Promise.prototype.done =
Promise.prototype.complete = function(fct) {
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
Promise.prototype.sql = function(fct) {
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
Promise.prototype.proxy = function(promise, options) {
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

Promise.prototype.proxySql = function(promise) {
  return this.proxy(promise, {
    events: ['sql']
  });
};

module.exports = SequelizePromise;
