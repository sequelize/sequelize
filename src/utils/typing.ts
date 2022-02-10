/**
 * Lists all keys that are not constructors
 */
export type NonConstructorKeys<T> = ({ [P in keyof T]: T[P] extends new () => any ? never : P })[keyof T];

/**
 * Removes all constructors from the T
 */
export type OmitConstructors<T> = Pick<T, NonConstructorKeys<T>>;

/**
 * Type will be true is T is branded with Brand, false otherwise
 */
// How this works:
// - `A extends B` will be true if A has *at least* all the properties of B
// - If we do `A extends Omit<A, Checked>` - the result will only be true if A did not have Checked to begin with
// - So if we want to check if T is branded, we remove the brand, and check if they list of keys is still the same.
// we exclude Null & Undefined so "field: Brand<value> | null" is still detected as branded
// this is important because "Brand<value | null>" are transformed into "Brand<value> | null" to not break null & undefined
export type IsBranded<T, Brand extends symbol> = keyof NonNullable<T> extends keyof Omit<NonNullable<T>, Brand>
  ? false
  : true;
