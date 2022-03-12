// @typescript-eslint/no-redeclare is disabled due to declaration merging with `classToInvokeable`
/* eslint-disable @typescript-eslint/no-redeclare */
import util from 'util';
import moment from 'moment';
import momentTz from 'moment-timezone';
import wkx from 'wkx';
import { kSetDialectNames } from '../../dialect-toolbox';
import { ValidationError } from '../../errors';
import type { Falsy } from '../../generic/falsy';
import { classToInvokable } from '../../utils/class-to-invokable';
import { joinSQLFragments } from '../../utils/join-sql-fragments';
import { logger } from '../../utils/logger';
import { validator as Validator } from '../../utils/validator-extras';

const warnings: Record<string, boolean> = {};

// If T is a constructor, returns the type of what `new T()` would return-
// otherwise, returns T
export type Constructed<T> = T extends abstract new () => infer Instance
  ? Instance
  : T;

export type AcceptableTypeOf<T extends DataType> =
  Constructed<T> extends ABSTRACT<infer Acceptable> ? Acceptable : never;
export type SaneTypeOf<T extends DataType> = Constructed<T> extends ABSTRACT<
  any,
  infer Sane
>
  ? Sane
  : never;
export type RawTypeOf<T extends DataType> = Constructed<T> extends ABSTRACT<
  any,
  any,
  infer Raw
>
  ? Raw
  : never;

export type DataType<T extends ABSTRACT<any> = ABSTRACT<any>> =
  | T
  | { key: string, new (): T };

// TODO: This typing may not be accurate, validate when query-generator is typed.
export interface StringifyOptions {
  escape(str: string): string;
  operation?: string;
  timezone?: string;
  // TODO: Update this when query-generator is converted to TS
  field?: any;
}
// TODO: This typing may not be accurate, validate when query-generator is typed.
export interface BindParamOptions extends StringifyOptions {
  bindParam(value: string | Buffer | string[] | null): string;
}

export type DialectTypeMeta =
  | {
      subtypes: { [name: string]: string },
      castTypes: { [name: string]: string },
    }
  | string[]
  | number[]
  | [null]
  | false;

class _ABSTRACT<
  /** The type of value we'll accept - ie for a column of this type, we'll accept this value as user input. */
  AcceptedType,
  /** The "sane" type of this column - ie the type of a value of a field if it was sanitized via sequelize. */
  SaneType extends AcceptedType = AcceptedType,
  /** The type of value retrieved from. */
  RawType = AcceptedType,
> {
  public static readonly key: string = 'ABSTRACT';
  // @internal
  public static readonly types: Record<string, DialectTypeMeta>;
  // @internal
  // @ts-expect-error types is not set in constructor.
  public types: Record<string, DialectTypeMeta>;

  /**
   * Helper used to add a dialect to `types` of a DataType.  It ensures that it doesn't modify the types of its parent.
   *
   * @param dialect The dialect the types apply to
   * @param types The dialect-specific types.
   */
  public static [kSetDialectNames](dialect: string, types: DialectTypeMeta) {
    if (!Object.prototype.hasOwnProperty.call(this, 'types')) {
      const prop = {
        value: {},
        writable: false,
        enumerable: false,
        configurable: false,
      };

      Reflect.defineProperty(this, 'types', prop);
      Reflect.defineProperty(this.prototype, 'types', prop);
    }

    this.types[dialect] = types;
  }

  // A "memorized" getter.  This ensures that we'll inherit the static `key` property of each DataType and set it directly on that DataType's prototype
  // (rather than every object which inherits the prototype of that DataType)
  public get key(): string {
    const proto = Reflect.getPrototypeOf(this);

    if (proto === ABSTRACT.prototype) {
      return ABSTRACT.key;
    }

    if (!(proto && proto instanceof ABSTRACT)) {
      throw new TypeError(
        'Unexpected call to ABSTRACT getter on object which does\'t extend ABSTRACT',
      );
    }

    // The usage of Function here is intentional.  This is casting `this.constructor` to any
    // callable value (including classes) with the property `key`.

    const constructor = proto.constructor as Function & {
      key: string,
    };

    // Ensure that the parent DataType has a `key` property.
    if (!Object.prototype.hasOwnProperty.call(constructor, 'key') || !proto) {
      throw new TypeError(
        `Expected type '${constructor.name}' to have a static property 'key'`,
      );
    }

    // This will be used instead of the getter any time the type is used.
    Reflect.defineProperty(proto, 'key', {
      writable: false,
      enumerable: false,
      configurable: false,
      value: constructor.key,
    });

    return constructor.key;
  }

  public static readonly escape:
    | boolean
    | ((str: string, opts: StringifyOptions) => string) = true;

  public get escape():
    | boolean
    | ((str: string, opts: StringifyOptions) => string) {
    const proto = Reflect.getPrototypeOf(this);

    if (proto === ABSTRACT.prototype) {
      return ABSTRACT.escape;
    }

    if (!(proto && proto instanceof ABSTRACT)) {
      throw new TypeError(
        'Unexpected call to ABSTRACT getter on object which does not extend ABSTRACT',
      );
    }

    // The usage of Function here is intentional.  This is casting `this.constructor` to any
    // callable value (including classes) with the property `escape`.

    const constructor = proto.constructor as Function & {
      escape: boolean | ((str: string, opts: StringifyOptions) => string),
    };

    // Since proto must extend ABSTRACT.prototype, we'll assume that its constructor extends ABSTRACT.
    // This will be used instead of the getter any time the type is used.
    Reflect.defineProperty(proto, 'escape', {
      writable: false,
      enumerable: false,
      configurable: false,
      value: constructor.escape,
    });

    return constructor.escape;
  }

  protected _construct<Constructor extends abstract new () => ABSTRACT<any>>(
    ...args: ConstructorParameters<Constructor>): this {
    const constructor = this.constructor as new (
      ..._args: ConstructorParameters<Constructor>
    ) => this;

    return new constructor(...args);
  }

  dialectTypes = '';
  /** A meta-property used in typing to determine the JS type of a value of this type
   * at runtime.  E.g. for the String DataType this would be a `string`, since that's what sequelize returns by default.
   *
   * @private
   */
  private readonly _saneType?: SaneType;

  protected _sanitize?(
    value: RawType,
    options?: { raw?: false },
  ): SaneType | null;
  protected _sanitize?(value: RawType, options: { raw: true }): RawType | null;

  public validate?(value: AcceptedType): asserts value is AcceptedType;

  protected _stringify?(value: AcceptedType, options: StringifyOptions): string;

  public stringify(value: AcceptedType, options: StringifyOptions): string {
    if (this._stringify) {
      return this._stringify(value, options);
    }

    return String(value);
  }

  protected _bindParam?(value: AcceptedType, options: BindParamOptions): string;

  public bindParam(value: AcceptedType, options: BindParamOptions): string {
    if (this._bindParam) {
      this._bindParam(value, options);
    }

    return options.bindParam(String(value));
  }

  public toString(options: StringifyOptions): string {
    return this.toSql(options);
  }

  public toSql(_options: StringifyOptions): string {
    // this is defiend via
    if (!this.key) {
      throw new TypeError('Expected a key property to be defined');
    }

    return this.key ?? '';
  }

  static toString() {
    return this.name;
  }

  static warn(link: string, text: string) {
    if (!warnings[text]) {
      warnings[text] = true;
      logger.warn(`${text} \n>> Check: ${link}`);
    }
  }

  static extend<A, S extends A, Options>(
    this: new (options: Options) => ABSTRACT<A, S>,
    oldType: ABSTRACT<A, S> & { options: Options },
  ) {
    return new this(oldType.options);
  }

  static isType(value: any): value is DataType {
    if (value.prototype && value.prototype instanceof ABSTRACT) {
      return true;
    }

    return value instanceof ABSTRACT;
  }
}

