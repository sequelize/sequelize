import type { AssertionFunction, NegatedAssertionFunction } from '../_internal/build-predicate-function.js';
/**
 * Returns true if the value is null or undefined.
 *
 * @param value The value to compare.
 */
export declare const isIterable: AssertionFunction<Iterable<unknown>>;
export declare const isNotIterable: NegatedAssertionFunction<Iterable<unknown>>;
