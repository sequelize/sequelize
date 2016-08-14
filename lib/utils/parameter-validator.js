'use strict';

const _ = require('lodash');
const util = require('util');

function validateDeprecation(value, expectation, options) {
  if (!options.deprecated) {
    return;
  }

  const valid = value instanceof options.deprecated || Object.prototype.toString.call(value) === Object.prototype.toString.call(options.deprecated.call());

  if (valid) {
    const message = `${util.inspect(value)} should not be of type "${options.deprecated.name}"`;

    console.log('DEPRECATION WARNING:', options.deprecationWarning || message);
  }

  return valid;
}

function validate(value, expectation) {
  // the second part of this check is a workaround to deal with an issue that occurs in node-webkit when
  // using object literals.  https://github.com/sequelize/sequelize/issues/2685
  if (value instanceof expectation || Object.prototype.toString.call(value) === Object.prototype.toString.call(expectation.call())) {
    return true;
  }

  throw new Error(`The parameter (value: ${value}) is no ${expectation.name}`);
}

function check(value, expectation, options) {
  options = _.extend({
    deprecated: false,
    index: null,
    method: null,
    optional: false
  }, options || {});

  if (!value && options.optional) {
    return true;
  }

  if (value === undefined) {
    throw new Error('No value has been passed.');
  }

  if (expectation === undefined) {
    throw new Error('No expectation has been passed.');
  }

  return false
    || validateDeprecation(value, expectation, options)
    || validate(value, expectation, options);
}

module.exports = check;
module.exports.check = check;
module.exports.default = check;
