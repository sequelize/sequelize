export * from './index.default.js';

// For some reason, the code looks for `util.inspect` function in `default` sub-object,
// so added a `default` property to the export: it simply re-exports all exported functions.
export * as default from './index.default.js';
