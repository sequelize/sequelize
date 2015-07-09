'use strict';

var validator = require('validator')
  , _ = require('lodash');

var extensions = {
  notEmpty: function(str) {
    return !str.match(/^[\s\t\r\n]*$/);
  },
  len: function(str, min, max) {
    return this.isLength(str, min, max);
  },
  isUrl: function(str) {
    return this.isURL(str);
  },
  isIPv6: function(str) {
    return this.isIP(str, 6);
  },
  isIPv4: function(str) {
    return this.isIP(str, 4);
  },
  notIn: function(str, values) {
    return !this.isIn(str, values);
  },
  regex: function(str, pattern, modifiers) {
    str += '';
    if (Object.prototype.toString.call(pattern).slice(8, -1) !== 'RegExp') {
      pattern = new RegExp(pattern, modifiers);
    }
    return str.match(pattern);
  },
  notRegex: function(str, pattern, modifiers) {
    return !this.regex(str, pattern, modifiers);
  },
  isDecimal: function(str) {
    return str !== '' && str.match(/^(?:-?(?:[0-9]+))?(?:\.[0-9]*)?(?:[eE][\+\-]?(?:[0-9]+))?$/);
  },
  min: function(str, val) {
    var number = parseFloat(str);
    return isNaN(number) || number >= val;
  },
  max: function(str, val) {
    var number = parseFloat(str);
    return isNaN(number) || number <= val;
  },
  not: function(str, pattern, modifiers) {
    return this.notRegex(str, pattern, modifiers);
  },
  contains: function(str, elem) {
    return str.indexOf(elem) >= 0 && !!elem;
  },
  notContains: function(str, elem) {
    return !this.contains(str, elem);
  },
  is: function(str, pattern, modifiers) {
    return this.regex(str, pattern, modifiers);
  },
};
var extendModelValidations = function(modelInstance) {
  var extensions = {
        isImmutable: function(str, param, field) {
          return (modelInstance.isNewRecord || modelInstance.dataValues[field] === modelInstance._previousDataValues[field]);
        },
      };

  _.forEach(extensions, function(extend, key) {
    validator.extend(key, extend);
  });
};

// Deprecate this.
validator.notNull = function() {
  throw new Error('Warning "notNull" validation has been deprecated in favor of Schema based "allowNull"');
};

// https://github.com/chriso/validator.js/blob/1.5.0/lib/validators.js
_.forEach(extensions, function(extend, key) {
  validator.extend(key, extend);
});

module.exports = {
  extensions: extensions,
  extendModelValidations: extendModelValidations,
  validator: validator,
};
