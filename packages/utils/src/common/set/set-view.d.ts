import type { ReadonlySetLike } from '../types.js';
export declare class SetView<V> implements ReadonlySetLike<V> {
    #private;
    /**
     * @returns the number of (unique) elements in Set.
     */
    get size(): number;
    constructor(target: Set<V>);
    /**
     * @param value
     * @returns a boolean indicating whether an element with the specified value exists in the Set or not.
     */
    has(value: V): boolean;
    find(callback: (model: V) => boolean): V | undefined;
    [Symbol.iterator](): IterableIterator<V>;
    values(): IterableIterator<V>;
    toMutableSet(): Set<V>;
}
