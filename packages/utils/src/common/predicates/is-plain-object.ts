import type {
  AssertionFunction,
  NegatedAssertionFunction,
} from '../_internal/build-predicate-function.js';
import { buildAssertionFunction, toBe } from '../_internal/build-predicate-function.js';
import type { AnyRecord } from '../types.js';

const tuple = buildAssertionFunction((value: unknown): value is AnyRecord => {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);

  return prototype === null || prototype === Object.prototype;
}, toBe('a plain object (an object built using the literal syntax, or pojo())'));

/**
 * Returns whether something is a plain object
 * A plain object is an object that either has no prototype at all (no inherited methods) or only inherits from Object.prototype
 *
 * @example
 * isPlainObject({ a: 1 }); // true
 * isPlainObject(pojo()); // true
 * isPlainObject(new Date()); // false
 *
 * @param value The value to compare.
 */
export const isPlainObject: AssertionFunction<AnyRecord> = tuple[0];
export const isNotPlainObject: NegatedAssertionFunction<AnyRecord> = tuple[1];