export type ABSTRACT<
  AcceptedType,
  SaneType extends AcceptedType = AcceptedType,
  RawType = AcceptedType,
> = _ABSTRACT<AcceptedType, SaneType, RawType>;
export const ABSTRACT = classToInvokable(_ABSTRACT);

interface StringTypeOptions {
  length?: number;
  binary?: boolean;
}

type StringConstructorParams =
  | []
  | [StringTypeOptions]
  | [number | undefined]
  | [number | undefined, boolean | undefined];

class _STRING extends ABSTRACT<string | Buffer, string> {
  public static readonly key: string = 'STRING';
  protected readonly options: Required<StringTypeOptions>;
  protected readonly _binary: boolean;
  protected readonly _length: number;

  /**
   * @param {StringTypeOptions} options hm
   * @param {number} [length=255] length of string
   * @param {boolean} [binary=false] Is this binary?
   */
  constructor(options?: StringTypeOptions);
  constructor(length?: number, binary?: boolean);
  constructor(...args: StringConstructorParams);
  constructor(length?: number | StringTypeOptions, binary?: boolean) {
    super();
    let options: StringTypeOptions;
    if (typeof length === 'object' && length != null) {
      options = length;
    } else {
      options = { length, binary };
    }

    this.options = {
      length: options.length || 255,
      binary: options.binary ?? false,
    };

    this._binary = this.options.binary;
    this._length = this.options.length;
  }

  public toSql() {
    return joinSQLFragments([
      `VAR_CHAR(${this.options.length})`,
      this.options.binary && 'BINARY',
    ]);
  }

  public validate(value: string | Buffer): asserts value is string | Buffer;
  public validate(value: string | Buffer): true {
    if (Object.prototype.toString.call(value) !== '[object String]') {
      if (
        (this.options.binary && Buffer.isBuffer(value))
        || typeof value === 'number'
      ) {
        return true;
      }

      throw new ValidationError(
        util.format('%j is not a valid string', value),
        [],
      );
    }

    return true;
  }

  get BINARY() {
    return this._construct<typeof STRING>({
      ...this.options,
      binary: true,
    });
  }

  static get BINARY() {
    return new this().BINARY;
  }
}

/**
 * STRING A variable length string
 */
export type STRING = _STRING;
export const STRING = classToInvokable(_STRING);

class _CHAR extends STRING {
  public static readonly key = 'CHAR';
  public toSql() {
    return joinSQLFragments([
      `CHAR(${this.options.length})`,
      this.options.binary && 'BINARY',
    ]);
  }
}

/**
 * CHAR A fixed length string
 */
export type CHAR = _CHAR;
export const CHAR = classToInvokable(_CHAR);

export enum TextLength {
  TINY = 'tiny',
  MEDIUM = 'medium',
  LONG = 'long',
}

interface TextOptions {
  length?: TextLength;
}

class _TEXT extends ABSTRACT<string, string> {
  public static readonly key = 'TEXT';
  protected readonly options: TextOptions;
  protected _length?: TextLength;

  /**
   * @param [length='TEXT'] could be tiny, medium, long.
   */
  constructor(length?: TextLength | Partial<TextOptions>) {
    super();

    const options = typeof length === 'object' ? length : { length };

    this.options = {
      length: options.length?.toLowerCase() as TextLength,
    };

    this._length = this.options.length;
  }

  toSql() {
    switch (this.options.length) {
      case 'tiny':
        return 'TINY_TEXT';
      case 'medium':
        return 'MEDIUM_TEXT';
      case 'long':
        return 'LONG_TEXT';
      default:
        return this.key;
    }
  }

  validate(value: string): asserts value is string;
  validate(value: string): true {
    if (typeof value !== 'string') {
      throw new ValidationError(
        util.format('%j is not a valid string', value),
        [],
      );
    }

    return true;
  }
}

/**
 * Unlimited length TEXT column
 */
export type TEXT = _TEXT;
export const TEXT = classToInvokable(_TEXT);

class _CITEXT extends ABSTRACT<string> {
  public static readonly key = 'CITEXT';
  validate(value: string): asserts value is string;
  validate(value: string): true {
    if (typeof value !== 'string') {
      throw new ValidationError(
        util.format('%j is not a valid string', value),
        [],
      );
    }

    return true;
  }
}

/**
 * An unlimited length case-insensitive text column.
 * Original case is preserved but acts case-insensitive when comparing values (such as when finding or unique constraints).
 * Only available in Postgres and SQLite.
 *
 */
