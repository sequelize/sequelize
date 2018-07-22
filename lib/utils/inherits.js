'use strict';

const util = require('util');
const _ = require('lodash');

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
  _.extend(constructor, superConstructor); // Static methods
}

module.exports = inherits;
module.exports.inherits = inherits;
module.exports.default = inherits;
