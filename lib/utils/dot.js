// Nested object access by `.` separated path. Behaviour is ported from dottie
// (https://github.com/mickhansen/dottie.js, MIT, by Mick Hansen), which this replaced
// after it was deprecated on npm. Trimmed to the `get`/`set` this codebase uses:
// no `defaultValue` argument, no `force` option, and no path memoization (dottie's memo
// cache was unbounded).

// Path segments that would let a caller-supplied path reach into a prototype.
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Reads `object` at a `.` separated path.
 *
 * @param object The object to read from
 * @param path A `.` separated path (e.g. `'user.address.city'`), or its already split segments.
 *             Pre-split segments may themselves contain dots.
 *
 * @returns The value at `path`, or undefined if the path is unreachable
 */
export function get(object, path) {
  if (object === null || object === undefined || path === null || path === undefined) {
    return undefined;
  }

  const pieces = Array.isArray(path) ? path : path.split('.');

  let current = object;
  for (const piece of pieces) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[piece];
  }

  return current;
}

/**
 * Writes `value` into `object` at a `.` separated path, creating plain objects along the way.
 * Paths containing a prototype-reaching segment are ignored.
 *
 * @param object The object to write into
 * @param path A `.` separated path, or its already split segments
 * @param value The value to write
 *
 * @throws If a non-object already occupies part of the path
 */
export function set(object, path, value) {
  const pieces = Array.isArray(path) ? path : path.split('.');
  if (pieces.some((piece) => UNSAFE_KEYS.has(piece))) {
    return;
  }

  let current = object;
  for (let index = 0; index < pieces.length - 1; index++) {
    const piece = pieces[index];
    // An absent key and an explicitly undefined one both become a fresh namespace.
    if (!Object.hasOwn(current, piece) || current[piece] === undefined) {
      current[piece] = {};
    }
    current = current[piece];
    if (current === null || typeof current !== 'object') {
      throw new Error(`Target key "${piece}" is not suitable for a nested value. (It is in use as non-object.)`);
    }
  }

  current[pieces[pieces.length - 1]] = value;
}
