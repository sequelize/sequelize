/**
 * Utility type for a class which can be called in addion to being used as a constructor.
 */
interface Invokeable<Args extends Array<any>, Instance> {
  (...args: Args): Instance;
  new (...args: Args): Instance;
}

/**
 * Wraps a constructor to not need the `new` keyword using a proxy.
 * Only used for data types.
 *
 * @param {ProxyConstructor} Class The class instance to wrap as invocable.
 * @returns {Proxy} Wrapped class instance.
 * @private
 */
export function classToInvokable<Args extends Array<any>, Instance extends object>(
  Class: new (...args: Args) => Instance
): Invokeable<Args, Instance> {
  return new Proxy<Invokeable<Args, Instance>>(Class as any, {
    apply(_target, _thisArg, args: Args) {
      return new Class(...args);
    },
    construct(_target, args: Args) {
      return new Class(...args);
    }
  });
}