export type CITEXT = _CITEXT;
export const CITEXT = classToInvokable(_CITEXT);

export interface NumberOptions {
  length?: number;
  decimals?: number;
  zerofill?: boolean;
  unsigned?: boolean;
}

type AcceptedNumber =
  | number
  | boolean
  | null
  | undefined
  | boolean
  | { toString(): string };

class _NUMBER extends ABSTRACT<AcceptedNumber, number> {
  public static readonly key: string = 'NUMBER';

  protected options: NumberOptions;
  protected _length?: number;
  protected _decimals?: number;
  protected _zerofill?: boolean;
  protected _unsigned?: boolean;

  /**
   * @param options type options
   * @param [options.length] length of type, like `INT(4)`
   * @param [options.zerofill] Is zero filled?
   * @param [options.unsigned] Is unsigned?
   * @param [options.decimals] number of decimal points, used with length `FLOAT(5, 4)`
   * @param [options.precision] defines precision for decimal type
   * @param [options.scale] defines scale for decimal type
   */
  constructor(options: number | Readonly<NumberOptions> = {}) {
    super();
    if (typeof options === 'number') {
      options = {
        length: options,
      };
    }

    this.options = options;
    this._length = options.length;
    this._zerofill = options.zerofill;
    this._decimals = options.decimals;
    this._unsigned = options.unsigned;
  }

  public toSql(): string {
    let result = this.key;

    if (this._length) {
      result += `(${this._length}`;
      if (typeof this._decimals === 'number') {
        result += `,${this._decimals}`;
      }

      result += ')';
    }

    if (this._unsigned) {
      result += ' UNSIGNED';
    }

    if (this._zerofill) {
      result += ' ZEROFILL';
    }

    return result;
  }

  public validate(value: AcceptedNumber): asserts value is number;
  public validate(value: AcceptedNumber): true {
    if (!Validator.isFloat(String(value))) {
      throw new ValidationError(
        util.format(
          `%j is not a valid ${super
            .toString({
              escape(str) {
                return str;
              },
            })
            .toLowerCase()}`,
          value,
        ),
        [],
      );
    }

    return true;
  }

  protected _stringify(number: AcceptedNumber): string {
    // This should be unnecessary but since this directly returns the passed string its worth the added validation.
    this.validate(number);

    return String(number);
  }

  public get UNSIGNED() {
    return this._construct<typeof NUMBER>({ ...this.options, unsigned: true });
  }

  public get ZEROFILL() {
    return this._construct<typeof NUMBER>({ ...this.options, zerofill: true });
  }

  public static get UNSIGNED() {
    return new this({ unsigned: true });
  }

  public static get ZEROFILL() {
    return new this({ zerofill: true });
  }
}

/**
 * Base number type which is used to build other types
 */
export type NUMBER = _NUMBER;
export const NUMBER = classToInvokable(_NUMBER);

class _INTEGER extends NUMBER {
  public static readonly key: string = 'INTEGER';

  public validate(value: AcceptedNumber) {
    if (!Validator.isInt(String(value))) {
      throw new ValidationError(
        util.format(`%j is not a valid ${this.key.toLowerCase()}`, value),
        [],
      );
    }

    return true;
  }
}

/**
 * A 32 bit integer
 */
export type INTEGER = _INTEGER;
export const INTEGER = classToInvokable(_INTEGER);

class _TINYINT extends INTEGER {
  public static readonly key = 'TINYINT';
}

/**
 * A 8 bit integer
 */
export type TINYINT = _TINYINT;
export const TINYINT = classToInvokable(_TINYINT);

class _SMALLINT extends INTEGER {
  public static readonly key = 'SMALLINT';
}

/**
 * A 16 bit integer
 */
export type SMALLINT = _SMALLINT;
export const SMALLINT = classToInvokable(_SMALLINT);

class _MEDIUMINT extends INTEGER {
  public static readonly key = 'MEDIUMINT';
}

/**
 * A 24 bit integer
 */
export type MEDIUMINT = _MEDIUMINT;
export const MEDIUMINT = _MEDIUMINT;

class _BIGINT extends INTEGER {
  public static readonly key = 'BIGINT';
}

/**
 * A 64 bit integer
 */
export type BIGINT = _BIGINT;
export const BIGINT = classToInvokable(_BIGINT);

type FloatConstructorParams =
  | []
  | [NumberOptions | undefined]
  | [number | undefined]
  | [number | undefined, number | undefined];

class _FLOAT extends NUMBER {
  public static readonly key: string = 'FLOAT';
  public static readonly escape = false;

  /**
   * @param {object|string|number} [length] length of type, like `FLOAT(4)`
   * @param {string|number} [decimals] number of decimal points, used with length `FLOAT(5, 4)`
   */
  constructor(options: NumberOptions);
  constructor(length: number, decimals?: number);
  constructor(...args: FloatConstructorParams);
  constructor(length?: number | NumberOptions, decimals?: number) {
    super(typeof length === 'object' ? length : { length, decimals });
  }

  public validate(value: AcceptedNumber): asserts value is AcceptedNumber;
  public validate(value: AcceptedNumber): true {
    if (!Validator.isFloat(String(value))) {
      throw new ValidationError(
        util.format('%j is not a valid float', value),
        [],
      );
    }

    return true;
  }

  protected _value(value: AcceptedNumber) {
    const num = typeof value === 'number' ? value : Number(String(value));

    if (Number.isNaN(num)) {
      return 'NaN';
    }

    if (!Number.isFinite(num)) {
      const sign = num < 0 ? '-' : '';

      return `${sign}Infinity`;
    }

    return num.toString();
  }

  protected _stringify(value: AcceptedNumber) {
    this.validate(value);

    return `'${this._value(value)}'`;
  }

  protected _bindParam(value: AcceptedNumber, options: BindParamOptions) {
    return options.bindParam(this._value(value));
  }
}

/**
 * Floating point number (4-byte precision).
 */
export type FLOAT = _FLOAT;
export const FLOAT = classToInvokable(_FLOAT);

class _REAL extends FLOAT {
  public static readonly key = 'REAL';
}

/**
 * Floating point number (4-byte precision).
 */
export type REAL = _REAL;
export const REAL = classToInvokable(_REAL);

