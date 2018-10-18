'use strict';

const util = require('util');

/**
 * like util.inherits, but also copies over static properties. Inherit child constructor
 * to have properties from super constructor
 *
 * @param {Function} constructor the child constructor
 * @param {Function} superConstructor the super constructor
 *
 * @private
 */
function inherits(constructor, superConstructor) {
  util.inherits(constructor, superConstructor); // Instance (prototype) methods
  Object.assign(constructor, superConstructor); // Static methods
}

module.exports = inherits;
module.exports.inherits = inherits;
module.exports.default = inherits;
