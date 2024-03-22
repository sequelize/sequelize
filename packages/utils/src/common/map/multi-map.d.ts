import type { Entry, MapLike } from '../types.js';
export declare class MultiMap<K, V> implements MapLike<K, readonly V[]> {
    #private;
    constructor(entries?: Iterable<readonly [K, readonly V[]]>);
    get size(): number;
    clear(): void;
    append(key: K, value: V): this;
    deleteValue(key: K, value: V): boolean;
    delete(key: K): boolean;
    keys(): IterableIterator<K>;
    count(key: K): number;
    [Symbol.iterator](): IterableIterator<Entry<K, readonly V[]>>;
    entries(): IterableIterator<Entry<K, readonly V[]>>;
    get(key: K): readonly V[];
    has(key: K): boolean;
    set(key: K, values: readonly V[]): this;
    values(): IterableIterator<readonly V[]>;
}
