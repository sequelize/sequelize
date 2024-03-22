import type { ReadonlyMapLike } from '../types.js';
export declare class MapView<K, V> implements ReadonlyMapLike<K, V> {
    #private;
    /**
     * @returns the number of elements in the Map.
     */
    get size(): number;
    constructor(target: Map<K, V>);
    /**
     * Returns a specified element from the Map object. If the value that is associated to the provided key is an object, then you will get a reference to that object and any change made to that object will effectively modify it inside the Map.
     *
     * @param key
     * @returns Returns the element associated with the specified key. If no element is associated with the specified key, undefined is returned.
     */
    get(key: K): V | undefined;
    getOrThrow(key: K): V;
    /**
     * @param key
     * @returns boolean indicating whether an element with the specified key exists or not.
     */
    has(key: K): boolean;
    [Symbol.iterator](): IterableIterator<[K, V]>;
    entries(): IterableIterator<[K, V]>;
    keys(): IterableIterator<K>;
    values(): IterableIterator<V>;
    toMutableMap(): Map<K, V>;
}
