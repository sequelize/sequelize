/// <reference types="node" />
import type { AssertionFunction, NegatedAssertionFunction } from '../common/_internal/build-predicate-function.js';
/**
 * Returns true if the value is a node error.
 *
 * @param value The value to compare.
 */
export declare const isNodeError: AssertionFunction<NodeJS.ErrnoException>;
export declare const isNotNodeError: NegatedAssertionFunction<NodeJS.ErrnoException>;
