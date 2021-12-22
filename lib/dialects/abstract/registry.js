
const _registries = Object.create(null);

/**
 * Register dialect implementation.
 *
 * @param {AbstractDialect} [DialectClass] dialect implemetation as subclass of AbstractDialect.
 */
function registerDialect( DialectClass ) {
  const dialectName = DialectClass.getDialectName();
  if (_registries[dialectName] != null && _registries[dialectName] !== DialectClass) {
    throw new Error(`Dialect '${dialectName}' has been registered!`);
  }
  _registries[dialectName] = DialectClass;
}

/**
 * Get dialect implementation by name.
 *
 * @param {string}  [name] the name of dialect.
 * @returns {AbstractDialect} dialect implemetation as subclass of AbstractDialect if implementation exists
 */
function getDialect( name ) {
  return _registries[name];
}

/**
 * Get all available dialect names.
 *
 * @returns {Array<string>} available dialect names.
 */
function getRegisteredDialects() {
  return Object.keys(_registries);
}

module.exports = {
  getDialect,
  getRegisteredDialects,
  registerDialect
};