class _DOUBLE extends FLOAT {
  public static readonly key = 'DOUBLE';
}

/**
 * Floating point number (8-byte precision).
 */
export type DOUBLE = _DOUBLE;
export const DOUBLE = classToInvokable(_DOUBLE);

interface DecimalOptions extends NumberOptions {
  scale?: number;
  precision?: number;
}

type DecimalConstructorParams =
  | []
  | [DecimalOptions]
  | [number]
  | [number, number | undefined];

class _DECIMAL extends NUMBER {
  public static readonly key = 'DECIMAL';
  protected _scale?: number;
  protected _precision?: number;
  protected options: DecimalOptions;

  /**
   * @param {string|number} [precision] defines precision
   * @param {string|number} [scale] defines scale
   */
  constructor(options?: DecimalOptions);
  constructor(precision: number, scale?: number);
  constructor(...args: DecimalConstructorParams);
  constructor(precision?: number | DecimalOptions, scale?: number) {
    if (typeof precision === 'object') {
      super(precision);
      this.options ??= precision;
    } else {
      super();
      // Sadly TS isn't smart enough to infer that this will be defined by the constructor of NUMBER.
      // This should never do anything becuase this.options should already be defined.
      this.options ??= {};

      this.options.precision = precision;
      this.options.scale = scale;
    }

    this._precision = this.options.precision;
    this._scale = this.options.scale;
  }

  public toSql() {
    if (this._precision || this._scale) {
      return `DECIMAL(${[this._precision, this._scale]
        .filter(num => num != null)
        .join(',')})`;
    }

    return 'DECIMAL';
  }

  public validate(value: AcceptedNumber): asserts value is AcceptedNumber;
  public validate(value: AcceptedNumber): true {
    if (!Validator.isDecimal(String(value))) {
      throw new ValidationError(
        util.format('%j is not a valid decimal', value),
        [],
      );
    }

    return true;
  }
}

/**
 * Decimal type, variable precision, take length as specified by user
 */
export type DECIMAL = _DECIMAL;
export const DECIMAL = classToInvokable(_DECIMAL);

/**
 * A boolean / tinyint column, depending on dialect
 */
class _BOOLEAN extends ABSTRACT<
  boolean | Falsy,
  boolean,
  string | number | Buffer | boolean
> {
  public static readonly key = 'BOOLEAN';

  public toSql() {
    // Note: This may vary depending on the dialect.
    return 'TINYINT(1)';
  }

  public validate(value: boolean | Falsy): asserts value is boolean;
  public validate(value: boolean | Falsy): true {
    if (!Validator.isBoolean(String(value))) {
      throw new ValidationError(
        util.format('%j is not a valid boolean', value),
        [],
      );
    }

    return true;
  }

  protected _sanitize(
    value: string | number | Buffer | boolean,
  ): boolean | null {
    if (value !== null && value !== undefined) {
      if (Buffer.isBuffer(value) && value.length === 1) {
        // Bit fields are returned as buffers
        value = value[0];
      }

      const type = typeof value;
      if (type === 'string') {
        // Only take action on valid boolean strings.
        if (value === 'true') {
          return true;
        }

        if (value === 'false') {
          return false;
        }
      } else if (
        type === 'number' // Only take action on valid boolean integers.
        && (value === 0 || value === 1)
      ) {
        return Boolean(value);
      }
    }

    return null;
  }

  static readonly parse = this.prototype._sanitize;
}

export type BOOLEAN = _BOOLEAN;
export const BOOLEAN = classToInvokable(_BOOLEAN);

class _TIME extends ABSTRACT<Date | string | number, Date> {
  public static readonly key = 'TIME';

  toSql() {
    return 'TIME';
  }
}

/**
 * A time column
 */
export type TIME = _TIME;
export const TIME = classToInvokable(_TIME);

interface DateOptions {
  /**
   * The precision of the date.
   */
  length?: string | number;
}

type RawDate = Date | string | number;
type AcceptedDate = RawDate | moment.Moment;

class _DATE extends ABSTRACT<AcceptedDate, Date, RawDate> {
  public static readonly key: string = 'DATE';
  protected options: DateOptions;
  protected _length?: string | number;

  /**
   * @param [length] precision to allow storing milliseconds
   */
  constructor(length?: number | DateOptions) {
    super();
    const options: DateOptions
      = typeof length === 'object' ? length : { length };
    this.options = options;
    // TODO: Check if this is still used and remove if it isn't.
    this._length = options.length || '';
  }

  public toSql() {
    return 'DATETIME';
  }

  public validate(value: AcceptedDate) {
    if (!Validator.isDate(String(value))) {
      throw new ValidationError(
        util.format('%j is not a valid date', value),
        [],
      );
    }

    return true;
  }

  protected _sanitize(value: RawDate, options: { raw: true }): RawDate;
  protected _sanitize(value: RawDate, options?: { raw?: false }): Date;
  protected _sanitize(value: RawDate, options?: { raw?: boolean }) {
    if (options?.raw) {
      return value;
    }

    if (value instanceof Date) {
      return value;
    }

    return new Date(value);
  }

  protected _isChanged(
    value: AcceptedDate,
    originalValue: AcceptedDate,
  ): boolean {
    if (
      originalValue
      && Boolean(value)
      && (value === originalValue
        || (value instanceof Date
          && originalValue instanceof Date
          && value.getTime() === originalValue.getTime()))
    ) {
      return false;
    }

    // not changed when set to same empty value
    if (!originalValue && !value && originalValue === value) {
      return false;
    }

    return true;
  }

  protected _applyTimezone(date: AcceptedDate, options: { timezone?: string }) {
    if (options.timezone) {
      if (momentTz.tz.zone(options.timezone)) {
        return momentTz(date).tz(options.timezone);
      }

      return moment(date).utcOffset(options.timezone);
    }

    return momentTz(date);
  }

  protected _stringify(
    date: AcceptedDate,
    options: { timezone?: string } = {},
  ) {
    if (!moment.isMoment(date)) {
      date = this._applyTimezone(date, options);
    }

    // Z here means current timezone, *not* UTC
    return date.format('YYYY-MM-DD HH:mm:ss.SSS Z');
  }
}

