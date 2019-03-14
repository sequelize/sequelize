'use strict';

/**
 * Fast object iteration.
 *
 * @param {Object} obj
 * @param {Function} fn
 */
function forEach(obj, fn) {
  Object.keys(obj).forEach(k => {
    fn(obj[k], k);
  });
}
exports.forEach = forEach;

/**
 * Fast array and object iteration.
 *
 * @param {Object|Array} coll
 * @param {Function} fn
 */
function forEachCollection(coll, fn) {
  if (Array.isArray(coll)) {
    coll.forEach(fn);
    return;
  }
  forEach(coll, fn);
}
exports.forEachCollection = forEachCollection;
