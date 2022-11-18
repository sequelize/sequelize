import dayjs from 'dayjs';
import origValidator from 'validator';
import type { Attributes, Model } from '../model.js';

export const validator = {
  ...origValidator,
  extend(name: string, fn: (...args: unknown[]) => unknown): unknown {
    Object.assign(this, { [name]: fn });

    return this;
  },
  notEmpty(str: string): boolean {
    return !/^\s*$/.test(str);
  },
  len(str: string, min: number, max: number): boolean {
    return validator.isLength(str, {
      min,
      max,
    });
  },
  isUrl(str: string): boolean {
    return validator.isURL(str);
  },
  isIPv6(str: string): boolean {
    return validator.isIP(str, 6);
  },
  isIPv4(str: string): boolean {
    return validator.isIP(str, 4);
  },
  notIn(str: string, values: string[]): boolean {
    return !validator.isIn(str, values);
  },
  regex(str: string, pattern: string | RegExp, modifiers: string): boolean {
    str = String(str);
    if (Object.prototype.toString.call(pattern).slice(8, -1) !== 'RegExp') {
      pattern = new RegExp(pattern, modifiers);
    }

    return (pattern as RegExp).test(str);
  },
  notRegex(str: string, pattern: string | RegExp, modifiers: string): boolean {
    return !this.regex(str, pattern, modifiers);
  },
  isDecimal(str: string): boolean {
    // eslint-disable-next-line unicorn/no-unsafe-regex
    return str !== '' && Boolean(/^(?:-?\d+)?(?:\.\d*)?(?:[Ee][+-]?\d+)?$/.test(str));
  },
  min(str: string, val: number): boolean {
    const number = Number.parseFloat(str);

    return Number.isNaN(number) || number >= val;
  },
  max(str: string, val: number): boolean {
    const number = Number.parseFloat(str);

    return Number.isNaN(number) || number <= val;
  },
  not(str: string, pattern: string, modifiers: string): boolean {
    return this.notRegex(str, pattern, modifiers);
  },
  contains(str: string, elem: string): boolean {
    return Boolean(elem) && str.includes(elem);
  },
  notContains(str: string, elem: string): boolean {
    return !this.contains(str, elem);
  },
  is(str: string, pattern: string | RegExp, modifiers: string): boolean {
    return this.regex(str, pattern, modifiers);
  },
  isImmutable<M extends Model>(
    _value: unknown,
    _validatorArgs: unknown[],
    field: keyof Attributes<M>,
    modelInstance: Model<any>,
  ): boolean {
    return modelInstance.isNewRecord || modelInstance.dataValues[field] === modelInstance.previous(field);
  },
  // maps isNull to isEmpty, since validator v6.0.0 renamed it
  // https://github.com/validatorjs/validator.js/commit/e33d38a26ee2f9666b319adb67c7fc0d3dea7125
  isNull: origValidator.isEmpty,
  notNull(val: unknown): boolean {
    return val !== null && val !== undefined;
  },
  // isDate removed in validator v7.0.0
  // https://github.com/validatorjs/validator.js/commit/095509fc707a4dc0e99f85131df1176ad6389fc9
  isDate(dateString: string | number | Date | dayjs.Dayjs | null | undefined): boolean {
    return dayjs(dateString).isValid();
  },
};

export const Validator = typeof validator;
