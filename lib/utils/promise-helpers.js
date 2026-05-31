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
exports.props = async obj => {
  const keys = Object.keys(obj);
  const values = await Promise.all(keys.map(k => obj[k]));
  const out = {};
  for (let i = 0; i < keys.length; i++) out[keys[i]] = values[i];
  return out;
};

// Bluebird-compatible .tap: run side-effect, pass original value through.
exports.tap = (promise, fn) =>
  promise.then(async value => {
    await fn(value);
    return value;
  });

// Bluebird-compatible Promise.delay.
exports.delay = ms => new Promise(resolve => setTimeout(resolve, ms));
