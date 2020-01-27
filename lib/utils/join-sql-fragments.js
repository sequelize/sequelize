'use strict';

/**
 * Joins an array of strings with a single space between them,
 * except for:
 * 
 * - Strings starting with ';', ',' and ')', which do not get a leading space.
 * - Strings ending with '(', which do not get a trailing space.
 * 
 * @param {string[]} parts Assumed to be non-empty.
 * @returns {string}
 * @private
 */
function singleSpaceJoinHelper(parts) {
  let result = parts[0];
  if (parts.length === 1) return result;
  let skipNextLeadingSpace = false;
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (/^[;,)]/.test(part)) {
      result += part;
    } else {
      result += `${skipNextLeadingSpace ? '' : ' '}${part.trim()}`;
    }
    skipNextLeadingSpace = /\($/.test(part);
  }
  return result;
}

/**
 * Checks if this is a valid config object.
 * 
 * @param {object} config Assumed not null.
 * @returns {boolean}
 * @private
 */
function isValidConfigObject(config) {
  const keys = Object.keys(config);
  if (keys.length !== 1 || keys[0] !== 'wrap') return false;
  if (!Array.isArray(config.wrap)) return false;
  if (config.wrap.length !== 2) return false;
  for (const part of config.wrap) {
    if (typeof part !== 'string') return false;
  }
  return true;
}

/**
 * Extracts and returns the first element of the given array
 * if it matches the concept of a config object.
 * 
 * May modify the given array.
 * 
 * @param {Array} array Assumed to be non-empty.
 * @returns {object|undefined}
 * @private
 */
function extractConfig(array) {
  const first = array[0];
  if (first && typeof first === 'object') {
    if (!isValidConfigObject(first)) {
      const error = new TypeError('Invalid config object passed to joinSQLFragments():');
      error.configObject = first;
      error.args = array;
      throw error;
    }
    array.splice(0, 1);
    return first;
  }
}

/**
 * Joins an array with a single space, auto trimming when needed.
 * 
 * @param {any[]} array The array to be joined. Falsy values are skipped. If the first
 * element is a plain-object with a `wrap` field, it will be used to wrap the result.
 * Elements identical to `;`, `,` will not receive leading space (only trailing). If an
 * element is another array, this function will be called recursively on that array.
 * Otherwise, if a non-string, non-falsy value is present, a TypeError will be thrown.
 * 
 * @returns {string} The joined string
 * 
 * @private
 */
function joinSQLFragments(array) {
  if (array.length === 0) return '';
  const originalArray = array;
  array = array.slice();

  // Skip falsy fragments
  array = array.filter(x => x);

  // Resolve recursive calls
  array = array.map(fragment => {
    if (Array.isArray(fragment)) {
      return joinSQLFragments(fragment);
    }
    return fragment;
  });

  // Extract config
  const config = extractConfig(array);

  // Ensure strings
  for (const fragment of array) {
    if (fragment && typeof fragment !== 'string') {
      const error = new TypeError(`Tried to construct a SQL string with a non-string, non-falsy fragment (${fragment}).`);
      error.args = originalArray;
      error.fragment = fragment;
      throw error;
    }
  }

  // Trim fragments
  array = array.map(x => x.trim());

  // Skip full-whitespace fragments (empty after the above trim)
  array = array.filter(x => x !== '');

  const joined = singleSpaceJoinHelper(array);
  
  if (config && config.wrap) {
    return config.wrap[0] + joined + config.wrap[1];
  }
  return joined;
}
exports.joinSQLFragments = joinSQLFragments;
