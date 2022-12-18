import NodeUtil from 'node:util';
import type { InspectOptions } from 'node:util';

export class SetView<V> {
  #target: Set<V>;

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

  /**
   * @returns the number of (unique) elements in Set.
   */
  get size() {
    return this.#target.size;
  }

  [Symbol.iterator](): IterableIterator<V> {
    return this.#target[Symbol.iterator]();
  }

  values(): IterableIterator<V> {
    return this.#target.values();
  }

  toJSON() {
    return [...this.#target];
  }

  [NodeUtil.inspect.custom](depth: number, options: InspectOptions): string {
    const newOptions = Object.assign({}, options, {
      depth: options.depth == null ? null : options.depth - 1,
    });

    return NodeUtil.inspect(this.#target, newOptions).replace(/^Set/, 'SetView');
  }
}

export class MapView<K, V> {
  #target: Map<K, V>;

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

  /**
   * @param key
   * @returns boolean indicating whether an element with the specified key exists or not.
   */
  has(key: K): boolean {
    return this.#target.has(key);
  }

  /**
   * @returns the number of elements in the Map.
   */
  get size(): number {
    return this.#target.size;
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

  toJSON() {
    return [...this.#target.entries()];
  }

  [NodeUtil.inspect.custom](depth: number, options: InspectOptions): string {
    const newOptions = Object.assign({}, options, {
      depth: options.depth == null ? null : options.depth - 1,
    });

    return NodeUtil.inspect(this.#target, newOptions).replace(/^Map/, 'MapView');
  }
}
