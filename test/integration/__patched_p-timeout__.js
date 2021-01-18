/**
 * This is just `https://npmjs.com/package/p-timeout` transpiled with Babel.js to ensure compatibility with Node.js 6
 */
'use strict';

function asyncGeneratorStep(gen, resolve, reject, _next, _throw, key, arg) { try { var info = gen[key](arg); var value = info.value; } catch (error) { reject(error); return; } if (info.done) { resolve(value); } else { Promise.resolve(value).then(_next, _throw); } }

function _asyncToGenerator(fn) { return function () { var self = this, args = arguments; return new Promise(function (resolve, reject) { var gen = fn.apply(self, args); function _next(value) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "next", value); } function _throw(err) { asyncGeneratorStep(gen, resolve, reject, _next, _throw, "throw", err); } _next(undefined); }); }; }

function ownKeys(object, enumerableOnly) { var keys = Object.keys(object); if (Object.getOwnPropertySymbols) { var symbols = Object.getOwnPropertySymbols(object); if (enumerableOnly) symbols = symbols.filter(function (sym) { return Object.getOwnPropertyDescriptor(object, sym).enumerable; }); keys.push.apply(keys, symbols); } return keys; }

function _objectSpread(target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i] != null ? arguments[i] : {}; if (i % 2) { ownKeys(Object(source), true).forEach(function (key) { _defineProperty(target, key, source[key]); }); } else if (Object.getOwnPropertyDescriptors) { Object.defineProperties(target, Object.getOwnPropertyDescriptors(source)); } else { ownKeys(Object(source)).forEach(function (key) { Object.defineProperty(target, key, Object.getOwnPropertyDescriptor(source, key)); }); } } return target; }

function _defineProperty(obj, key, value) { if (key in obj) { Object.defineProperty(obj, key, { value: value, enumerable: true, configurable: true, writable: true }); } else { obj[key] = value; } return obj; }

class TimeoutError extends Error {
  constructor(message) {
    super(message);
    this.name = 'TimeoutError';
  }

}

const pTimeout = (promise, milliseconds, fallback, options) => {
  let timer;
  const cancelablePromise = new Promise((resolve, reject) => {
    if (typeof milliseconds !== 'number' || milliseconds < 0) {
      throw new TypeError('Expected `milliseconds` to be a positive number');
    }

    if (milliseconds === Infinity) {
      resolve(promise);
      return;
    }

    options = _objectSpread({
      customTimers: {
        setTimeout,
        clearTimeout
      }
    }, options);
    timer = options.customTimers.setTimeout.call(undefined, () => {
      if (typeof fallback === 'function') {
        try {
          resolve(fallback());
        } catch (error) {
          reject(error);
        }

        return;
      }

      const message = typeof fallback === 'string' ? fallback : `Promise timed out after ${milliseconds} milliseconds`;
      const timeoutError = fallback instanceof Error ? fallback : new TimeoutError(message);

      if (typeof promise.cancel === 'function') {
        promise.cancel();
      }

      reject(timeoutError);
    }, milliseconds);

    _asyncToGenerator(function* () {
      try {
        resolve(yield promise);
      } catch (error) {
        reject(error);
      } finally {
        options.customTimers.clearTimeout.call(undefined, timer);
      }
    })();
  });

  cancelablePromise.clear = () => {
    clearTimeout(timer);
    timer = undefined;
  };

  return cancelablePromise;
};

module.exports = pTimeout; // TODO: Remove this for the next major release

module.exports.default = pTimeout;
module.exports.TimeoutError = TimeoutError;
