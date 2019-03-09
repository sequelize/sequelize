'use strict';

/**
 * Wraps a constructor to not need the `new` keyword using a proxy.
 * Only used for data types.
 * @param {Function} ctor
 * @return {Proxy}
 */
function classToInvokable(Class) {
  return new Proxy(Class, {
    apply(Target, thisArg, args) {
      return new Target(...args);
    }
  });
}
exports.classToInvokable = classToInvokable;
