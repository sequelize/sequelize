'use strict';

import cloneDeep from 'lodash/cloneDeep';
import forEach from 'lodash/forEach';

const validator = cloneDeep(require('validator'));
const dayjs = require('dayjs');

export const extensions = {
  extend(name, fn) {
    this[name] = fn;

    return this;
  },
  notEmpty(str) {
    return !/^\s*$/.test(str);
  },
  // TODO: accept { min, max } object
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
    str = String(str);
    if (Object.prototype.toString.call(pattern).slice(8, -1) !== 'RegExp') {
      pattern = new RegExp(pattern, modifiers);
    }

    return str.match(pattern);
  },
  notRegex(str, pattern, modifiers) {
    return !this.regex(str, pattern, modifiers);
  },
  isDecimal(str) {
    return str !== '' && Boolean(/^(?:-?\d+)?(?:\.\d*)?(?:[Ee][+-]?\d+)?$/.test(str));
  },
  min(str, val) {
    const number = Number.parseFloat(str);

    return Number.isNaN(number) || number >= val;
  },
  max(str, val) {
    const number = Number.parseFloat(str);

    return Number.isNaN(number) || number <= val;
  },
  not(str, pattern, modifiers) {
    return this.notRegex(str, pattern, modifiers);
  },
  contains(str, elem) {
    return Boolean(elem) && str.includes(elem);
  },
  notContains(str, elem) {
    return !this.contains(str, elem);
  },
  is(str, pattern, modifiers) {
    return this.regex(str, pattern, modifiers);
  },
};

// instance based validators
validator.isImmutable = function (value, validatorArgs, field, modelInstance) {
  return (
    modelInstance.isNewRecord ||
    modelInstance.dataValues[field] === modelInstance._previousDataValues[field]
  );
};

// extra validators
validator.notNull = function (val) {
  return val !== null && val !== undefined;
};

// https://github.com/chriso/validator.js/blob/6.2.0/validator.js
forEach(extensions, (extend, key) => {
  validator[key] = extend;
});

// map isNull to isEmpty
// https://github.com/chriso/validator.js/commit/e33d38a26ee2f9666b319adb67c7fc0d3dea7125
validator.isNull = validator.isEmpty;

// isDate removed in 7.0.0
// https://github.com/chriso/validator.js/commit/095509fc707a4dc0e99f85131df1176ad6389fc9
// TODO: isDate has been added back https://github.com/validatorjs/validator.js/pull/1270
validator.isDate = function (dateString) {
  return dayjs(dateString).isValid();
};

export { validator };
