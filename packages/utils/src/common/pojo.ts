export function pojo<T extends object>(obj?: T): T {
  if (!obj) {
     
    return Object.create(null);
  }

  Object.setPrototypeOf(obj, null);

  return obj;
}
