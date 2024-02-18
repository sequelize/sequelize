import type {
  AssertionFunction,
  NegatedAssertionFunction,
} from '../_internal/build-predicate-function.js';
import { buildAssertionFunction, toBe } from '../_internal/build-predicate-function.js';

const tuple = buildAssertionFunction((value: unknown): value is object => {
  if (value === null) {
    return false;
  }

  const type = typeof value;

  return type === 'object' || type === 'function';
}, toBe('any object'));

/**
 * Returns whether the provided value is a JavaScript Object (i.e. anything but a primitive).
 *
 * You will typically want to use more specific functions such as {@link isPlainObject} instead
 */
export const isAnyObject: AssertionFunction<object> = tuple[0];
export const isNotAnyObject: NegatedAssertionFunction<object> = tuple[1];
