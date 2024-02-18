import NodeUtil, { type InspectOptions } from "node:util";
import type { ReadonlySetLike } from "../types.js";
import { pojo } from "../pojo.js";
import { find } from "../iterator-utils/find.js";

export class SetView<V> implements ReadonlySetLike<V> {
  #target: Set<V>;

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

  toJSON() {
    return [...this.#target];
  }

  [NodeUtil.inspect.custom](depth: number, options: InspectOptions): string {
    const newOptions = Object.assign(pojo(), options, {
      depth: options.depth == null ? null : options.depth - 1,
    });

    return NodeUtil.inspect(this.#target, newOptions).replace(
      /^Set/,
      "SetView",
    );
  }
}
