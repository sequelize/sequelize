var util            = require("util")
  , Promise
  , EventEmitter    = require("events").EventEmitter
  , proxyEventKeys  = ['success', 'error', 'sql']
  , Utils           = require('./utils')
  , INTERNAL        = function() {}
  , async           = require("bluebird/js/main/async.js")

/**
 * A slightly modified version of bluebird promises. This means that, on top of the methods below, you can also call all the methods listed on the link below.
 *
 * The main difference is that sequelize promises allows you to attach a listener that will be called with the generated SQL, each time a query is run.
 * 
 * @mixes https://github.com/petkaantonov/bluebird/blob/master/API.md
 * @class Promise
 */
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
  this._resolveFromResolver(function resolverIntercept(resolve, reject) {
    self.seqResolve = resolve;
    self.seqReject = reject;

    if (resolver) {
      resolver.apply(this, arguments);
    }
  }.bind(this));

  // Sequelize speific
  this.$sql = [];
};

Promise = require("bluebird")

util.inherits(SequelizePromise, Promise)
Utils._.extend(SequelizePromise, Promise)

SequelizePromise.is = function (obj) {
  if (obj === void 0) return false;
  return obj instanceof Promise || obj instanceof SequelizePromise;
}

SequelizePromise.all = function(promises) {
  var resolved = SequelizePromise.resolve(Promise.all(promises));

  // Propagate sql events
  promises.forEach(function (promise) {
    if (SequelizePromise.is(promise)) {
      promise.on('sql', function (sql) {
        resolved.emit('sql', sql);
      });

      promise.$sql.forEach(function (sql) {
        resolved.emit('sql', sql);
      });  
    }
  });

  return resolved;
};

SequelizePromise.settle = function (promises) {
  var settled = SequelizePromise.resolve(Promise.settle(promises))

  // Propagate sql events
  promises.forEach(function (promise) {
    if (SequelizePromise.is(promise)) {
      promise.on('sql', function (sql) {
        settled.emit('sql', sql);
      });

      promise.$sql.forEach(function (sql) {
        settled.emit('sql', sql);
      });
    }
  });

  return settled;
}

SequelizePromise.method = function (fn) {
  return function Promise$_method() {
      var value = tryCatchApply(fn, Array.prototype.slice.apply(arguments), this);

      var ret = new SequelizePromise(INTERNAL);
      ret._setTrace(void 0);
      ret._resolveFromSyncValue(value);
      return ret;
  };
};

SequelizePromise.prototype._resolveFromSyncValue = function(value) {
    if (value && value.hasOwnProperty('e')) {
        this._cleanValues();
        this._setRejected();
        this._settledValue = value.e;
        this._ensurePossibleRejectionHandled();
    }
    else {
        var maybePromise = Promise._cast(value, void 0);
        if (maybePromise instanceof Promise || maybePromise instanceof SequelizePromise) {
            this._follow(maybePromise);
        }
        else {
            this._cleanValues();
            this._setFulfilled();
            this._settledValue = value;
        }
    }
};

SequelizePromise.attempt = SequelizePromise.try = function (fn, args, ctx) {
    var value = tryCatchApply(fn, args, ctx)

    var ret = new SequelizePromise(INTERNAL);
    ret._setTrace(void 0);
    ret._resolveFromSyncValue(value);
    return ret;
};

// Need to hack resolve cause we can't hack all directrly
SequelizePromise.resolve = SequelizePromise.fulfilled = function(value) {
  var ret = new SequelizePromise(INTERNAL);

  if (ret._tryFollow(value)) {
    return ret;
  }
  ret._cleanValues();
  ret._setFulfilled();
  ret._settledValue = value;
  return ret;
};

SequelizePromise.promisify = function (callback, receiver) {
  function promisified() {
    var _receiver = receiver;
    var promise = new SequelizePromise(INTERNAL);
    promise._setTrace(void 0);
    var fn = function PromiseResolver$_callback(err, value) {
      if (err) {
        var wrapped = maybeWrapAsError(err);
        promise._attachExtraTrace(wrapped);
        promise._reject(wrapped);
      }
      else {
        if (arguments.length > 2) {
          promise._fulfill(Array.prototype.slice.call(arguments, 1));
        }
        else {
          promise._fulfill(value);
        }
      }
    }
    try {
      callback.apply(_receiver, withAppended(arguments, fn));
    }
    catch(e) {
      var wrapped = maybeWrapAsError(e);
      promise._attachExtraTrace(wrapped);
      promise._reject(wrapped);
    }
    return promise;
  }
  promisified.__isPromisified__ = true;
  return promisified;
}

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

  // Start of sequelize specific 
  // Needed to transfer sql events accross .then() calls
  if (this.proxySql && ret && ret.emit) {
    this.proxySql(ret);
  }
  // End of sequelize specific 

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
      receiver.emit('sql', sql);
    });
  }

  return Promise.prototype._settlePromiseAt.apply(this, arguments);
};

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
}

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
  if (fct.length > 1) {
    return this.spread(fct);
  } else {
    return this.then(fct);
  }
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
 * @method error
 * @alias fail
 * @alias failure
 * @return this
 */
SequelizePromise.prototype.failure =
SequelizePromise.prototype.fail =
SequelizePromise.prototype.error = function(fct) {
  return this.then(null, fct);
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
    return this.spread(function () {
      fct.apply(null, [null].concat(Array.prototype.slice.call(arguments)));
    }, fct);
  } else {
    return this.then(function () {
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
  this.on('sql', fct)
  return this;
}

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

// Utility methods
function withAppended(target, appendee) {
  var len = target.length;
  var ret = new Array(len + 1);
  var i;
  for (i = 0; i < len; ++i) {
    ret[i] = target[i];
  }
  ret[i] = appendee;
  return ret;
}

function isPrimitive(val) {
  return val == null || val === true || val === false ||
    typeof val === "string" || typeof val === "number";

}

function maybeWrapAsError(maybeError) {
  if (!isPrimitive(maybeError)) return maybeError;

  return new Error(asString(maybeError));
}

function tryCatchApply(fn, args, receiver) {
  try {
    return fn.apply(receiver, args);
  }
  catch (e) {
    return {e: e};
  }
}

module.exports = SequelizePromise;