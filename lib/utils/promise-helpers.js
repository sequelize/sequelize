'use strict';

// Sequential iteration: awaits each callback in turn. Resolves to undefined.
exports.each = async (items, fn) => {
  for (let i = 0; i < items.length; i++) {
    await fn(items[i], i, items.length);
  }
};

// Concurrent iteration: like bluebird's Promise.map without a concurrency option.
exports.map = (items, fn) => Promise.all(items.map((item, i) => fn(item, i, items.length)));

// Resolves all values of an object's own enumerable properties.
exports.props = async (obj) => {
  const keys = Object.keys(obj);
  const values = await Promise.all(keys.map((k) => obj[k]));
  const out = {};
  for (let i = 0; i < keys.length; i++) {
    out[keys[i]] = values[i];
  }
  return out;
};

// Bluebird-compatible .tap: run side-effect, pass original value through.
exports.tap = (promise, fn) =>
  promise.then(async (value) => {
    await fn(value);
    return value;
  });

// Bluebird-compatible Promise.delay.
exports.delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Bluebird `.method(fn)` equivalent: returns a function that always returns a Promise,
// converting synchronous throws into rejections.
exports.method =
  (fn) =>
  (...args) => {
    try {
      return Promise.resolve(fn(...args));
    } catch (e) {
      return Promise.reject(e);
    }
  };

// Bluebird `Promise.try` equivalent: invokes `fn` synchronously (in the current tick),
// returns a Promise. Synchronous throws become rejections. Use this when the timing
// of the call matters (e.g. observable state changes between the call and the next
// microtask) — for purely-async code, `Promise.resolve().then(fn)` works too.
exports.tryFn = (fn) => {
  try {
    return Promise.resolve(fn());
  } catch (e) {
    return Promise.reject(e);
  }
};

// Adapter producing bluebird's PromiseInspection-shape from a settled native promise.
// Use as: `somePromise.then(inspectFulfilled, inspectRejected)`.
exports.inspectFulfilled = (value) => ({
  isFulfilled: () => true,
  isRejected: () => false,
  value: () => value,
  reason: () => undefined,
  error: () => undefined
});
exports.inspectRejected = (reason) => ({
  isFulfilled: () => false,
  isRejected: () => true,
  value: () => undefined,
  reason: () => reason,
  error: () => reason
});

// Concurrency-limited map: at most `concurrency` callbacks in flight.
exports.mapWithConcurrency = async (items, fn, { concurrency } = {}) => {
  if (!concurrency || concurrency >= items.length) {
    return Promise.all(items.map((item, i) => fn(item, i, items.length)));
  }
  const results = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (true) {
      const i = next++;
      if (i >= items.length) {
        return;
      }
      results[i] = await fn(items[i], i, items.length);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
};
