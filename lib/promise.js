var util            = require("util")
  , Promise         = require("bluebird")
  , EventEmitter    = require("events").EventEmitter
  , proxyEventKeys  = ['success', 'error', 'sql']
  , Utils           = require('./utils')
  , INTERNAL        = function() {}
  , async           = require("bluebird/js/main/async.js")

var SequelizePromise = function(resolver) {
  var self = this;

  // Copied from Bluebird, bluebird doesn't like Promise.call(this)
  // mhansen wrote and is no fan of this, but sees no other way of making Promises first class while preserving SQL logging capabilities and BC.
  this._bitField = 0;
  this._fulfillmentHandler0 = void 0;
  this._rejectionHandler0 = void 0;
  this._promise0 = void 0;
  this._receiver0 = void 0;
  this._settledValue = void 0;
  this._boundTo = void 0;

  // Intercept the resolver so we can resolve with emit's
  this._resolveFromResolver(function (resolve, reject) {
    self.seqResolve = resolve;
    self.seqReject = reject;

    if (resolver) {
      resolver.apply(this, arguments);
    }
  }.bind(this));

  // Sequelize speific
  this.$sql = [];
};

util.inherits(SequelizePromise, Promise)

// Need to hack _then to make sure our promise is chainable
SequelizePromise.prototype._then = function (
  didFulfill,
  didReject,
  didProgress,
  receiver,
  internalData
) {
  var haveInternalData = internalData !== void 0;
  var ret = haveInternalData ? internalData : new SequelizePromise(INTERNAL); // The relevant line, rest is fine

  if (!haveInternalData && this._isBound()) {
    ret._setBoundTo(this._boundTo);
  }

  /*
   * Start of sequelize specific 
   * Needed to transfer sql events accross .then() calls
   */
  if (this.proxySql && ret.emit) {
    this.proxySql(ret);
  }
  /*
   * End of sequelize specific 
   */

  var callbackIndex = this._addCallbacks(didFulfill, didReject, didProgress, ret, receiver);

  if (!haveInternalData && this._cancellable()) {
    ret._setCancellable();
    ret._cancellationParent = this;
  }

  if (this.isResolved()) {
    async.invoke(this._queueSettleAt, this, callbackIndex);
  }

  return ret;
};

SequelizePromise.prototype._settlePromiseAt = function (index) {
  var receiver = this._receiverAt(index);

  if (this.$sql && receiver && receiver.emit) {
    this.$sql.forEach(function (sql) {
      if (receiver && receiver.emit) {
        receiver.emit('sql', sql);
      }
    });
  }

  return Promise.prototype._settlePromiseAt.apply(this, arguments);
};

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
}

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
  this.then(fct);
  return this;
}

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
 * @metohd error
 * @alias fail
 * @alias failure
 * @return this
 */

SequelizePromise.prototype.failure =
SequelizePromise.prototype.fail =
SequelizePromise.prototype.error = function(fct) {
  this.then(null, fct);
  return this;
}

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
SequelizePromise.prototype.done =
SequelizePromise.prototype.complete = function(fct) {
  if (fct.length > 2) {
    this.spread(function () {
      fct.apply(null, [null].concat(Array.prototype.slice.call(arguments)));
    }, fct);
  } else {
    this.then(function () {
      fct.apply(null, [null].concat(Array.prototype.slice.call(arguments)));
    }, fct);
  }

  return this;
};

/*
 * Attach a function that is called every time the function that created this emitter executes a query.
 * @param {function} onSQL
 * @return this
 */
SequelizePromise.prototype.sql = function(fct) {
  this.on('sql', fct)
  return this;
}

/**
 * Proxy every event of this promise to another one.
 *
 * @param  {SequelizePromise} The promise that should receive the events.
 * @param  {Object}       [options]
 * @param  {Array}        [options.events] An array of the events to proxy. Defaults to sql, error and success
 * @return this
 */
SequelizePromise.prototype.proxy = function(promise, options) {
  options = Utils._.extend({
    events:     proxyEventKeys,
    skipEvents: []
  }, options || {})

  options.events = Utils._.difference(options.events, options.skipEvents)

  options.events.forEach(function (eventKey) {
    this.on(eventKey, function () {
      var args = [ eventKey ].concat([].slice.apply(arguments))
      promise.emit.apply(promise, args)
    })
  }.bind(this))

  return this
}

SequelizePromise.prototype.proxySql = function(promise) {
  return this.proxy(promise, {
    events: ['sql']
  });
};

module.exports = SequelizePromise;