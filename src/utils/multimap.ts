export class Multimap<K, V> {
  #internalMap = new Map<K, V[]>();

  append(key: K, value: V): this {
    const valueSet = this.#internalMap.get(key);
    if (valueSet != null) {
      valueSet.push(value);

      return this;
    }

    this.#internalMap.set(key, [value]);

    return this;
  }

  delete(key: K, value: V): boolean {
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
}
