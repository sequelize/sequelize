import type { AssertionFunction, NegatedAssertionFunction } from '../_internal/build-predicate-function.js';
/**
 * Returns true if the value is a JS IEEE 754 number (not bigint).
 *
 * @param value The value to compare.
 */
export declare const isNumber: AssertionFunction<number>;
export declare const isNotNumber: NegatedAssertionFunction<number>;
