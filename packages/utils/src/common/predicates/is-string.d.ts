import type { AssertionFunction, NegatedAssertionFunction } from '../_internal/build-predicate-function.js';
/**
 * Returns true if the value is a string.
 *
 * @param value The value to compare.
 */
export declare const isString: AssertionFunction<string>;
export declare const isNotString: NegatedAssertionFunction<string>;
