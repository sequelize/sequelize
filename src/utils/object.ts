import cloneDeepWith from 'lodash/cloneDeepWith';
import forOwn from 'lodash/forOwn';
import getValue from 'lodash/get';
import isEqual from 'lodash/isEqual';
import isFunction from 'lodash/isFunction';
import isPlainObject from 'lodash/isPlainObject';
import isUndefined from 'lodash/isUndefined.js';
import mergeWith from 'lodash/mergeWith';
import omitBy from 'lodash/omitBy.js';
import { getComplexKeys } from './format';
import type { MapView } from './immutability.js';
import { combinedIterator, map } from './iterators.js';
// eslint-disable-next-line import/order -- caused by temporarily mixing require with import
import { camelize } from './string';

const baseIsNative = require('lodash/_baseIsNative');

/**
 * Deeply merges object `b` into `a`.
 * Mutates `a`.
 *
 * Same concept as _.merge, but doesn't overwrite properties that have already been assigned.
 *
 * @param a
 * @param b
 */
export function mergeDefaults<T>(a: T, b: Partial<T>): T {
  return mergeWith(a, b, (objectValue, sourceValue) => {
    // If it's an object, let _ handle it this time, we will be called again for each property
    if (!isPlainObject(objectValue) && objectValue !== undefined) {
      // _.isNative includes a check for core-js and throws an error if present.
      // Depending on _baseIsNative bypasses the core-js check.
      if (isFunction(objectValue) && baseIsNative(objectValue)) {
        return sourceValue || objectValue;
      }

      return objectValue;
    }

    // eslint-disable-next-line no-useless-return -- lodash actually wants us to return `undefined` to fallback to the default customizer.
    return;
  });
}

/**
 * An alternative to _.merge, which doesn't clone its arguments.
 *
 * Does not mutate parameters.
 *
 * Cloning is a bad idea because options arguments may contain references to sequelize
 * models - which again reference database libs which don't like to be cloned (in particular pg-native)
 *
 * @param args
 */
export function merge(...args: object[]): object {
  const result: { [key: string]: any } = Object.create(null);

  for (const obj of args) {
    forOwn(obj, (value, key) => {
      if (value === undefined) {
        return;
      }

      if (!result[key]) {
        result[key] = value;
      } else if (isPlainObject(value) && isPlainObject(result[key])) {
        result[key] = merge(result[key], value);
      } else if (Array.isArray(value) && Array.isArray(result[key])) {
        result[key] = [...value, ...result[key]];
      } else {
        result[key] = value;
      }
    });
  }

  return result;
}

export function cloneDeep<T extends object>(obj: T, onlyPlain?: boolean): T {
  return cloneDeepWith(obj || {}, elem => {
    // Do not try to customize cloning of arrays or POJOs
    if (Array.isArray(elem) || isPlainObject(elem)) {
      return;
    }

    // If we specified to clone only plain objects & arrays, we ignore everyhing else
    // In any case, don't clone stuff that's an object, but not a plain one - fx example sequelize models and instances
    if (onlyPlain || typeof elem === 'object') {
      return elem;
    }

    // Preserve special data-types like `fn` across clones. _.get() is used for checking up the prototype chain
    if (elem && typeof elem.clone === 'function') {
      return elem.clone();
    }
  });
}
/* eslint-enable consistent-return */

/**
 * Receives a tree-like object and returns a plain object which depth is 1.
 *
 * - Input:
 *
 *  {
 *    name: 'John',
 *    address: {
 *      street: 'Fake St. 123',
 *      coordinates: {
 *        longitude: 55.6779627,
 *        latitude: 12.5964313
 *      }
 *    }
 *  }
 *
 * - Output:
 *
 *  {
 *    name: 'John',
 *    address.street: 'Fake St. 123',
 *    address.coordinates.latitude: 55.6779627,
 *    address.coordinates.longitude: 12.5964313
 *  }
 *
 * @param value an Object
 * @returns a flattened object
 * @private
 */
