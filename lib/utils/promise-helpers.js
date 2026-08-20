// Sequential iteration: awaits each callback in turn. Resolves to undefined.
export const each = async (items, fn) => {
  for (let i = 0; i < items.length; i++) {
    await fn(items[i], i, items.length);
  }
};

// Resolves all values of an object's own enumerable properties.
export const props = async (obj) => {
  const keys = Object.keys(obj);
  const values = await Promise.all(keys.map((k) => obj[k]));
  const out = {};
  for (let i = 0; i < keys.length; i++) {
    out[keys[i]] = values[i];
  }
  return out;
};

// Bluebird-compatible Promise.delay.
export const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Bluebird `Promise.try` equivalent: invokes `fn` synchronously (in the current tick),
// returns a Promise. Synchronous throws become rejections. Use this when the timing
// of the call matters (e.g. observable state changes between the call and the next
// microtask) — for purely-async code, `Promise.resolve().then(fn)` works too.
export const tryFn = (fn) => {
  try {
    return Promise.resolve(fn());
  } catch (e) {
    return Promise.reject(e);
  }
};

// Concurrency-limited map: at most `concurrency` callbacks in flight.
export const mapWithConcurrency = async (items, fn, { concurrency } = {}) => {
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
