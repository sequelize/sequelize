/**
 * This function is used to create a deep clone of plain values.
 * It can handle arrays, plain objects, and primitives.
 * For non-plain objects, it either transfers them as is or throws an error, based on the `transferUnclonables` flag.
 *
 * @param value The value to be cloned.
 * @param transferUnclonables A flag indicating whether to transfer unclonable values as is.
 *                            If false, the function will throw an error when encountering an unclonable value.
 * @returns The cloned value.
 * @throws Throws an error if the function encounters a non-plain object and `transferUnclonables` is false.
 */
export declare function cloneDeepPlainValues<T>(value: T, transferUnclonables?: boolean): T;
