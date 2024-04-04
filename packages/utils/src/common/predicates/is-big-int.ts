import type {
  AssertionFunction,
  NegatedAssertionFunction,
} from '../_internal/build-predicate-function.js';
import { buildAssertionFunction, toBe } from '../_internal/build-predicate-function.js';

const tuple = buildAssertionFunction((value: unknown): value is bigint => {
  return typeof value === 'bigint';
}, toBe('a bigint'));

/**
 * Returns true if the value is a JS bigint.
 *
 * @param value The value to compare.
 */
export const isBigInt: AssertionFunction<bigint> = tuple[0];
export const isNotBigInt: NegatedAssertionFunction<bigint> = tuple[1];
