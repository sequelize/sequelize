import type {
  AssertionFunction,
  NegatedAssertionFunction,
} from '../_internal/build-predicate-function.js';
import { buildAssertionFunction, toBe } from '../_internal/build-predicate-function.js';

type Type = Function;

const tuple = buildAssertionFunction<Type>((value: unknown): value is Type => {
  return typeof value === 'function';
}, toBe('a function'));

/**
 * Returns true if a value is a function:
 *
 * isFunction(() => {}); // true
 * isFunction(class A {}); // true
 * isFunction((class {}).bind()); // true
 */
export const isFunction: AssertionFunction<Type> = tuple[0];
export const isNotFunction: NegatedAssertionFunction<Type> = tuple[1];
