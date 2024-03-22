import type {
  AssertionFunction,
  NegatedAssertionFunction,
} from '../common/_internal/build-predicate-function.js';
import { buildAssertionFunction, toBe } from '../common/_internal/build-predicate-function.js';

const tuple = buildAssertionFunction((value: unknown): value is NodeJS.ErrnoException => {
  return value instanceof Error && 'code' in value;
}, toBe('a NodeJS.ErrnoException'));

/**
 * Returns true if the value is a node error.
 *
 * @param value The value to compare.
 */
export const isNodeError: AssertionFunction<NodeJS.ErrnoException> = tuple[0];
export const isNotNodeError: NegatedAssertionFunction<NodeJS.ErrnoException> = tuple[1];
