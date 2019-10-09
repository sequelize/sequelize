'use strict';

/**
 * Wraps a constructor to not need the `new` keyword using a proxy.
 * Only used for data types.
 *
 * @param {Function} Class The class instance to wrap as invocable.
 * @returns {Proxy} Wrapped class instance.
 * @private
 */
function classToInvokable(Class) {
  const proxy = new Proxy(Class, {
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
  proxy.toString = Function.prototype.toString.bind(Class);
  return proxy;
}
exports.classToInvokable = classToInvokable;
