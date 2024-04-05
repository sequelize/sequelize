import { pojo } from './pojo.js';

/**
 * Splits an object into two objects, one containing the keys provided and the other containing the rest.
 *
 * @param object The object to split
 * @param keys The keys to pick from the object
 * @returns A tuple where the first element is an object containing the picked keys and the second element is an object containing the rest
 */
export function splitObject<Obj extends object, Keys extends ReadonlyArray<keyof Obj>>(
  object: Obj,
  keys: Keys,
): [Pick<Obj, Keys[number]>, Omit<Obj, Keys[number]>] {
  const picked: any = pojo();
  const omitted: any = pojo();

  for (const key of Object.keys(object) as Array<keyof Obj>) {
    if (keys.includes(key)) {
      picked[key] = object[key];
    } else {
      omitted[key] = object[key];
    }
  }

  return [picked, omitted];
}
