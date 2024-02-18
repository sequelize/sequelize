import type { Entry, MapLike } from "../types.js";

export class MultiMap<K, V> implements MapLike<K, V[]> {
  #internalMap = new Map<K, V[]>();

  get size() {
    return this.#internalMap.size;
  }

  clear() {
    this.#internalMap.clear();
  }

  append(key: K, value: V): this {
    const valueSet = this.#internalMap.get(key);
    if (valueSet != null) {
      valueSet.push(value);

      return this;
    }

    this.#internalMap.set(key, [value]);

    return this;
  }

  deleteValue(key: K, value: V): boolean {
    const valueSet = this.#internalMap.get(key);
    if (valueSet == null) {
      return false;
    }

    const index = valueSet.indexOf(value);
    if (index === -1) {
      return false;
    }

    valueSet.splice(index, 1);

    return true;
  }

  delete(key: K): boolean {
    return this.#internalMap.delete(key);
  }

  keys(): IterableIterator<K> {
    return this.#internalMap.keys();
  }

  getAll(key: K): V[] {
    const values = this.#internalMap.get(key);

    if (values) {
      return [...values];
    }

    return [];
  }

  count(key: K): number {
    const values = this.#internalMap.get(key);

    return values?.length ?? 0;
  }

  [Symbol.iterator](): IterableIterator<Entry<K, V[]>> {
    return this.#internalMap[Symbol.iterator]();
  }

  entries(): IterableIterator<Entry<K, V[]>> {
    return this.#internalMap.entries();
  }

  get(key: K): V[] | undefined {
    return this.#internalMap.get(key);
  }

  has(key: K): boolean {
    return this.#internalMap.has(key);
  }

  set(key: K, values: V[]): this {
    this.#internalMap.set(key, values);

    return this;
  }

  values(): IterableIterator<V[]> {
    return this.#internalMap.values();
  }
}
