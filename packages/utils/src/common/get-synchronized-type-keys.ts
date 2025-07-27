/**
 * This strange piece of code is used to get a runtime array of keys that is guaranteed to be in sync with the keys of the provided interface.
 *
 * @param input
 * @example
 * ```ts
 * export interface Db2DialectOptions {
 *   db2Module?: Db2Module;
 * }
 *
 * const DIALECT_OPTION_NAMES = getSynchronizedKeys<Db2DialectOptions>({
 *   // if a key is missing, TypeScript will throw an error
 *   db2Module: undefined,
 * });
 *
 * // Output is ['db2Module']
 *
 * @param input
 */
export function getSynchronizedTypeKeys<Interface>(
  input: Record<keyof Interface, undefined>,
): ReadonlyArray<keyof Interface> {
  return Object.freeze(Object.keys(input) as Array<keyof Interface>);
}
