'use strict';

const util = require('util');
const _ = require('lodash');

/**
 * like util.inherits, but also copies over static properties
 * @private
 */
function inherits(constructor, superConstructor) {
  util.inherits(constructor, superConstructor); // Instance (prototype) methods
  _.extend(constructor, superConstructor); // Static methods
}

module.exports = inherits;
module.exports.inherits = inherits;
module.exports.default = inherits;
