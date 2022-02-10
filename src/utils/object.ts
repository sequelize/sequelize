import cloneDeepWith from 'lodash/cloneDeepWith';
import isEqual from 'lodash/eq';
import forOwn from 'lodash/forOwn';
import getValue from 'lodash/get';
import isFunction from 'lodash/isFunction';
import isPlainObject from 'lodash/isPlainObject';
import mergeWith from 'lodash/mergeWith';
import { getComplexKeys } from './format';
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

    // eslint-disable-next-line consistent-return,no-useless-return -- lodash actually wants us to return `undefined` to fallback to the default customizer.
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

/* eslint-disable consistent-return -- lodash actually wants us to return `undefined` to fallback to the default customizer. */
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
export function flattenObjectDeep<T extends object>(value: T): Flatten<T> {
  if (!isPlainObject(value)) {
    return value as Flatten<T>;
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

  return flattenObject(value) as Flatten<T>;
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
  objectIn: { [key: string]: any }, // TODO [2022-09-01]: key should be string | symbol once we drop support for TS 4.4
  ...sources: Array<{ [key: string]: any }> // TODO [2022-09-01]: key should be string | symbol once we drop support for TS 4.4
): object {
  for (const source of sources) {
    if (!source) {
      continue;
    }

    // TODO [2022-09-01]: note on 'as any[]': TypeScript < 4.4 does not support using Symbol for keys.
    //  Cast can be removed in sept. 2022 when we drop support for < 4.4
    for (const key of getComplexKeys(source) as any[]) {
      const value = objectIn[key];
      const objectPrototype: { [key: string]: any } = Object.prototype; // TODO [2022-09-01]: key should be string | symbol once we drop support for TS 4.4

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
