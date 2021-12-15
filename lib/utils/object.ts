import _ from 'lodash';
import { getComplexKeys } from './format';
import { camelize } from './string';

const baseIsNative = require('lodash/_baseIsNative');

// Same concept as _.merge, but don't overwrite properties that have already been assigned
export function mergeDefaults(a: object, b: object) {
  return _.mergeWith(a, b, (objectValue, sourceValue) => {
    // If it's an object, let _ handle it this time, we will be called again for each property
    if (!_.isPlainObject(objectValue) && objectValue !== undefined) {
      // _.isNative includes a check for core-js and throws an error if present.
      // Depending on _baseIsNative bypasses the core-js check.
      if (_.isFunction(objectValue) && baseIsNative(objectValue)) {
        return sourceValue || objectValue;
      }
      return objectValue;
    }
  });
}

// An alternative to _.merge, which doesn't clone its arguments
// Cloning is a bad idea because options arguments may contain references to sequelize
// models - which again reference database libs which don't like to be cloned (in particular pg-native)
export function merge(...args: any[]) {
  const result: { [key: string]: any } = {};

  for (const obj of args) {
    _.forOwn(obj, (value, key) => {
      if (value !== undefined) {
        if (!result[key]) {
          result[key] = value;
        } else if (_.isPlainObject(value) && _.isPlainObject(result[key])) {
          result[key] = merge(result[key], value);
        } else if (Array.isArray(value) && Array.isArray(result[key])) {
          result[key] = value.concat(result[key]);
        } else {
          result[key] = value;
        }
      }
    });
  }

  return result;
}

export function cloneDeep(obj: object, onlyPlain?: boolean) {
  return _.cloneDeepWith(obj || {}, elem => {
    // Do not try to customize cloning of arrays or POJOs
    if (Array.isArray(elem) || _.isPlainObject(elem)) {
      return undefined;
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
 * @param {object} value an Object
 * @returns {object} a flattened object
 * @private
 */
export function flattenObjectDeep(value: object) {
  if (!_.isPlainObject(value)) return value;
  const flattenedObj: { [key: string]: any } = {};

  function flattenObject(obj: { [key: string]: any }, subPath?: string) {
    Object.keys(obj).forEach(key => {
      const pathToProperty = subPath ? `${subPath}.${key}` : key;
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        flattenObject(obj[key], pathToProperty);
      } else {
        flattenedObj[pathToProperty] = _.get(obj, key);
      }
    });
    return flattenedObj;
  }

  return flattenObject(value, undefined);
}

/**
 * Assigns own and inherited enumerable string and symbol keyed properties of source
 * objects to the destination object.
 *
 * https://lodash.com/docs/4.17.4#defaults
 *
 * **Note:** This method mutates `object`.
 *
 * @param {object} object The destination object.
 * @param {...object} [sources] The source objects.
 * @returns {object} Returns `object`.
 * @private
 */
export function defaults(
  object: { [key: string | symbol]: any },
  ...sources: { [key: string | symbol]: any }[]
): object {
  object = Object(object);

  sources.forEach(source => {
    if (source) {
      source = Object(source);

      getComplexKeys(source).forEach((key: string | symbol) => {
        const value = object[key];
        const objectPrototype: { [key: string | symbol]: any } =
          Object.prototype;

        if (
          value === undefined ||
          _.eq(value, objectPrototype[key]) &&
            !objectPrototype.hasOwnProperty.call(object, key)
        ) {
          object[key] = source[key];
        }
      });
    }
  });

  return object;
}

/**
 * Returns an new Object which keys are camelized
 *
 * @param {object} obj
 * @returns {string}
 * @private
 */
export function camelizeObjectKeys(obj: { [key: string]: any }) {
  const newObj: { [key: string]: any } = new Object();

  Object.keys(obj).forEach(key => {
    newObj[camelize(key)] = obj[key];
  });

  return newObj;
}
