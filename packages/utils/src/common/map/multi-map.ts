import uniq from 'lodash/uniq.js';
import { EMPTY_ARRAY } from '../consts.js';
import type { Entry, MapLike } from '../types.js';

export class MultiMap<K, V> implements MapLike<K, readonly V[]> {
  readonly #internalMap = new Map<K, readonly V[]>();

  constructor(entries?: Iterable<readonly [K, readonly V[]]>) {
    if (entries) {
      for (const [key, values] of entries) {
        this.set(key, values);
      }
    }
  }

  get size() {
    return this.#internalMap.size;
  }

  clear() {
    this.#internalMap.clear();
  }

  append(key: K, value: V): this {
    const valueSet = this.#internalMap.get(key);
    if (valueSet?.includes(value)) {
      return this;
    }

    const newValue = valueSet ? [...valueSet, value] : [value];
    Object.freeze(newValue);

    this.#internalMap.set(key, newValue);

    return this;
  }

  deleteValue(key: K, value: V): boolean {
    const valueSet = this.#internalMap.get(key);
    if (valueSet == null) {
      return false;
    }

    const newValueSet = valueSet.filter(val => val !== value);
    if (newValueSet.length === valueSet.length) {
      return false;
    }

    if (newValueSet.length === 0) {
      this.#internalMap.delete(key);

      return true;
    }

    Object.freeze(newValueSet);
    this.#internalMap.set(key, newValueSet);

    return true;
  }

  delete(key: K): boolean {
    return this.#internalMap.delete(key);
  }

  keys(): IterableIterator<K> {
    return this.#internalMap.keys();
  }

  count(key: K): number {
    const values = this.#internalMap.get(key);

    return values?.length ?? 0;
  }

  [Symbol.iterator](): IterableIterator<Entry<K, readonly V[]>> {
    return this.#internalMap[Symbol.iterator]();
  }

  entries(): IterableIterator<Entry<K, readonly V[]>> {
    return this.#internalMap.entries();
  }

  get(key: K): readonly V[] {
    return this.#internalMap.get(key) ?? EMPTY_ARRAY;
  }

  has(key: K): boolean {
    return this.#internalMap.has(key);
  }

  set(key: K, values: readonly V[]): this {
    if (values.length === 0) {
      this.#internalMap.delete(key);

      return this;
    }

    const uniqueValues = Object.freeze(uniq(values));

    this.#internalMap.set(key, uniqueValues);

    return this;
  }

  values(): IterableIterator<readonly V[]> {
    return this.#internalMap.values();
  }
}
