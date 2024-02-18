export function pojo<T extends object>(obj?: T): T {
  if (!obj) {
    // eslint-disable-next-line no-restricted-syntax -- Object.create(null) is banned in favor of this function
    return Object.create(null);
  }

  Object.setPrototypeOf(obj, null);

  return obj;
}
