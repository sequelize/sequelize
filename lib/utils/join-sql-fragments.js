'use strict';

function doesNotWantLeadingSpace(str) {
  return /^[;,)]/.test(str);
}
function doesNotWantTrailingSpace(str) {
  return /\($/.test(str);
}

/**
 * Joins an array of strings with a single space between them,
 * except for:
 * 
 * - Strings starting with ';', ',' and ')', which do not get a leading space.
 * - Strings ending with '(', which do not get a trailing space.
 * 
 * @param {string[]} parts
 * @returns {string}
 * @private
 */
function singleSpaceJoinHelper(parts) {
  return parts.reduce(({ skipNextLeadingSpace, result }, part) => {
    if (skipNextLeadingSpace || doesNotWantLeadingSpace(part)) {
      result += part.trim();
    } else {
      result += ` ${part.trim()}`;
    }
    return {
      skipNextLeadingSpace: doesNotWantTrailingSpace(part),
      result
    };
  }, {
    skipNextLeadingSpace: true,
    result: ''
  }).result;
}

/**
 * Joins an array with a single space, auto trimming when needed.
 * 
 * Certain elements do not get leading/trailing spaces.
 * 
 * @param {any[]} array The array to be joined. Falsy values are skipped. If an
 * element is another array, this function will be called recursively on that array.
 * Otherwise, if a non-string, non-falsy value is present, a TypeError will be thrown.
 * 
 * @returns {string} The joined string.
 * 
 * @private
 */
function joinSQLFragments(array) {
  if (array.length === 0) return '';

  // Skip falsy fragments
  array = array.filter(x => x);

  // Resolve recursive calls
  array = array.map(fragment => {
    if (Array.isArray(fragment)) {
      return joinSQLFragments(fragment);
    }
    return fragment;
  });

  // Ensure strings
  for (const fragment of array) {
    if (fragment && typeof fragment !== 'string') {
      const error = new TypeError(`Tried to construct a SQL string with a non-string, non-falsy fragment (${fragment}).`);
      error.args = array;
      error.fragment = fragment;
      throw error;
    }
  }

  // Trim fragments
  array = array.map(x => x.trim());

  // Skip full-whitespace fragments (empty after the above trim)
  array = array.filter(x => x !== '');

  return singleSpaceJoinHelper(array);
}
exports.joinSQLFragments = joinSQLFragments;
