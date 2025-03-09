import type {
  AssertionFunction,
  NegatedAssertionFunction,
} from '../_internal/build-predicate-function.js';
import { buildAssertionFunction, toBe } from '../_internal/build-predicate-function.js';
import { isFunction } from './is-function.js';

const tuple = buildAssertionFunction((value: unknown): value is Iterable<unknown> => {
  // @ts-expect-error -- TS does not allow accessing Symbol.iterator like this.
  return value != null && isFunction(value[Symbol.iterator]);
}, toBe('an iterable'));

/**
 * Returns true if the value is null or undefined.
 *
 * @param value The value to compare.
 */
export const isIterable: AssertionFunction<Iterable<unknown>> = tuple[0];
export const isNotIterable: NegatedAssertionFunction<Iterable<unknown>> = tuple[1];
