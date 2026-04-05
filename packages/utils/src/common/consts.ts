import { pojo } from './pojo.js';
import type { ReadOnlyRecord } from './types.js';

/**
 * An immutable empty array meant to be used as a default value in places where the value won't be mutated,
 * as a way to reduce the memory footprint of that value by not instantiating common values.
 */
export const EMPTY_ARRAY: readonly never[] = Object.freeze([]);

/**
 * An immutable empty object meant to be used as a default value in places where the value won't be mutated,
 * as a way to reduce the memory footprint of that value by not instantiating common values.
 */
export const EMPTY_OBJECT: ReadOnlyRecord<PropertyKey, never> =
  // eslint-disable-next-line -- false positive
  Object.freeze(pojo() as Record<PropertyKey, never>);