export function flattenObjectDeep<T extends {}>(value: T): T extends object ? Flatten<T> : T {
  if (!isPlainObject(value)) {
    // TypeScript doesn't know T is an object due to isPlainObject's typings. Cast to any.
    return value as any;
  }

  const flattenedObj: { [key: string]: any } = Object.create(null);

  function flattenObject(obj: { [key: string]: any }, subPath?: string) {
    for (const key of Object.keys(obj)) {
      const pathToProperty = subPath ? `${subPath}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        flattenObject(obj[key], pathToProperty);
      } else {
        flattenedObj[pathToProperty] = getValue(obj, key);
      }
    }

    return flattenedObj;
  }

  return flattenObject(value) as any;
}

// taken from
// https://stackoverflow.com/questions/66614528/flatten-object-with-custom-keys-in-typescript
// because this is typescript black magic
type Flatten<T extends object> = object extends T ? object : {
  [K in keyof T]-?: (x: NonNullable<T[K]> extends infer V ? V extends object ?
    V extends readonly any[] ? Pick<T, K> : Flatten<V> extends infer FV ? ({
      [P in keyof FV as `${Extract<K, string | number>}.${Extract<P, string | number>}`]:
      FV[P] }) : never : Pick<T, K> : never
  ) => void } extends Record<keyof T, (y: infer O) => void> ?
  O extends unknown ? { [K in keyof O]: O[K] } : never : never;

/**
 * Assigns own and inherited enumerable string and symbol keyed properties of source
 * objects to the destination object.
 *
 * https://lodash.com/docs/4.17.4#defaults
 *
 * **Note:** This method mutates `object`.
 *
 * @param objectIn The destination object.
 * @param sources The source objects.
 * @returns Returns `object`.
 * @private
 */
export function defaults(
  objectIn: { [key: PropertyKey]: any },
  ...sources: Array<{ [key: PropertyKey]: any }>
): object {
  for (const source of sources) {
    if (!source) {
      continue;
    }

    for (const key of getComplexKeys(source)) {
      const value = objectIn[key];
      const objectPrototype: { [key: PropertyKey]: any } = Object.prototype;

      if (
        value === undefined
        || isEqual(value, objectPrototype[key])
        && !Object.prototype.hasOwnProperty.call(objectIn, key)
      ) {
        objectIn[key] = source[key];
      }
    }
  }

  return objectIn;
}

/**
 * @param obj
 * @returns A new object with camel-cased keys
 * @private
 */
export function camelizeObjectKeys(obj: { [key: string]: any }) {
  const newObj: { [key: string]: any } = Object.create(null);

  for (const key of Object.keys(obj)) {
    newObj[camelize(key)] = obj[key];
  }

  return newObj;
}

type NoUndefinedField<T> = { [P in keyof T]: Exclude<T[P], null | undefined> };

export function removeUndefined<T extends {}>(val: T): NoUndefinedField<T> {
  return omitBy(val, isUndefined) as NoUndefinedField<T>;
}

export function getObjectFromMap<K extends PropertyKey, V>(aMap: Map<K, V> | MapView<K, V>): Record<K, V> {
  const record = Object.create(null);

  for (const key of aMap.keys()) {
    record[key] = aMap.get(key);
  }

  return record;
}

/**
 * Returns all own keys of an object, including non-enumerable ones and symbols.
 *
 * @param object
 */
export function getAllOwnKeys(object: object): IterableIterator<string | symbol> {
  return combinedIterator<string | symbol>(
    Object.getOwnPropertySymbols(object),
    Object.getOwnPropertyNames(object),
  );
}

/**
 * Returns all own entries of an object, including non-enumerable ones and symbols.
 *
 * @param obj
 */
export function getAllOwnEntries<T>(obj: { [s: PropertyKey]: T }): IterableIterator<[key: string | symbol, value: T]>;
export function getAllOwnEntries(obj: object): IterableIterator<[key: string | symbol, value: unknown]>;
export function getAllOwnEntries(obj: object): IterableIterator<[key: string | symbol, value: unknown]> {
  // @ts-expect-error -- obj[key] is implicitly any
  return map(getAllOwnKeys(obj), key => [key, obj[key]]);
}

export function noPrototype<T extends object>(obj: T): T {
  Object.setPrototypeOf(obj, null);

  return obj;
}
