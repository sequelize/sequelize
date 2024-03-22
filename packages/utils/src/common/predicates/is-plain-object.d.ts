import type { AssertionFunction, NegatedAssertionFunction } from '../_internal/build-predicate-function.js';
import type { AnyRecord } from '../types.js';
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
export declare const isPlainObject: AssertionFunction<AnyRecord>;
export declare const isNotPlainObject: NegatedAssertionFunction<AnyRecord>;
