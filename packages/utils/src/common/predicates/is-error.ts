import type {
  AssertionFunction,
  NegatedAssertionFunction,
} from '../_internal/build-predicate-function.js';
import { buildAssertionFunction, toBe } from '../_internal/build-predicate-function.js';

const tuple = buildAssertionFunction((value: unknown): value is Error => {
  return value instanceof Error;
}, toBe('an instance of Error'));

/**
 * Returns true if the value is a JS built-in Error instance, or one of its child classes.
 *
 * @param value The value to compare.
 */
export const isError: AssertionFunction<Error> = tuple[0];
export const isNotError: NegatedAssertionFunction<Error> = tuple[1];
