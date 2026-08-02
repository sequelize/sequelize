'use strict';

/**
 * CommonJS compatibility entry point.
 *
 * `require()` of an ES module yields the module namespace object rather than its
 * default export, so CJS consumers doing `const Sequelize = require('sequelize')`
 * would receive an object instead of the constructor. sequelize-cli 5.x does
 * exactly that (lib/helpers/generic-helper.js), so this shim unwraps the default.
 *
 * Node shares one ES module registry between `require(esm)` and `import`, so this
 * does not create a second copy of the library -- there is no dual-package hazard,
 * and `instanceof` holds across both entry points.
 *
 * @module Sequelize
 */
const Sequelize = require('./lib/sequelize.js').default;

module.exports = Sequelize;
module.exports.Sequelize = Sequelize;
module.exports.default = Sequelize;
