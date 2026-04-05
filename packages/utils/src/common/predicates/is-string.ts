import type {
  AssertionFunction,
  NegatedAssertionFunction,
} from '../_internal/build-predicate-function.js';
import { buildAssertionFunction, toBe } from '../_internal/build-predicate-function.js';

const tuple = buildAssertionFunction((value: unknown): value is string => {
  return typeof value === 'string';
}, toBe('a string'));

/**
 * Returns true if the value is a string.
 *
 * @param value The value to compare.
 */
export const isString: AssertionFunction<string> = tuple[0];
export const isNotString: NegatedAssertionFunction<string> = tuple[1];
