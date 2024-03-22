import type { AssertionFunction, NegatedAssertionFunction } from '../_internal/build-predicate-function.js';
/**
 * Returns true if the value is a JS bigint.
 *
 * @param value The value to compare.
 */
export declare const isBigInt: AssertionFunction<bigint>;
export declare const isNotBigInt: NegatedAssertionFunction<bigint>;
