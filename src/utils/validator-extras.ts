import _ from 'lodash';
import Validator from 'validator';
import moment from 'moment';

type ValidatorFn = (arg0: string) => boolean;
type RegExpValidatorFn = (str: string, pattern: RegExp, modifiers: string) => boolean;

interface ValidatorCustom extends ValidatorJS.ValidatorStatic {
  extend: <T extends Function>(name: string, fn: T) => void;
  contains: (str: string, elem: string) => boolean;
  is: RegExpValidatorFn;
  isDate: ValidatorFn;
  isDecimal: ValidatorFn;
  isIPv4: ValidatorFn;
  isIPv6: ValidatorFn;
  isImmutable: (...args: any[]) => boolean;
  isNull: ValidatorFn;
  isUrl: ValidatorFn;
  len: (str: string, min: number, max: number) => boolean;
  max: (str: string, val: number) => boolean;
  min: (str: string, val: number) => boolean;
  not: RegExpValidatorFn;
  notContains: (str: string, elem: string) => boolean;
  notEmpty: ValidatorFn;
  notIn: (str: string, values: string[]) => boolean;
  notNull: ValidatorFn;
  notRegex: RegExpValidatorFn;
  regex: RegExpValidatorFn;
}

const clonedValidator = _.cloneDeep(Validator);

export const extensions = {
  extend<T extends Function>(name: string, fn: T): void {
    // eslint-disable-next-line
    // @ts-ignore
    this[name] = fn;
  },
  notEmpty(str: string): boolean {
    return !str.match(/^[\s\t\r\n]*$/);
  },
  len(str: string, min: number, max: number): boolean {
    return clonedValidator.isLength(str, min, max);
  },
  isUrl(str: string): boolean {
    return clonedValidator.isURL(str);
  },
  isIPv6(str: string): boolean {
    return clonedValidator.isIP(str, 6);
  },
  isIPv4(str: string): boolean {
    return clonedValidator.isIP(str, 4);
  },
  notIn(str: string, values: string[]): boolean {
    return !clonedValidator.isIn(str, values);
  },
  regex(str: string, pattern: RegExp, modifiers: string): boolean {
    str += '';
    if (Object.prototype.toString.call(pattern).slice(8, -1) !== 'RegExp') {
      pattern = new RegExp(pattern, modifiers);
    }
    const result = str.match(pattern);
    return result ? result.length > 0 : false;
  },
  notRegex(str: string, pattern: RegExp, modifiers: string): boolean {
    return !this.regex(str, pattern, modifiers);
  },
  isDecimal(str: string): boolean {
    return str !== '' && !!str.match(/^(?:-?(?:[0-9]+))?(?:\.[0-9]*)?(?:[eE][+-]?(?:[0-9]+))?$/);
  },
  min(str: string, val: number): boolean {
    const number = parseFloat(str);
    return isNaN(number) || number >= val;
  },
  max(str: string, val: number): boolean {
    const number = parseFloat(str);
    return isNaN(number) || number <= val;
  },
  not(str: string, pattern: RegExp, modifiers: string): boolean {
    return this.notRegex(str, pattern, modifiers);
  },
  contains(str: string, elem: string): boolean {
    return !!elem && str.includes(elem);
  },
  notContains(str: string, elem: string): boolean {
    return !this.contains(str, elem);
  },
  is(str: string, pattern: RegExp, modifiers: string): boolean {
    return this.regex(str, pattern, modifiers);
  }
};

const extraValidator = {
  // instance based validators
  isImmutable(
    value: unknown,
    validatorArgs: unknown[],
    field: string,
    modelInstance: {
      isNewRecord: boolean;
      getDataValue: (args0: string) => unknown;
      previous: (args0: string) => unknown;
    }
  ) {
    return modelInstance.isNewRecord || modelInstance.getDataValue(field) === modelInstance.previous(field);
  },

  // extra validators
  notNull(val: string) {
    return val !== null && val !== undefined;
  },

  // map isNull to isEmpty
  // https://github.com/chriso/validator.js/commit/e33d38a26ee2f9666b319adb67c7fc0d3dea7125
  isNull: clonedValidator.isEmpty,

  // isDate removed in 7.0.0
  // https://github.com/chriso/validator.js/commit/095509fc707a4dc0e99f85131df1176ad6389fc9
  isDate(dateString: string) {
    // avoid http://momentjs.com/guides/#/warnings/js-date/
    // by doing a preliminary check on `dateString`
    const parsed = Date.parse(dateString);
    if (isNaN(parsed)) {
      // fail if we can't parse it
      return false;
    }
    // otherwise convert to ISO 8601 as moment prefers
    // http://momentjs.com/docs/#/parsing/string/
    const date = new Date(parsed);
    return moment(date.toISOString()).isValid();
  }
};

export const validator: ValidatorCustom = { ...clonedValidator, ...extensions, ...extraValidator };
