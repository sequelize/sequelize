import { pojo } from './pojo.js';
import { isAnyObject } from './predicates/is-any-object.js';

/**
 * This function is used to create a deep clone of plain values.
 * It can handle arrays, plain objects, and primitives.
 * For non-plain objects, it either transfers them as is or throws an error, based on the `transferUnclonables` flag.
 *
 * @param value The value to be cloned.
 * @param transferUnclonables A flag indicating whether to transfer unclonable values as is.
 *                            If false, the function will throw an error when encountering an unclonable value.
 * @returns The cloned value.
 * @throws Throws an error if the function encounters a non-plain object and `transferUnclonables` is false.
 */
export function cloneDeepPlainValues<T>(value: T, transferUnclonables?: boolean): T {
  if (Array.isArray(value)) {
    return value.map(val => cloneDeepPlainValues(val, transferUnclonables)) as T;
  }

  if (isAnyObject(value)) {
    const prototype = Object.getPrototypeOf(value);

    if (prototype !== null && prototype !== Object.prototype) {
      if (transferUnclonables) {
        return value;
      }

      throw new Error('This function can only clone plain objects, arrays and primitives');
    }

    const out = pojo() as T;
    for (const key of Object.keys(value) as Array<keyof T>) {
      out[key] = cloneDeepPlainValues(value[key], transferUnclonables);
    }

    return out;
  }

  return value;
}
