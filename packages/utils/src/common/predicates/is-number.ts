import type {
  AssertionFunction,
  NegatedAssertionFunction,
} from '../_internal/build-predicate-function.js';
import { buildAssertionFunction, toBe } from '../_internal/build-predicate-function.js';

const tuple = buildAssertionFunction((value: unknown): value is number => {
  return typeof value === 'number';
}, toBe('an IEEE 754 number'));

/**
 * Returns true if the value is a JS IEEE 754 number (not bigint).
 *
 * @param value The value to compare.
 */
export const isNumber: AssertionFunction<number> = tuple[0];
export const isNotNumber: NegatedAssertionFunction<number> = tuple[1];
