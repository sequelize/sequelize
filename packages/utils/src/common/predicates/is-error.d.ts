import type { AssertionFunction, NegatedAssertionFunction } from '../_internal/build-predicate-function.js';
/**
 * Returns true if the value is a JS built-in Error instance, or one of its child classes.
 *
 * @param value The value to compare.
 */
export declare const isError: AssertionFunction<Error>;
export declare const isNotError: NegatedAssertionFunction<Error>;
