import type {
  AssertionFunction,
  NegatedAssertionFunction,
} from '../_internal/build-predicate-function.js';
import { buildAssertionFunction, toBe } from '../_internal/build-predicate-function.js';
import type { Nullish } from '../types.js';

const tuple = buildAssertionFunction((value: unknown): value is null | undefined => {
  return value === null || value === undefined;
}, toBe('null or undefined'));

/**
 * Returns true if the value is null or undefined.
 *
 * @param value The value to compare.
 */
export const isNullish: AssertionFunction<Nullish> = tuple[0];
export const isNotNullish: NegatedAssertionFunction<Nullish> = tuple[1];
