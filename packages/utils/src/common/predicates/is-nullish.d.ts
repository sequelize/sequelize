import type { AssertionFunction, NegatedAssertionFunction } from '../_internal/build-predicate-function.js';
import type { Nullish } from '../types.js';
/**
 * Returns true if the value is null or undefined.
 *
 * @param value The value to compare.
 */
export declare const isNullish: AssertionFunction<Nullish>;
export declare const isNotNullish: NegatedAssertionFunction<Nullish>;
