import type {
  AssertionFunction,
  NegatedAssertionFunction,
} from '../_internal/build-predicate-function.js';
import { buildAssertionFunction, toBe } from '../_internal/build-predicate-function.js';

const tuple = buildAssertionFunction<Function>((value: unknown): value is Function => {
  return typeof value === 'function';
}, toBe('a function'));

/**
 * Returns true if a value is a function:
 *
 * isFunction(() => {}); // true
 * isFunction(class A {}); // true
 * isFunction((class {}).bind()); // true
 */
export const isFunction: AssertionFunction<Function> = tuple[0];
export const isNotFunction: NegatedAssertionFunction<Function> = tuple[1];
