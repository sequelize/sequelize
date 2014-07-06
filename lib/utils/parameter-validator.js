'use strict';

var _ = require('lodash');
var util = require('util');

var validateDeprecation = function(value, expectation, options) {
  if (!options.deprecated) {
    return;
  }

  var valid = value instanceof options.deprecated;

  if (valid) {
    var message = util.format('%s should not be of type "%s"', util.inspect(value), options.deprecated.name);

    console.log('DEPRECATION WARNING:', options.deprecationWarning || message);
  }

  return valid;
};

var validate = function(value, expectation, options) {
  if (value instanceof expectation) {
    return true;
  }

  throw new Error(util.format('The parameter (value: %s) is no %s.', value, expectation.name));
};

var ParameterValidator = module.exports = {
  check: function(value, expectation, options) {
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
};
