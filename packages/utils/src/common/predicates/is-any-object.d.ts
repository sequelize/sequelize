import type { AssertionFunction, NegatedAssertionFunction } from '../_internal/build-predicate-function.js';
/**
 * Returns whether the provided value is a JavaScript Object (i.e. anything but a primitive).
 *
 * You will typically want to use more specific functions such as {@link isPlainObject} instead
 */
export declare const isAnyObject: AssertionFunction<object>;
export declare const isNotAnyObject: NegatedAssertionFunction<object>;
