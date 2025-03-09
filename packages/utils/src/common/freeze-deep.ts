import { isPlainObject } from './predicates/is-plain-object.js';

export function freezeDeep<T extends object>(obj: T): T {
  Object.freeze(obj);

  freezeDescendants(obj);

  return obj;
}

/**
 * Only freezes the descendants of an object, not the object itself.
 *
 * @param obj
 */
export function freezeDescendants<T extends object>(obj: T): T {
  for (const descendant of Object.values(obj)) {
    if (isPlainObject(descendant) || Array.isArray(descendant)) {
      freezeDeep(descendant);
    }
  }

  return obj;
}
