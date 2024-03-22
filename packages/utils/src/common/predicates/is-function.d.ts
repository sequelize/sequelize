import type { AssertionFunction, NegatedAssertionFunction } from '../_internal/build-predicate-function.js';
/**
 * Returns true if a value is a function:
 *
 * isFunction(() => {}); // true
 * isFunction(class A {}); // true
 * isFunction((class {}).bind()); // true
 */
export declare const isFunction: AssertionFunction<Function>;
export declare const isNotFunction: NegatedAssertionFunction<Function>;
