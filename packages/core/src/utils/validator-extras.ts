import dayjs from 'dayjs';
import baseValidator from 'validator';
import type { Model } from '../model';

export const Validator = {
  ...baseValidator,

  extend(name: string, fn: Function) {
    // @ts-expect-error -- this will be deprecated by the new generic validator API, so we can ignore the type error for now
    this[name] = fn;

    return this;
  },
  notEmpty(str: string) {
    return !/^\s*$/.test(str);
  },
  // TODO: accept { min, max } object
  len(str: string, min: number, max: number) {
    return this.isLength(str, min, max);
  },
  isUrl(str: string) {
    return this.isURL(str);
  },
  isIPv6(str: string) {
    return this.isIP(str, 6);
  },
  isIPv4(str: string) {
    return this.isIP(str, 4);
  },
  notIn(str: string, values: string[]) {
    return !this.isIn(str, values);
  },
  regex(str: string, pattern: string | RegExp, modifiers: string) {
    str = String(str);
    if (Object.prototype.toString.call(pattern).slice(8, -1) !== 'RegExp') {
      pattern = new RegExp(pattern, modifiers);
    }

    return str.match(pattern);
  },
  notRegex(str: string, pattern: string | RegExp, modifiers: string) {
    return !this.regex(str, pattern, modifiers);
  },
  isDecimal(str: string) {
    return str !== '' && Boolean(/^(?:-?\d+)?(?:\.\d*)?(?:[Ee][+-]?\d+)?$/.test(str));
  },
  min(str: string, val: number) {
    const number = Number.parseFloat(str);

    return Number.isNaN(number) || number >= val;
  },
  max(str: string, val: number) {
    const number = Number.parseFloat(str);

    return Number.isNaN(number) || number <= val;
  },
  not(str: string, pattern: string | RegExp, modifiers: string) {
    return this.notRegex(str, pattern, modifiers);
  },
  contains(str: string, elem: string) {
    return Boolean(elem) && str.includes(elem);
  },
  notContains(str: string, elem: string) {
    return !this.contains(str, elem);
  },
  is(str: string, pattern: string | RegExp, modifiers: string) {
    return this.regex(str, pattern, modifiers);
  },

  // instance based validators
  isImmutable(
    ignoreValue: unknown,
    ignoreValidatorArgs: unknown,
    field: string,
    modelInstance: Model,
  ) {
    return (
      modelInstance.isNewRecord || modelInstance.dataValues[field] === modelInstance.previous(field)
    );
  },

  // extra validators
  // TODO: rename to isNotNullish, add "isNotNull" for null-only
  notNull(val: unknown) {
    return val !== null && val !== undefined;
  },

  // TODO: remove, as empty strings / arrays are not null
  // https://github.com/chriso/validator.js/commit/e33d38a26ee2f9666b319adb67c7fc0d3dea7125
  isNull: baseValidator.isEmpty,

  // isDate removed in 7.0.0
  // https://github.com/chriso/validator.js/commit/095509fc707a4dc0e99f85131df1176ad6389fc9
  // TODO: isDate has been added back https://github.com/validatorjs/validator.js/pull/1270
  isDate(dateString: string) {
    return dayjs(dateString).isValid();
  },

  _default: undefined,
};