/**
 * A date and time.
 */
export type DATE = _DATE;
export const DATE = classToInvokable(_DATE);

class _DATEONLY extends ABSTRACT<AcceptedDate, Date, RawDate> {
  public static readonly key = 'DATEONLY';

  public toSql() {
    return 'DATE';
  }

  protected _stringify(date: AcceptedDate) {
    return moment(date).format('YYYY-MM-DD');
  }

  protected _sanitize(value: RawDate, options?: { raw?: false }): Date;
  protected _sanitize(value: RawDate, options: { raw: true }): RawDate;
  protected _sanitize(value: RawDate, options?: { raw?: boolean }) {
    if (!options?.raw && value) {
      return moment(value).format('YYYY-MM-DD');
    }

    return value;
  }

  protected _isChanged(value: AcceptedDate, originalValue: AcceptedDate) {
    if (originalValue && Boolean(value) && originalValue === value) {
      return false;
    }

    // not changed when set to same empty value
    if (!originalValue && !value && originalValue === value) {
      return false;
    }

    return true;
  }
}

/**
 * A date only column (no timestamp)
 */
export type DATEONLY = _DATEONLY;
export const DATEONLY = classToInvokable(_DATEONLY);

class _HSTORE extends ABSTRACT<Record<string, unknown>> {
  public static readonly key = 'HSTORE';

  public validate(value: Record<string, unknown>) {
    const proto = Object.getPrototypeOf(value);

    if (proto && proto !== Object.prototype) {
      throw new ValidationError(
        util.format('%j is not a valid hstore', value),
        [],
      );
    }

    return true;
  }
}

/**
 * A key / value store column. Only available in Postgres.
 */
export type HSTORE = _HSTORE;
export const HSTORE = classToInvokable(_HSTORE);

class _JSONTYPE extends ABSTRACT<any> {
  public static readonly key: string = 'JSON';

  validate() {
    return true;
  }

  stringify(value: any) {
    return JSON.stringify(value);
  }
}

/**
 * A JSON string column. Available in MySQL, Postgres and SQLite
 */
type JSONTYPE = _JSONTYPE;
const JSONTYPE = classToInvokable(_JSONTYPE);

export { JSONTYPE as JSON };

class _JSONB extends JSONTYPE {
  public static readonly key = 'JSONB';
}

/**
 * A binary storage JSON column. Only available in Postgres.
 */
export type JSONB = _JSONB;
export const JSONB = classToInvokable(_JSONB);

class _NOW extends ABSTRACT<never> {
  public static readonly key = 'NOW';
}

/**
 * A default value of the current timestamp.  Not a valid type.
 */
export type NOW = _NOW;
export const NOW = classToInvokable(_NOW);

type AcceptedBlob = Buffer | string;

enum BlobLength {
  TINY = 'tiny',
  MEDIUM = 'medium',
  LONG = 'long',
}

interface BlobOptions {
  length?: BlobLength;
}

class _BLOB extends ABSTRACT<AcceptedBlob, Buffer> {
  public static readonly key = 'BLOB';
  public static escape: typeof ABSTRACT['escape'] = false;
  protected options: BlobOptions;
  protected _length?: string;

  /**
   * @param [length=''] could be tiny, medium, long.
   */
  constructor(length?: BlobLength | BlobOptions) {
    super();
    const options: BlobOptions
      = typeof length === 'object' ? length : { length };

    this.options = options;
    this._length = options.length?.toLowerCase();
  }

  toSql() {
    switch (this._length) {
      case BlobLength.TINY:
        return 'TINY_BLOB';
      case BlobLength.MEDIUM:
        return 'MEDIUM_BLOB';
      case BlobLength.LONG:
        return 'LONG_BLOB';
      default:
        return this.key;
    }
  }

  public validate(value: AcceptedBlob) {
    if (typeof value !== 'string' && !Buffer.isBuffer(value)) {
      throw new ValidationError(
        util.format('%j is not a valid blob', value),
        [],
      );
    }

    return true;
  }

  protected _stringify(value: string | Buffer) {
    const buf
      = typeof value === 'string' ? Buffer.from(value, 'binary') : value;

    const hex = buf.toString('hex');

    return this._hexify(hex);
  }

  protected _hexify(hex: string) {
    return `X'${hex}'`;
  }

  protected _bindParam(value: AcceptedBlob, options: BindParamOptions) {
    return options.bindParam(value);
  }
}

/**
 * Binary storage
 */
export type BLOB = _BLOB;
export const BLOB = classToInvokable(_BLOB);

interface RangeOptions<T extends NUMBER | DATE | DATEONLY> {
  subtype?: T;
}

class _RANGE<T extends NUMBER | DATE | DATEONLY = INTEGER> extends ABSTRACT<
  AcceptedNumber,
  T[]
> {
  public static readonly key = 'RANGE';
  protected _subtype: string;
  protected options: Required<RangeOptions<T>>;

  /**
   * @param subtype A subtype for range, like RANGE(DATE)
   */
  constructor(
    subtype: DataType<T> | RangeOptions<T> | { subtype: new () => T },
  ) {
    super();
    const options = ABSTRACT.isType(subtype) ? { subtype } : subtype;

    if (typeof options.subtype === 'function') {
      options.subtype
        = typeof options.subtype === 'function'
          ? new options.subtype()
          : options.subtype;
    } else {
      // @ts-expect-error This errors since INTEGER doesn't always apply to T, but we'll assume that if T is provided,
      // the user will provvide the type themselves.
      options.subtype ??= new INTEGER();
    }

    this._subtype = options.subtype.key;
    this.options = options as Required<RangeOptions<T>>;
  }

  public validate(value: Array<SaneTypeOf<T>>) {
    if (!Array.isArray(value)) {
      throw new ValidationError(
        util.format('%j is not a valid range', value),
        [],
      );
    }

    if (value.length !== 2) {
      throw new ValidationError(
        'A range must be an array with two elements',
        [],
      );
    }

    return true;
  }
}

/**
 * Range types are data types representing a range of values of some element type (called the range's subtype).
 * Only available in Postgres. See [the Postgres documentation](http://www.postgresql.org/docs/9.4/static/rangetypes.html) for more details
 */
