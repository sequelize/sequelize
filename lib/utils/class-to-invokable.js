/**
 * Wrap a class so it can be used with or without `new`.
 *
 * Data types are public API and are used three ways -- bare (`DataTypes.STRING`),
 * called (`DataTypes.STRING(255)`) and constructed (`new DataTypes.STRING(255)`).
 * A plain class throws when called without `new`, so each is wrapped to keep all
 * three forms working.
 *
 * Mirrors `Utils.classToInvokable` in Sequelize v6.
 *
 * @param {Function} Class - the class to wrap
 * @returns {Proxy} a proxy that constructs on both call and `new`
 * @private
 */
export function classToInvokable(Class) {
  return new Proxy(Class, {
    apply(_target, _thisArg, args) {
      return new Class(...args);
    },
    construct(_target, args) {
      return new Class(...args);
    }
  });
}

export default classToInvokable;
