import { find } from '../iterator-utils/find.js';
import type { ReadonlySetLike } from '../types.js';

export class SetView<V> implements ReadonlySetLike<V> {
  readonly #target: Set<V>;

  /**
   * @returns the number of (unique) elements in Set.
   */
  get size() {
    return this.#target.size;
  }

  constructor(target: Set<V>) {
    this.#target = target;
  }

  /**
   * @param value
   * @returns a boolean indicating whether an element with the specified value exists in the Set or not.
   */
  has(value: V): boolean {
    return this.#target.has(value);
  }

  find(callback: (model: V) => boolean): V | undefined {
    return find(this, callback);
  }

  [Symbol.iterator](): IterableIterator<V> {
    return this.#target[Symbol.iterator]();
  }

  values(): IterableIterator<V> {
    return this.#target.values();
  }

  toMutableSet(): Set<V> {
    return new Set(this.#target);
  }

  firstValue(): V | undefined {
    return this.#target.values().next().value;
  }
}
