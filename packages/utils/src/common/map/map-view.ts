import type { ReadonlyMapLike } from '../types.js';

export class MapView<K, V> implements ReadonlyMapLike<K, V> {
  readonly #target: Map<K, V>;

  /**
   * @returns the number of elements in the Map.
   */
  get size(): number {
    return this.#target.size;
  }

  constructor(target: Map<K, V>) {
    this.#target = target;
  }

  /**
   * Returns a specified element from the Map object. If the value that is associated to the provided key is an object, then you will get a reference to that object and any change made to that object will effectively modify it inside the Map.
   *
   * @param key
   * @returns Returns the element associated with the specified key. If no element is associated with the specified key, undefined is returned.
   */
  get(key: K): V | undefined {
    return this.#target.get(key);
  }

  getOrThrow(key: K): V {
    if (!this.#target.has(key)) {
      throw new Error(`No value found for key: ${key}`);
    }

    return this.#target.get(key)!;
  }

  /**
   * @param key
   * @returns boolean indicating whether an element with the specified key exists or not.
   */
  has(key: K): boolean {
    return this.#target.has(key);
  }

  [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.#target[Symbol.iterator]();
  }

  entries(): IterableIterator<[K, V]> {
    return this.#target.entries();
  }

  keys(): IterableIterator<K> {
    return this.#target.keys();
  }

  values(): IterableIterator<V> {
    return this.#target.values();
  }

  toMutableMap(): Map<K, V> {
    return new Map(this.#target);
  }
}