export type RANGE<T extends NUMBER | DATE | DATEONLY> = _RANGE<T>;
export const RANGE = classToInvokable(_RANGE);

interface UUIDOptions {
  acceptStrings?: boolean;
}

class _UUID extends ABSTRACT<string> {
  public static readonly key = 'UUID';

  public validate(value: string, options?: UUIDOptions) {
    if (typeof value !== 'string') {
      throw new ValidationError(
        util.format('%j is not a valid uuid', value),
        [],
      );
    }

    if (!options?.acceptStrings && !Validator.isUUID(value)) {
      throw new ValidationError(
        util.format('%j is not a valid uuid', value),
        [],
      );
    }

    return true;
  }
}

/**
 * A column storing a unique universal identifier.
 * Use with `UUIDV1` or `UUIDV4` for default values.
 */
export type UUID = _UUID;
export const UUID = classToInvokable(_UUID);

class _UUIDV1 extends ABSTRACT<string> {
  public static readonly key = 'UUIDV1';

  public validate(value: string, options?: UUIDOptions) {
    if (typeof value !== 'string') {
      throw new ValidationError(
        util.format('%j is not a valid uuid', value),
        [],
      );
    }

    if (!options?.acceptStrings && !Validator.isUUID(value, 1)) {
      throw new ValidationError(
        util.format('%j is not a valid uuidv1', value),
        [],
      );
    }

    return true;
  }
}

/**
 * A default unique universal identifier generated following the UUID v1 standard
 */
export type UUIDV1 = _UUIDV1;
export const UUIDV1 = classToInvokable(_UUIDV1);

class _UUIDV4 extends ABSTRACT<string> {
  public static readonly key = 'UUIDV4';

  public validate(value: string, options?: UUIDOptions) {
    if (typeof value !== 'string') {
      throw new ValidationError(
        util.format('%j is not a valid uuid', value),
        [],
      );
    }

    if (!options?.acceptStrings && !Validator.isUUID(value, 4)) {
      throw new ValidationError(
        util.format('%j is not a valid uuidv4', value),
        [],
      );
    }

    return true;
  }
}

/**
 * A default unique universal identifier generated following the UUID v4 standard
 */
export type UUIDV4 = _UUIDV4;
export const UUIDV4 = classToInvokable(_UUIDV4);

class _VIRTUAL<T> extends ABSTRACT<T> {
  public static readonly key = 'VIRTUAL';

  returnType?: ABSTRACT<T>;
  fields?: string[];

  /**
   * @param [ReturnType] return type for virtual type
   * @param [fields] array of fields this virtual type is dependent on
   */
  constructor(ReturnType?: DataType, fields?: string[]) {
    super();
    if (typeof ReturnType === 'function') {
      ReturnType = new ReturnType();
    }

    this.returnType = ReturnType;
    this.fields = fields;
  }
}

/**
 * A virtual value that is not stored in the DB. This could for example be useful if you want to provide a default value in your model that is returned to the user but not stored in the DB.
 *
 * You could also use it to validate a value before permuting and storing it. VIRTUAL also takes a return type and dependency fields as arguments
 * If a virtual attribute is present in `attributes` it will automatically pull in the extra fields as well.
 * Return type is mostly useful for setups that rely on types like GraphQL.
 *
 * @example <caption>Checking password length before hashing it</caption>
 * sequelize.define('user', {
 *   password_hash: DataTypes.STRING,
 *   password: {
 *     type: DataTypes.VIRTUAL,
 *     set: function (val) {
 *        // Remember to set the data value, otherwise it won't be validated
 *        this.setDataValue('password', val);
 *        this.setDataValue('password_hash', this.salt + val);
 *      },
 *      validate: {
 *         isLongEnough: function (val) {
 *           if (val.length < 7) {
 *             throw new Error("Please choose a longer password")
 *          }
 *       }
 *     }
 *   }
 * })
 *
 * # In the above code the password is stored plainly in the password field so it can be validated, but is never stored in the DB.
 *
 * @example <caption>Virtual with dependency fields</caption>
 * {
 *   active: {
 *     type: new DataTypes.VIRTUAL(DataTypes.BOOLEAN, ['createdAt']),
 *     get: function() {
 *       return this.get('createdAt') > Date.now() - (7 * 24 * 60 * 60 * 1000)
 *     }
 *   }
 * }
 *
 */
export type VIRTUAL<T> = _VIRTUAL<T>;
export const VIRTUAL = classToInvokable(_VIRTUAL);

interface EnumOptions<Member extends string> {
  values: Member[];
}

type EnumParams<Member extends string> =
  | []
  | [EnumOptions<Member>]
  | [Member[]]
  | Array<Member | Member[]>;

class _ENUM<Member extends string> extends ABSTRACT<Member> {
  public static readonly key = 'ENUM';
  public values: Member[];
  protected options: EnumOptions<Member>;

  /**
   * @param {...any|{ values: any[] }|any[]} args either array of values or options object with values array. It also supports variadic values
   */
  constructor(options: EnumOptions<Member>);
  constructor(members: Member[]);
  constructor(...members: Array<Member | Member[]>);
  constructor(...args: EnumParams<Member>); // This is the overload TS will chose when using ConstructorParams and is needed.
  constructor(...args: EnumParams<Member>) {
    super();
    let options: EnumOptions<Member>;

    const [arg0] = args;

    if (typeof arg0 === 'object' && !Array.isArray(arg0)) {
      options = arg0;
    } else if (args.length === 1 && Array.isArray(arg0)) {
      options = { values: arg0 };
    } else {
      options = {
        // this rule is irrelevant - this is using `concat` for cases such as `new Union('a', ['b', 'c]])`
        // eslint-disable-next-line unicorn/prefer-spread
        values: ([] as Member[]).concat(...(args as Array<Member | Member[]>)),
      };
    }

    this.values = options.values;
    this.options = options;
  }

  validate(value: Member): asserts value is Member;
  validate(value: Member): true {
    if (!this.values.includes(value)) {
      throw new ValidationError(
        util.format('%j is not a valid choice in %j', value, this.values),
        [],
      );
    }

    return true;
  }
}

