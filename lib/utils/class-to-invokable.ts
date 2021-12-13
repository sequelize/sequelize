type Proxify = typeof Proxy;

/**
 * Wraps a constructor to not need the `new` keyword using a proxy.
 * Only used for data types.
 *
 * @param {ProxyConstructor} Class The class instance to wrap as invocable.
 * @returns {Proxy} Wrapped class instance.
 * @private
 */
export function classToInvokable(Class: any): Proxify {
  return new Proxy(Class, {
    apply(Target, thisArg, args) {
      return new Target(...args);
    },
    construct(Target, args) {
      return new Target(...args);
    },
    get(target, p) {
      return target[p];
    }
  });
}
