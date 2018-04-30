const Logger = require('./logger');

let enabled = false;

const logger = Logger.get();
function deprecate(...args) {
  if (!enabled) {
    return;
  }
  logger.deprecate(...args);
}
exports.deprecate = deprecate;

/**
 * Enables deprecation warnings.
 * Only used to hide deprecation warnings during startup.
 */
function enable() {
  enabled = true;
}
exports.enable = enable;

/**
 * Creates a getter for the specified property that generates a deprecation warning
 * @param {Object} obj
 * @param {String} key
 * @param {*} value
 * @param {String} message
 */
function deprecateProperty(obj, key, value, message) {
  Object.defineProperty(obj, key, {
    get() {
      exports.deprecate(message);
      return value;
    },
  });
}
exports.deprecateProperty = deprecateProperty;

/**
 * Creates a getter for the specified alias on the same object that generates a deprecation warning
 * @param {Object} obj
 * @param {String} orig
 * @param {String} alias
 */
function deprecateAlias(obj, orig, alias) {
  Object.defineProperty(obj, alias, {
    get() {
      exports.deprecate(`Use ${orig} instead`);
      return obj[orig];
    }
  });
}

exports.deprecateAlias = deprecateAlias;