/**
 * An enumeration, Postgres Only
 *
 * @example
 * DataTypes.ENUM('value', 'another value')
 * DataTypes.ENUM(['value', 'another value'])
 * DataTypes.ENUM({
 *   values: ['value', 'another value']
 * })
 */
export type ENUM<Member extends string> = _ENUM<Member>;
export const ENUM = classToInvokable(_ENUM);

interface ArrayOptions<T extends ABSTRACT<any>> {
  type: T;
}

/**
 * An array of `type`. Only available in Postgres.
 *
 * @example
 * DataTypes.ARRAY(DataTypes.DECIMAL)
 */
class _ARRAY<T extends ABSTRACT<any>> extends ABSTRACT<
  Array<AcceptableTypeOf<T>>,
  Array<SaneTypeOf<T>>,
  Array<RawTypeOf<T>>
> {
  public static readonly key = 'ARRAY';
  protected options: ArrayOptions<T>;
  public type: T;

  /**
   * @param type type of array values
   */
  constructor(type: DataType<T> | { type: DataType<T> }) {
    super();
    const opts = ABSTRACT.isType(type) ? { type } : type;

    this.options = {
      type: typeof opts.type === 'function' ? new opts.type() : opts.type,
    };

    this.type = this.options.type;
  }

  toSql(options: StringifyOptions) {
    return `${this.type.toSql(options)}[]`;
  }

  // Note: Validation of individual items is handled in the query-generator.
  public validate(value: Array<AcceptableTypeOf<T>>) {
    if (!Array.isArray(value)) {
      throw new ValidationError(
        util.format('%j is not a valid array', value),
        [],
      );
    }

    return true;
  }

  static is<T extends ABSTRACT<any>>(
    obj: unknown,
    type: new () => T,
  ): obj is ARRAY<T> {
    return obj instanceof ARRAY && (obj as ARRAY<any>).type instanceof type;
  }
}

export type ARRAY<T extends ABSTRACT<any>> = _ARRAY<T>;
export const ARRAY = classToInvokable(_ARRAY);

export type GeometryType = Uppercase<keyof typeof wkx>;

interface GeometryOptions<Type extends GeometryType> {
  type?: Type;
  srid?: number;
}

export type GeometryParams<Type extends GeometryType> =
  | []
  | [GeometryOptions<Type> | undefined]
  | [Type | undefined]
  | [Type | undefined, number | undefined];

class _GEOMETRY<Type extends GeometryType = GeometryType> extends ABSTRACT<
  wkx.Geometry | Buffer | string,
  wkx.Geometry
> {
  public static readonly key: string = 'GEOMETRY';
  public static readonly escape = false;
  protected options: GeometryOptions<Type>;
  protected type?: Type;
  protected srid?: number;

  /**
   * @param {string} [type] Type of geometry data
   * @param {string} [srid] SRID of type
   */
  constructor(type: Type, srid?: number);
  constructor(options: GeometryOptions<Type>);
  constructor(...args: GeometryParams<Type>);
  constructor(type?: Type | GeometryOptions<Type>, srid?: number) {
    super();
    const options = typeof type === 'object' ? type : { type, srid };
    this.options = options;
    this.type = options.type;
    this.srid = options.srid;
  }

  protected _stringify(value: string | Buffer, options: StringifyOptions) {
    return `STGeomFromText(${options.escape(
      wkx.Geometry.parseGeoJSON(value).toWkt(),
    )})`;
  }

  protected _bindParam(
    value: string | Buffer | wkx.Geometry,
    options: BindParamOptions,
  ) {
    return `STGeomFromText(${options.bindParam(
      wkx.Geometry.parseGeoJSON(value).toWkt(),
    )})`;
  }
}

/**
 * A column storing Geometry information.
 * It is only available in PostgreSQL (with PostGIS), MariaDB or MySQL.
 *
 * GeoJSON is accepted as input and returned as output.
 *
 * In PostGIS, the GeoJSON is parsed using the PostGIS function `STGeomFromGeoJSON`.
 * In MySQL it is parsed using the function `STGeomFromText`.
 *
 * Therefore, one can just follow the [GeoJSON spec](https://tools.ietf.org/html/rfc7946) for handling geometry objects.  See the following examples:
 *
 * @example <caption>Defining a Geometry type attribute</caption>
 * DataTypes.GEOMETRY
 * DataTypes.GEOMETRY('POINT')
 * DataTypes.GEOMETRY('POINT', 4326)
 *
 * @example <caption>Create a new point</caption>
 * const point = { type: 'Point', coordinates: [-76.984722, 39.807222]}; // GeoJson format: [lng, lat]
 *
 * User.create({username: 'username', geometry: point });
 *
 * @example <caption>Create a new linestring</caption>
 * const line = { type: 'LineString', 'coordinates': [ [100.0, 0.0], [101.0, 1.0] ] };
 *
 * User.create({username: 'username', geometry: line });
 *
 * @example <caption>Create a new polygon</caption>
 * const polygon = { type: 'Polygon', coordinates: [
 *                 [ [100.0, 0.0], [101.0, 0.0], [101.0, 1.0],
 *                   [100.0, 1.0], [100.0, 0.0] ]
 *                 ]};
 *
 * User.create({username: 'username', geometry: polygon });
 *
 * @example <caption>Create a new point with a custom SRID</caption>
 * const point = {
 *   type: 'Point',
 *   coordinates: [-76.984722, 39.807222], // GeoJson format: [lng, lat]
 *   crs: { type: 'name', properties: { name: 'EPSG:4326'} }
 * };
 *
 * User.create({username: 'username', geometry: point })
 *
 *
 * @see {@link DataTypes.GEOGRAPHY}
 */
export type GEOMETRY = _GEOMETRY;
export const GEOMETRY = classToInvokable(_GEOMETRY);

