'use strict';

/**
 * Joins an array with a single space, auto trimming when needed.
 * 
 * If the last entry is a ';', it won't have a leading space.
 *
 * @param {any[]} array The array to be joined. Falsy values are skipped. If a
 * non-string, non-falsy value is present, a TypeError will be thrown.
 * @returns {string} The joined string
 * 
 * @private
 */
function joinSQLFragments(array) {
  const result = array.filter(fragment => {
    if (fragment && typeof fragment !== 'string') {
      throw new TypeError(`Tried to construct a SQL string with a non-string, non-falsy fragment (${fragment}).`);
    }
    return !!fragment;
  }).map(x => `${x}`.trim()).filter(x => !!x).join(' ');
  return result.replace(/ ;$/, ';');
}
exports.joinSQLFragments = joinSQLFragments;
