'use strict';

const util = require('util');
const Utils = require('../utils');

function validateDeprecation(value, expectation, options) {
  if (!options.deprecated) {
    return;
  }

  const valid =
    value instanceof options.deprecated ||
    Object.prototype.toString.call(value) === Object.prototype.toString.call(options.deprecated.call());

  if (valid) {
    const message = `${util.inspect(value)} should not be of type "${options.deprecated.name}"`;
    Utils.deprecate(options.deprecationWarning || message);
  }

  return valid;
}

function validate(value, expectation) {
  // the second part of this check matches a primitive against its wrapper constructor (e.g. 1 vs Number,
  // 'x' vs String), since primitives are not `instanceof` their constructor. It compares type tags:
  // `expectation.call()` produces a representative instance (String() -> '', Number() -> 0) and its
  // Object.prototype.toString tag is compared against the value's.
  if (
    value instanceof expectation ||
    Object.prototype.toString.call(value) === Object.prototype.toString.call(expectation.call())
  ) {
    return true;
  }

  throw new Error(`The parameter (value: ${value}) is no ${expectation.name}`);
}

function check(value, expectation, options) {
  options = Object.assign(
    {
      deprecated: false,
      index: null,
      method: null,
      optional: false
    },
    options || {}
  );

  if (!value && options.optional) {
    return true;
  }

  if (value === undefined) {
    throw new Error('No value has been passed.');
  }

  if (expectation === undefined) {
    throw new Error('No expectation has been passed.');
  }

  return false || validateDeprecation(value, expectation, options) || validate(value, expectation, options);
}

module.exports = check;
module.exports.check = check;
module.exports.default = check;