/**
 * A geography datatype represents two dimensional spacial objects in an elliptic coord system.
 *
 * **The difference from geometry and geography type:**
 *
 * PostGIS 1.5 introduced a new spatial type called geography, which uses geodetic measurement instead of Cartesian measurement.
 * Coordinate points in the geography type are always represented in WGS 84 lon lat degrees (SRID 4326),
 * but measurement functions and relationships STDistance, STDWithin, STLength, and STArea always return answers in meters or assume inputs in meters.
 *
 * **What is best to use? It depends:**
 *
 * When choosing between the geometry and geography type for data storage, you should consider what you’ll be using it for.
 * If all you do are simple measurements and relationship checks on your data, and your data covers a fairly large area, then most likely you’ll be better off storing your data using the new geography type.
 * Although the new geography data type can cover the globe, the geometry type is far from obsolete.
 * The geometry type has a much richer set of functions than geography, relationship checks are generally faster, and it has wider support currently across desktop and web-mapping tools
 *
 * @example <caption>Defining a Geography type attribute</caption>
 * DataTypes.GEOGRAPHY
 * DataTypes.GEOGRAPHY('POINT')
 * DataTypes.GEOGRAPHY('POINT', 4326)
 */
class _GEOGRAPHY extends GEOMETRY {
  public static readonly key = 'GEOGRAPHY';
}

export type GEOGRAPHY = _GEOGRAPHY;
export const GEOGRAPHY = classToInvokable(_GEOGRAPHY);

class _CIDR extends ABSTRACT<string> {
  public static readonly key = 'CIDR';

  public validate(value: string) {
    if (typeof value !== 'string' || !Validator.isIPRange(value)) {
      throw new ValidationError(
        util.format('%j is not a valid CIDR', value),
        [],
      );
    }

    return true;
  }
}

/**
 * The cidr type holds an IPv4 or IPv6 network specification. Takes 7 or 19 bytes.
 *
 * Only available for Postgres
 */
export type CIDR = _CIDR;
export const CIDR = classToInvokable(_CIDR);

class _INET extends ABSTRACT<string> {
  public static readonly key = 'INET';
  public validate(value: string) {
    if (typeof value !== 'string' || !Validator.isIP(value)) {
      throw new ValidationError(
        util.format('%j is not a valid INET', value),
        [],
      );
    }

    return true;
  }
}

/**
 * The INET type holds an IPv4 or IPv6 host address, and optionally its subnet. Takes 7 or 19 bytes
 *
 * Only available for Postgres
 */
export type INET = _INET;
export const INET = classToInvokable(_INET);

class _MACADDR extends ABSTRACT<string> {
  public static readonly key = 'MACADDR';

  public validate(value: string) {
    if (typeof value !== 'string' || !Validator.isMACAddress(value)) {
      throw new ValidationError(
        util.format('%j is not a valid MACADDR', value),
        [],
      );
    }

    return true;
  }
}

/**
 * The MACADDR type stores MAC addresses. Takes 6 bytes
 *
 * Only available for Postgres
 *
 */
export type MACADDR = _MACADDR;
export const MACADDR = classToInvokable(_MACADDR);

class _TSVECTOR extends ABSTRACT<string> {
  public static readonly key = 'TSVECTOR';

  public validate(value: string) {
    if (typeof value !== 'string') {
      throw new ValidationError(
        util.format('%j is not a valid string', value),
        [],
      );
    }

    return true;
  }
}

/**
 * The TSVECTOR type stores text search vectors.
 *
 * Only available for Postgres
 *
 */
export type TSVECTOR = _TSVECTOR;
export const TSVECTOR = classToInvokable(_TSVECTOR);

/**
 * A convenience class holding commonly used data types. The data types are used when defining a new model using `Sequelize.define`, like this:
 * ```js
 * sequelize.define('model', {
 *   column: DataTypes.INTEGER
 * })
 * ```
 * When defining a model you can just as easily pass a string as type, but often using the types defined here is beneficial. For example, using `DataTypes.BLOB`, mean
 * that that column will be returned as an instance of `Buffer` when being fetched by sequelize.
 *
 * To provide a length for the data type, you can invoke it like a function: `INTEGER(2)`
 *
 * Some data types have special properties that can be accessed in order to change the data type.
 * For example, to get an unsigned integer with zerofill you can do `DataTypes.INTEGER.UNSIGNED.ZEROFILL`.
 * The order you access the properties in do not matter, so `DataTypes.INTEGER.ZEROFILL.UNSIGNED` is fine as well.
 *
 * * All number types (`INTEGER`, `BIGINT`, `FLOAT`, `DOUBLE`, `REAL`, `DECIMAL`) expose the properties `UNSIGNED` and `ZEROFILL`
 * * The `CHAR` and `STRING` types expose the `BINARY` property
 *
 * Three of the values provided here (`NOW`, `UUIDV1` and `UUIDV4`) are special default values, that should not be used to define types. Instead they are used as shorthands for
 * defining default values. For example, to get a uuid field with a default value generated following v1 of the UUID standard:
 * ```js
 * sequelize.define('model', {
 *   uuid: {
 *     type: DataTypes.UUID,
 *     defaultValue: DataTypes.UUIDV1,
 *     primaryKey: true
 *   }
 * })
 * ```
 * There may be times when you want to generate your own UUID conforming to some other algorithm. This is accomplished
 * using the defaultValue property as well, but instead of specifying one of the supplied UUID types, you return a value
 * from a function.
 * ```js
 * sequelize.define('model', {
 *   uuid: {
 *     type: DataTypes.UUID,
 *     defaultValue: function() {
 *       return generateMyId()
 *     },
 *     primaryKey: true
 *   }
 * })
 * ```
 */
export const DataTypes = {
  ABSTRACT,
  STRING,
  CHAR,
  TEXT,
  NUMBER,
  TINYINT,
  SMALLINT,
  MEDIUMINT,
  INTEGER,
  BIGINT,
  FLOAT,
  TIME,
  DATE,
  DATEONLY,
  BOOLEAN,
  NOW,
  BLOB,
  DECIMAL,
  NUMERIC: DECIMAL,
  UUID,
  UUIDV1,
  UUIDV4,
  HSTORE,
  JSON: JSONTYPE,
  JSONB,
  VIRTUAL,
  ARRAY,
  ENUM,
  RANGE,
  REAL,
  'DOUBLE PRECISION': DOUBLE,
  DOUBLE,
  GEOMETRY,
  GEOGRAPHY,
  CIDR,
  INET,
  MACADDR,
  CITEXT,
  TSVECTOR,
};
export type DataTypes = typeof DataTypes;
