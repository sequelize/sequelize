import { shallowClonePojo } from './shallow-clone-pojo.js';

/**
 * Returns a prototype-free, shallow-immutable, version of the provided object,
 * without modifying the original object.
 *
 * If the object already matches the criteria, it is returned as-is.
 *
 * @param obj - The object.
 * @returns The immutable version of the object.
 */
export function getImmutablePojo<T extends object>(obj: T): T {
  if (Object.isFrozen(obj) && Object.getPrototypeOf(obj) === null) {
    return obj;
  }

  return Object.freeze(shallowClonePojo(obj));
}
