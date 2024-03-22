import type { ReadOnlyRecord } from './types.js';
/**
 * An immutable empty array meant to be used as a default value in places where the value won't be mutated,
 * as a way to reduce the memory footprint of that value by not instantiating common values.
 */
export declare const EMPTY_ARRAY: readonly never[];
/**
 * An immutable empty object meant to be used as a default value in places where the value won't be mutated,
 * as a way to reduce the memory footprint of that value by not instantiating common values.
 */
export declare const EMPTY_OBJECT: ReadOnlyRecord<PropertyKey, never>;
