import dayjs from 'dayjs';
import forEach from 'lodash/forEach';
import origValidator from 'validator';
import type { Attributes, Model } from '../model.js';

type OrigValidator = typeof origValidator;

// extend validator methods
export interface Extensions {
  extend(name: string, fn: (...args: unknown[]) => unknown): unknown;
  // Blocked by: https://github.com/microsoft/TypeScript/issues/7765
  // NEED_SUGGESTION: How to properly create a custom validation?
  [name: string]: unknown;
}

export interface Validator extends OrigValidator {
  notEmpty(str: string): boolean;
  len(str: string, min: number, max: number): boolean;
  isUrl(str: string): boolean;
  isIPv6(str: string): boolean;
  isIPv4(str: string): boolean;
  notIn(str: string, values: string[]): boolean;
  regex(str: string, pattern: string | RegExp, modifiers: string): boolean;
  notRegex(str: string, pattern: string, modifiers: string): boolean;
  min(str: string, val: number): boolean;
  max(str: string, val: number): boolean;
  not(str: string, pattern: string, modifiers: string): boolean;
  notContains(str: string, elem: string): boolean;
  is(str: string, pattern: string, modifiers: string): boolean;
  isImmutable<M extends Model>(
    value: unknown,
    validatorArgs: unknown[],
    field: keyof Attributes<M>,
    modelInstance: Model<any>
  ): boolean;
  isNull: OrigValidator['isEmpty'];
  notNull(val: unknown): boolean;
  // Blocked by: https://github.com/microsoft/TypeScript/issues/7765
  // NEED_SUGGESTION: How to properly implement the custom validations?
  [name: string]: unknown;
}

const validator: Validator = {
  ...origValidator,
  notEmpty(str) {
    return !/^\s*$/.test(str);
  },
  len(str, min, max) {
    return validator.isLength(str, {
      min,
      max,
    });
  },
  isUrl(str) {
    return validator.isURL(str);
  },
  isIPv6(str) {
    return validator.isIP(str, 6);
  },
  isIPv4(str) {
    return validator.isIP(str, 4);
  },
  notIn(str, values) {
    return !validator.isIn(str, values);
  },
  regex(str, pattern, modifiers) {
    str = String(str);
    if (Object.prototype.toString.call(pattern).slice(8, -1) !== 'RegExp') {
      pattern = new RegExp(pattern, modifiers);
    }

    return (pattern as RegExp).test(str);
  },
  notRegex(str, pattern, modifiers) {
    return !this.regex(str, pattern, modifiers);
  },
  isDecimal(str) {
    // eslint-disable-next-line unicorn/no-unsafe-regex
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
  isImmutable(_value, _validatorArgs, field, modelInstance) {
    // NEED_SUGGESTION: Property '_previousDataValues' is private and only accessible within class 'Model<TModelAttributes, TCreationAttributes>'.
    return modelInstance.isNewRecord || modelInstance.dataValues[field] === modelInstance._previousDataValues[field];
  },
  // maps isNull to isEmpty, since validator v6.0.0 renamed it
  // https://github.com/validatorjs/validator.js/commit/e33d38a26ee2f9666b319adb67c7fc0d3dea7125
  isNull: origValidator.isEmpty,
  notNull(val) {
    return val !== null && val !== undefined;
  },
  // isDate removed in validator v7.0.0
  // https://github.com/validatorjs/validator.js/commit/095509fc707a4dc0e99f85131df1176ad6389fc9
  isDate(dateString) {
    return dayjs(dateString).isValid();
  },
};

export const extensions: Extensions = {
  extend(name, fn) {
    this[name] = fn;

    return this;
  },
};

forEach(extensions, (extend, key) => {
  validator[key] = extend;
});

export { validator };
