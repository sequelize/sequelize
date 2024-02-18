import { pojo } from "./pojo.js";

export function shallowClonePojo<T extends object>(obj: T): T {
  return Object.assign(pojo(), obj);
}
