/**
 * Creates a new object with a null prototype.
 * If an object is provided, it sets the prototype of the provided object to null.
 * This mutates the provided object.
 *
 * @example
 * ```ts
 * const obj = pojo({ a: 1 });
 * console.log(Object.getPrototypeOf(obj)); // null
 *
 * const obj2 = pojo();
 * console.log(Object.getPrototypeOf(obj2)); // null
 * ```
 *
 * @param obj The object whose prototype is to be set to null.
 * @returns The new object with a null prototype, or the provided object with its prototype set to null.
 */
export declare function pojo<T extends object>(obj?: T): T;
