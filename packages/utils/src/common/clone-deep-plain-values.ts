import { pojo } from './pojo.js';
import { isAnyObject } from './predicates/is-any-object.js';

export function cloneDeepPlainValues<T>(value: T, transferUnclonables?: boolean): T {
  if (Array.isArray(value)) {
    return value.map(val => cloneDeepPlainValues(val, transferUnclonables)) as T;
  }

  if (isAnyObject(value)) {
    if (value instanceof Date) {
      return new Date(value) as T;
    }

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
