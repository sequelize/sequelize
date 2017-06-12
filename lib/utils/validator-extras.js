'use strict';

const _ = require('lodash');
const validator = _.cloneDeep(require('validator'));

const extensions = {
  extend(name, fn) {
    this[name] = fn;

    return this;
  },
  notEmpty(str) {
    return !str.match(/^[\s\t\r\n]*$/);
  },
  len(str, min, max) {
    return this.isLength(str, min, max);
  },
  isUrl(str) {
    return this.isURL(str);
  },
  isIPv6(str) {
    return this.isIP(str, 6);
  },
  isIPv4(str) {
    return this.isIP(str, 4);
  },
  notIn(str, values) {
    return !this.isIn(str, values);
  },
  regex(str, pattern, modifiers) {
    str += '';
    if (Object.prototype.toString.call(pattern).slice(8, -1) !== 'RegExp') {
      pattern = new RegExp(pattern, modifiers);
    }
    return str.match(pattern);
  },
  notRegex(str, pattern, modifiers) {
    return !this.regex(str, pattern, modifiers);
  },
  isDecimal(str) {
    return str !== '' && !!str.match(/^(?:-?(?:[0-9]+))?(?:\.[0-9]*)?(?:[eE][\+\-]?(?:[0-9]+))?$/);
  },
  min(str, val) {
    const number = parseFloat(str);
    return isNaN(number) || number >= val;
  },
  max(str, val) {
    const number = parseFloat(str);
    return isNaN(number) || number <= val;
  },
  not(str, pattern, modifiers) {
    return this.notRegex(str, pattern, modifiers);
  },
  contains(str, elem) {
    return str.indexOf(elem) >= 0 && !!elem;
  },
  notContains(str, elem) {
    return !this.contains(str, elem);
  },
  is(str, pattern, modifiers) {
    return this.regex(str, pattern, modifiers);
  }
};
exports.extensions = extensions;

function extendModelValidations(modelInstance) {
  const extensions = {
    isImmutable(str, param, field) {
      return modelInstance.isNewRecord || modelInstance.dataValues[field] === modelInstance._previousDataValues[field];
    }
  };

  _.forEach(extensions, (extend, key) => {
    validator[key] = extend;
  });
}
exports.extendModelValidations = extendModelValidations;

// Deprecate this.
validator.notNull = function() {
  throw new Error('Warning "notNull" validation has been deprecated in favor of Schema based "allowNull"');
};

// https://github.com/chriso/validator.js/blob/6.2.0/validator.js
_.forEach(extensions, (extend, key) => {
  validator[key] = extend;
});

// map isNull to isEmpty
// https://github.com/chriso/validator.js/commit/e33d38a26ee2f9666b319adb67c7fc0d3dea7125
validator.isNull = validator.isEmpty;

exports.validator = validator;
