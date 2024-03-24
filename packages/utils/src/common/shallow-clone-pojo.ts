import { pojo } from './pojo.js';
import { isPlainObject } from './predicates/is-plain-object.js';

export function shallowClonePojo<T extends object>(obj: T): T {
  isPlainObject.assert(obj);

  return Object.assign(pojo(), obj);
}
