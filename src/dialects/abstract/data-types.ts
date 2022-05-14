import util from 'util';
import isEqual from 'lodash/isEqual';
import isObject from 'lodash/isObject';
import isPlainObject from 'lodash/isPlainObject';
import moment from 'moment';
import momentTz from 'moment-timezone';
import type { Class } from 'type-fest';
import wkx from 'wkx';
import { kIsDataTypeOverrideOf, kSetDialectNames } from '../../dialect-toolbox';
import { ValidationError } from '../../errors';
import type { Falsy } from '../../generic/falsy';
import type { Rangable } from '../../model.js';
import { joinSQLFragments } from '../../utils/join-sql-fragments';
import { validator as Validator } from '../../utils/validator-extras';
import type { HstoreRecord } from '../postgres/hstore.js';
import { isDataType, isDataTypeClass } from './data-types-utils.js';
import type { AbstractDialect } from './index.js';

// If T is a constructor, returns the type of what `new T()` would return,
// otherwise, returns T
export type Constructed<T> = T extends abstract new () => infer Instance
  ? Instance
  : T;

export type AcceptableTypeOf<T extends DataType> =
  Constructed<T> extends AbstractDataType<infer Acceptable> ? Acceptable : never;

export type DataTypeInstance = AbstractDataType<any>;
export type DataTypeClass = Class<AbstractDataType<any>>;

export type DataTypeClassOrInstance =
  | DataTypeInstance
  | DataTypeClass;

export type DataType =
  | string
  | DataTypeClassOrInstance;

// TODO: This typing may not be accurate, validate when query-generator is typed.
export interface StringifyOptions {
  dialect: AbstractDialect;
  escape(value: unknown): string;
  operation?: string;
  timezone?: string;
  // TODO: Update this when query-generator is converted to TS
  field?: any;
}

// TODO: This typing may not be accurate, validate when query-generator is typed.
export interface BindParamOptions extends StringifyOptions {
  bindParam(value: unknown): string;
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

export abstract class AbstractDataType<
  /** The type of value we'll accept - ie for a column of this type, we'll accept this value as user input. */
  AcceptedType,
> {
  /** @internal */
  static readonly types: Record<string, DialectTypeMeta>;
  /** @internal */
  types!: Record<string, DialectTypeMeta>;

  declare readonly key: string;
  declare static readonly [kIsDataTypeOverrideOf]: Class<AbstractDataType<any>>;

  /**
   * Helper used to add a dialect to `types` of a DataType.  It ensures that it doesn't modify the types of its parent.
   *
   * @param dialect The dialect the types apply to
   * @param types The dialect-specific types.
   */
  // TODO: move to utils
  static [kSetDialectNames](dialect: string, types: DialectTypeMeta) {
    if (!Object.prototype.hasOwnProperty.call(this, 'types')) {
      const prop = {
        value: {},
        writable: false,
        enumerable: false,
        configurable: false,
      };

      // TODO: remove the version on prototype, or add a getter instead
      Reflect.defineProperty(this, 'types', prop);
      Reflect.defineProperty(this.prototype, 'types', prop);
    }

    this.types[dialect] = types;
  }

  static get key() {
    throw new Error('Do not try to get the "key" static property on data types, get it on the instance instead.');
  }

  static get escape() {
    throw new Error('The "escape" static property has been removed. Each DataType is responsible for escaping its value correctly.');
  }

  // TODO: move to utils?
  protected _construct<Constructor extends abstract new () => AbstractDataType<any>>(
    ...args: ConstructorParameters<Constructor>): this {
    const constructor = this.constructor as new (
      ..._args: ConstructorParameters<Constructor>
    ) => this;

    return new constructor(...args);
  }

  areValuesEqual(
    value: AcceptedType,
    originalValue: AcceptedType,
  ): boolean {
    return isEqual(value, originalValue);
  }

  /**
   * Used to normalize a value when {@link Model#set} is called. Typically, when retrieved from the database, but
   * also when called by the user manually.
   *
   * @param value
   * @param _options
   * @param _options.raw
   */
  sanitize(value: unknown, _options?: { raw?: true }): unknown {
    return value;
  }

  /**
   * Checks whether the JS value is compatible with (or can be converted to) the SQL data type.
   * Throws if that is not the case.
   *
   * @param value
   */
  validate(value: any): asserts value is AcceptedType {}

  escape(value: AcceptedType, options: StringifyOptions): string {
    return options.dialect.escapeString(this.stringify(value, options));
  }

  /**
   * Transforms a value before adding it to the list of bind parameters of a query.
   *
   * @param value
   * @param options
   */
  bindParam(value: AcceptedType, options: BindParamOptions): string {
    return options.bindParam(this.stringify(value, options));
  }

  /**
   * Converts a JS value to a SQL value, compatible with the SQL data type
   *
   * @param value
   * @param _options
   */
  stringify(value: AcceptedType, _options: StringifyOptions): string {
    return String(value);
  }

  toString(): string {
    return this.toSql();
  }

  /**
   * Returns a SQL declaration of this data type.
   * e.g. 'VARCHAR(255)', 'TEXT', etc…
   */
  toSql(): string {
    // this is defiend via
    if (!this.key) {
      throw new TypeError('Expected a key property to be defined');
    }

    return this.key ?? '';
  }

  static toString() {
    return this.name;
  }

  /**
   * Override this method to emit an error or a warning if the Data Type, as it is configured, is not compatible
   * with the current dialect.
   *
   * @param _dialect The dialect using this data type.
   * @protected
   * @internal
   */
  protected _checkOptionSupport(_dialect: AbstractDialect) {}

  /**
   * Returns this DataType, using its dialect-specific subclass.
   *
   * @param dialect
   * @returns
   */
  toDialectDataType(dialect: AbstractDialect): this {
    const subClass = dialect.dataTypeOverrides.get(this.constructor as Class<AbstractDataType<any>>);

    if (!subClass) {
      this._checkOptionSupport(dialect);

      return this;
    }

    // @ts-expect-error
    const replacement = new subClass(this.options);
    replacement._checkOptionSupport(dialect);

    return replacement as this;
  }
}

export interface StringTypeOptions {
  /**
   * @default 255
   */
  length?: number | undefined;

  /**
   * @default false
   */
  binary?: boolean;
}

/**
 * STRING A variable length string
 */
export class STRING extends AbstractDataType<string | Buffer> {
  readonly key: string = 'STRING';
  readonly options: StringTypeOptions;

  constructor(length: number, binary?: boolean);
  constructor(options?: StringTypeOptions);
  // we have to define the constructor overloads using tuples due to a TypeScript limitation
  //  https://github.com/microsoft/TypeScript/issues/29732, to play nice with classToInvokable.
  /** @internal */
  constructor(...args:
    | []
    | [length: number]
    | [length: number, binary: boolean]
    | [options: StringTypeOptions]
  );
  constructor(lengthOrOptions?: number | StringTypeOptions, binary?: boolean) {
    super();

    if (isObject(lengthOrOptions)) {
      this.options = {
        length: lengthOrOptions.length ?? 255,
        binary: lengthOrOptions.binary ?? false,
      };
    } else {
      this.options = {
        length: lengthOrOptions ?? 255,
        binary: binary ?? false,
      };
    }

    Object.freeze(this.options);
  }

  toSql() {
    return joinSQLFragments([
      `VARCHAR(${this.options.length})`,
      this.options.binary && 'BINARY',
    ]);
  }

  validate(value: any): asserts value is string | Buffer {
    if (typeof value === 'string') {
      return;
    }

    if (
      (this.options.binary && Buffer.isBuffer(value))
        || typeof value === 'number'
    ) {
      return;
    }

    throw new ValidationError(
      util.format('%j is not a valid string', value),
      [],
    );
  }

  get BINARY() {
    return this._construct<typeof STRING>({
      ...this.options,
      binary: true,
    });
  }

  static get BINARY() {
    return new this({ binary: true });
  }

  escape(value: string | Buffer, options: StringifyOptions): string {
    if (Buffer.isBuffer(value)) {
      return options.dialect.escapeBuffer(value);
    }

    return options.dialect.escapeString(value);
  }
}

/**
 * CHAR A fixed length string
 */
export class CHAR extends STRING {
  readonly key = 'CHAR';

  toSql() {
    return joinSQLFragments([
      `CHAR(${this.options.length})`,
      this.options.binary && 'BINARY',
    ]);
  }
}

const validTextLengths = ['tiny', 'medium', 'long'];
export type TextLength = 'tiny' | 'medium' | 'long';

export interface TextOptions {
  length?: TextLength;
}

/**
 * Unlimited length TEXT column
 */
export class TEXT extends AbstractDataType<string> {
  readonly key = 'TEXT';
  readonly options: TextOptions;

  /**
   * @param lengthOrOptions could be tiny, medium, long.
   */
  constructor(lengthOrOptions?: TextLength | TextOptions) {
    super();

    const length = (typeof lengthOrOptions === 'object' ? lengthOrOptions.length : lengthOrOptions)?.toLowerCase();

    if (length != null && !validTextLengths.includes(length)) {
      throw new TypeError(`If specified, the "length" option must be one of: ${validTextLengths.join(', ')}`);
    }

    this.options = {
      length: length as TextLength,
    };
  }

  toSql(): string {
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

  validate(value: any): asserts value is string {
    if (typeof value !== 'string') {
      throw new ValidationError(
        util.format('%j is not a valid string', value),
        [],
      );
    }
  }
}

/**
 * An unlimited length case-insensitive text column.
 * Original case is preserved but acts case-insensitive when comparing values (such as when finding or unique constraints).
 * Only available in Postgres and SQLite.
 */
export class CITEXT extends AbstractDataType<string> {
  readonly key = 'CITEXT';

  validate(value: any): asserts value is string {
    if (typeof value !== 'string') {
      throw new ValidationError(
        util.format('%j is not a valid string', value),
        [],
      );
    }
  }
}

export interface NumberOptions {
  // TODO: it's not length + decimals if only 1 parameter is provided
  /**
   * length of type, like `INT(4)`
   */
  length?: number;

  /**
   * number of decimal points, used with length `FLOAT(5, 4)`
   */
  decimals?: number;

  /**
   * Is zero filled?
   */
  zerofill?: boolean;

  /**
   * Is unsigned?
   */
  unsigned?: boolean;
}

type AcceptedNumber =
  | number
  | bigint
  | boolean
  | string
  | null;

/**
 * Base number type which is used to build other types
 */
export class NUMBER<Options extends NumberOptions = NumberOptions> extends AbstractDataType<AcceptedNumber> {
  readonly key: string = 'NUMBER';

  readonly options: Options;

  constructor(optionsOrLength?: number | Readonly<Options>) {
    super();

    if (isObject(optionsOrLength)) {
      this.options = { ...optionsOrLength };
    } else {
      // @ts-expect-error
      this.options = { length: optionsOrLength };
    }
  }

  protected checkOptionSupport() {}

  toSql(): string {
    let result = this.key;

    if (this.options.length) {
      result += `(${this.options.length}`;
      if (typeof this.options.decimals === 'number') {
        result += `,${this.options.decimals}`;
      }

      result += ')';
    }

    if (this.options.unsigned) {
      result += ' UNSIGNED';
    }

    if (this.options.zerofill) {
      result += ' ZEROFILL';
    }

    return result;
  }

  validate(value: any): asserts value is number {
    if (!Validator.isFloat(String(value))) {
      throw new ValidationError(
        util.format(
          `%j is not a valid ${
            super.toString()
              .toLowerCase()}`,
          value,
        ),
        [],
      );
    }
  }

  escape(value: AcceptedNumber, options: StringifyOptions): string {
    return this.stringify(value, options);
  }

  stringify(number: AcceptedNumber, _options: StringifyOptions): string {
    // This should be unnecessary but since this directly returns the passed string its worth the added validation.
    this.validate(number);

    return String(number);
  }

  bindParam(value: AcceptedNumber, options: BindParamOptions): string {
    return options.bindParam(value);
  }

  get UNSIGNED(): this {
    return this._construct<typeof NUMBER>({ ...this.options, unsigned: true });
  }

  get ZEROFILL(): this {
    return this._construct<typeof NUMBER>({ ...this.options, zerofill: true });
  }

  static get UNSIGNED() {
    return new this({ unsigned: true });
  }

  static get ZEROFILL() {
    return new this({ zerofill: true });
  }
}

/**
 * A 32 bit integer
 */
export class INTEGER extends NUMBER {
  readonly key: string = 'INTEGER';

  validate(value: any) {
    if (!Validator.isInt(String(value))) {
      throw new ValidationError(
        util.format(`%j is not a valid ${this.key.toLowerCase()}`, value),
        [],
      );
    }
  }
}

/**
 * A 8 bit integer
 */
export class TINYINT extends INTEGER {
  readonly key = 'TINYINT';
}

/**
 * A 16 bit integer
 */
export class SMALLINT extends INTEGER {
  readonly key = 'SMALLINT';
}

/**
 * A 24 bit integer
 */
export class MEDIUMINT extends INTEGER {
  readonly key = 'MEDIUMINT';
}

/**
 * A 64 bit integer
 */
export class BIGINT extends INTEGER {
  readonly key = 'BIGINT';
}

/**
 * Floating point number (4-byte precision).
 */
export class FLOAT extends NUMBER {
  readonly key: string = 'FLOAT';

  constructor(options?: NumberOptions);

  // TODO: the description of length is not accurate
  //  mysql/mariadb: float(M,D) M is the total number of digits and D is the number of digits following the decimal point.
  //  postgres/mssql: float(P) is the precision
  /**
   * @param length length of type, like `FLOAT(4)`
   * @param decimals number of decimal points, used with length `FLOAT(5, 4)`
   */
  constructor(length: number, decimals?: number);
  // we have to define the constructor overloads using tuples due to a TypeScript limitation
  //  https://github.com/microsoft/TypeScript/issues/29732, to play nice with classToInvokable.
  /** @internal */
  constructor(...args: [length: number, decimals?: number] | [options?: NumberOptions]);
  constructor(length?: number | NumberOptions, decimals?: number) {
    super(typeof length === 'object' ? length : { length, decimals });
  }

  validate(value: any): asserts value is AcceptedNumber {
    if (!Validator.isFloat(String(value))) {
      throw new ValidationError(
        util.format('%j is not a valid float', value),
        [],
      );
    }
  }

  stringify(value: AcceptedNumber) {
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
}

export class REAL extends FLOAT {
  readonly key = 'REAL';
}

/**
 * Floating point number (8-byte precision).
 */
export class DOUBLE extends FLOAT {
  readonly key: string = 'DOUBLE';
}

export interface DecimalOptions extends NumberOptions {
  scale?: number;
  precision?: number;
}

/**
 * Decimal type, variable precision, take length as specified by user
 */
export class DECIMAL extends NUMBER<DecimalOptions> {
  readonly key = 'DECIMAL';

  constructor(options?: DecimalOptions);
  /**
   * @param precision defines precision
   * @param scale defines scale
   */
  constructor(precision: number, scale?: number);

  // we have to define the constructor overloads using tuples due to a TypeScript limitation
  //  https://github.com/microsoft/TypeScript/issues/29732, to play nice with classToInvokable.
  /** @internal */
  constructor(...args:
    | []
    | [precision: number]
    | [precision: number, scale: number]
    | [options: DecimalOptions]
  );
  constructor(precisionOrOptions?: number | DecimalOptions, scale?: number) {
    if (isObject(precisionOrOptions)) {
      super(precisionOrOptions);
    } else {
      super();

      this.options.precision = precisionOrOptions;
      this.options.scale = scale;
    }
  }

  toSql() {
    if (this.options.precision || this.options.scale) {
      return `DECIMAL(${[this.options.precision, this.options.scale]
        .filter(num => num != null)
        .join(',')})`;
    }

    return 'DECIMAL';
  }

  validate(value: any): asserts value is AcceptedNumber {
    if (!Validator.isDecimal(String(value))) {
      throw new ValidationError(
        util.format('%j is not a valid decimal', value),
        [],
      );
    }
  }
}

/**
 * A boolean / tinyint column, depending on dialect
 */
export class BOOLEAN extends AbstractDataType<boolean | Falsy> {
  readonly key = 'BOOLEAN';

  toSql() {
    // Note: This may vary depending on the dialect.
    return 'TINYINT(1)';
  }

  validate(value: any): asserts value is boolean {
    if (!Validator.isBoolean(String(value))) {
      throw new ValidationError(
        util.format('%j is not a valid boolean', value),
        [],
      );
    }
  }

  sanitize(value: unknown): boolean | null {
    return BOOLEAN.parse(value);
  }

  escape(value: boolean | Falsy): string {
    return this.stringify(value);
  }

  stringify(value: boolean | Falsy): string {
    return value ? 'true' : 'false';
  }

  static parse(value: unknown): boolean {
    if (Buffer.isBuffer(value) && value.length === 1) {
      // Bit fields are returned as buffers
      value = value[0];
    }

    const type = typeof value;
    if (type === 'boolean') {
      return value as boolean;
    }

    if (type === 'string') {
      // Only take action on valid boolean strings.
      if (value === 'true' || value === '1' || value === 't') {
        return true;
      }

      if (value === 'false' || value === '0' || value === 'f') {
        return false;
      }

      // Only take action on valid boolean integers.
    } else if (typeof value === 'number') {
      if (value === 1) {
        return true;
      }

      if (value === 0) {
        return false;
      }
    } else if (typeof value === 'bigint') {
      if (value === 1n) {
        return true;
      }

      if (value === 0n) {
        return false;
      }
    }

    throw new Error(`Valid cannot be parsed as boolean: ${value}`);
  }
}

/**
 * A time column
 */
export class TIME extends AbstractDataType<Date | string | number> {
  readonly key = 'TIME';

  toSql() {
    return 'TIME';
  }
}

export interface DateOptions {
  /**
   * The precision of the date.
   */
  length?: string | number;
}

type RawDate = Date | string | number;
export type AcceptedDate = RawDate | moment.Moment | number;

/**
 * A date and time.
 */
export class DATE extends AbstractDataType<AcceptedDate> {
  readonly key: string = 'DATE';
  readonly options: DateOptions;

  /**
   * @param lengthOrOptions precision to allow storing milliseconds
   */
  constructor(lengthOrOptions?: number | DateOptions) {
    super();

    this.options = {
      length: typeof lengthOrOptions === 'object' ? lengthOrOptions.length : lengthOrOptions,
    };
  }

  toSql() {
    return 'DATETIME';
  }

  validate(value: any) {
    if (!Validator.isDate(String(value))) {
      throw new ValidationError(
        util.format('%j is not a valid date', value),
        [],
      );
    }
  }

  sanitize(value: unknown, options?: { raw?: boolean }): unknown {
    if (options?.raw) {
      return value;
    }

    if (value instanceof Date) {
      return value;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      return new Date(value);
    }

    throw new TypeError(`${value} cannot be converted to a date`);
  }

  areValuesEqual(
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
      return true;
    }

    // not changed when set to same empty value
    if (!originalValue && !value && originalValue === value) {
      return true;
    }

    return false;
  }

  private _applyTimezone(date: AcceptedDate, options: { timezone?: string }) {
    if (options.timezone) {
      if (momentTz.tz.zone(options.timezone)) {
        return momentTz(date).tz(options.timezone);
      }

      return moment(date).utcOffset(options.timezone);
    }

    return momentTz(date);
  }

  stringify(
    date: AcceptedDate,
    options: StringifyOptions,
  ) {
    if (!moment.isMoment(date)) {
      date = this._applyTimezone(date, options);
    }

    return date.format('YYYY-MM-DD HH:mm:ss.SSS Z');
  }
}

/**
 * A date only column (no timestamp)
 */
export class DATEONLY extends AbstractDataType<AcceptedDate> {
  readonly key = 'DATEONLY';

  toSql() {
    return 'DATE';
  }

  stringify(date: AcceptedDate, _options: StringifyOptions) {
    return moment(date).format('YYYY-MM-DD');
  }

  sanitize(value: unknown, options?: { raw?: boolean }): unknown {
    if (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date)) {
      throw new TypeError(`${value} cannot be normalized into a DateOnly string.`);
    }

    if (!options?.raw && value) {
      return moment(value).format('YYYY-MM-DD');
    }

    return value;
  }

  areValuesEqual(value: AcceptedDate, originalValue: AcceptedDate): boolean {
    if (originalValue && Boolean(value) && originalValue === value) {
      return true;
    }

    // not changed when set to same empty value
    if (!originalValue && !value && originalValue === value) {
      return true;
    }

    return false;
  }
}

/**
 * A key / value store column. Only available in Postgres.
 */
export class HSTORE extends AbstractDataType<HstoreRecord> {
  readonly key = 'HSTORE';

  validate(value: any) {
    if (!isPlainObject(value)) {
      throw new ValidationError(
        util.format('%j is not a valid hstore, it must be a plain object', value),
        [],
      );
    }
  }
}

/**
 * A JSON string column. Available in MySQL, Postgres and SQLite
 */
export class JSON extends AbstractDataType<any> {
  readonly key: string = 'JSON';

  stringify(value: any): string {
    return globalThis.JSON.stringify(value);
  }
}

/**
 * A binary storage JSON column. Only available in Postgres.
 */
export class JSONB extends JSON {
  readonly key = 'JSONB';
}

/**
 * A default value of the current timestamp.  Not a valid type.
 */
// TODO: this should not be a DataType. Replace with a new version of `fn` that is dialect-aware.
export class NOW extends AbstractDataType<never> {
  readonly key = 'NOW';
}

export type AcceptedBlob = Buffer | string;

export type BlobLength = 'tiny' | 'medium' | 'long';

export interface BlobOptions {
  // TODO: must also allow BLOB(255), BLOB(16M) in db2/ibmi
  length?: BlobLength;
}

/**
 * Binary storage
 */
export class BLOB extends AbstractDataType<AcceptedBlob> {
  readonly key = 'BLOB';
  readonly options: BlobOptions;

  /**
   * @param lengthOrOptions could be tiny, medium, long.
   */
  constructor(lengthOrOptions?: BlobLength | BlobOptions) {
    super();

    // TODO: valide input (tiny, medium, long, number, 16M, 2G, etc)

    this.options = {
      length: typeof lengthOrOptions === 'object' ? lengthOrOptions.length : lengthOrOptions,
    };
  }

  toSql(): string {
    switch (this.options.length) {
      case 'tiny':
        return 'TINYBLOB';
      case 'medium':
        return 'MEDIUMBLOB';
      case 'long':
        return 'LONGBLOB';
      default:
        return this.key;
    }
  }

  validate(value: any) {
    if (typeof value !== 'string' && !Buffer.isBuffer(value)) {
      throw new ValidationError(
        util.format('%j is not a valid blob', value),
        [],
      );
    }
  }

  escape(value: string | Buffer, options: StringifyOptions) {
    const buf = typeof value === 'string' ? Buffer.from(value, 'binary') : value;

    return options.dialect.escapeBuffer(buf);
  }

  bindParam(value: AcceptedBlob, options: BindParamOptions) {
    return options.bindParam(value);
  }
}

export interface RangeOptions {
  subtype?: DataTypeClassOrInstance;
}

/**
 * Range types are data types representing a range of values of some element type (called the range's subtype).
 * Only available in Postgres. See [the Postgres documentation](http://www.postgresql.org/docs/9.4/static/rangetypes.html) for more details
 */
export class RANGE<T extends NUMBER | DATE | DATEONLY = INTEGER> extends AbstractDataType<
  Rangable<AcceptableTypeOf<T>> | AcceptableTypeOf<T>
> {
  readonly key = 'RANGE';
  readonly options: {
    subtype: AbstractDataType<any>,
  };

  /**
   * @param subtypeOrOptions A subtype for range, like RANGE(DATE)
   */
  constructor(subtypeOrOptions: DataTypeClassOrInstance | RangeOptions) {
    super();

    const subtypeRaw = (isDataType(subtypeOrOptions) ? subtypeOrOptions : subtypeOrOptions.subtype)
      ?? new INTEGER();

    const subtype: DataTypeInstance = isDataTypeClass(subtypeRaw)
      ? new subtypeRaw()
      : subtypeRaw;

    this.options = {
      subtype,
    };
  }

  validate(value: any) {
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
  }
}

/**
 * A column storing a unique universal identifier.
 * Use with `UUIDV1` or `UUIDV4` for default values.
 */
export class UUID extends AbstractDataType<string> {
  readonly key = 'UUID';

  validate(value: any) {
    if (typeof value !== 'string' || !Validator.isUUID(value)) {
      throw new ValidationError(
        util.format('%j is not a valid uuid', value),
        [],
      );
    }
  }
}

/**
 * A default unique universal identifier generated following the UUID v1 standard
 */
export class UUIDV1 extends AbstractDataType<string> {
  readonly key = 'UUIDV1';

  validate(value: any) {
    // @ts-expect-error -- the typings for isUUID are missing '1' as a valid uuid version, but its implementation does accept it
    if (typeof value !== 'string' || !Validator.isUUID(value, 1)) {
      throw new ValidationError(
        util.format('%j is not a valid uuidv1', value),
        [],
      );
    }
  }
}

/**
 * A default unique universal identifier generated following the UUID v4 standard
 */
export class UUIDV4 extends AbstractDataType<string> {
  readonly key = 'UUIDV4';

  validate(value: unknown) {
    if (typeof value !== 'string' || !Validator.isUUID(value, 4)) {
      throw new ValidationError(
        util.format('%j is not a valid uuidv4', value),
        [],
      );
    }
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
export class VIRTUAL<T> extends AbstractDataType<T> {
  readonly key = 'VIRTUAL';

  returnType?: AbstractDataType<T>;
  fields?: string[];

  /**
   * @param [ReturnType] return type for virtual type
   * @param [fields] array of fields this virtual type is dependent on
   */
  constructor(ReturnType?: DataTypeClassOrInstance, fields?: string[]) {
    super();
    if (typeof ReturnType === 'function') {
      ReturnType = new ReturnType();
    }

    this.returnType = ReturnType;
    this.fields = fields;
  }
}

export interface EnumOptions<Member extends string> {
  values: Member[];
}

/**
 * An enumeration, Postgres Only
 *
 * @example
 * DataTypes.ENUM('value', 'another value')
 * DataTypes.ENUM(['value', 'another value'])
 * DataTypes.ENUM({
 *   values: ['value', 'another value']
 * });
 */
export class ENUM<Member extends string> extends AbstractDataType<Member> {
  readonly key = 'ENUM';
  readonly options: EnumOptions<Member>;

  /**
   * @param options either array of values or options object with values array. It also supports variadic values.
   */
  constructor(options: EnumOptions<Member>);
  constructor(members: Member[]);
  constructor(...members: Member[]);
  // we have to define the constructor overloads using tuples due to a TypeScript limitation
  //  https://github.com/microsoft/TypeScript/issues/29732, to play nice with classToInvokable.
  /** @internal */
  constructor(...args:
    | [options: EnumOptions<Member>]
    | [members: Member[]]
    | [...members: Member[]]
  );
  constructor(...args: [Member[] | Member | EnumOptions<Member>, ...Member[]]) {
    super();

    let values: Member[];
    if (isObject(args[0])) {
      if (args.length > 1) {
        throw new TypeError('DataTypes.ENUM has been constructed incorrectly: Its first parameter is the option bag or the array of values, but more than one parameter has been provided.');
      }

      if (Array.isArray(args[0])) {
        values = args[0];
      } else {
        values = args[0].values;
      }
    } else {
      // @ts-expect-error -- we'll assert in the next line whether this is the right type
      values = args;
    }

    if (values.length === 0) {
      throw new TypeError('DataTypes.ENUM cannot be used without specifying its possible enum values.');
    }

    for (const value of values) {
      if (typeof value !== 'string') {
        throw new TypeError(`One of the possible values passed to DataTypes.ENUM (${String(value)}) is not a string. Only strings can be used as enum values.`);
      }
    }

    this.options = {
      values,
    };
  }

  validate(value: any): asserts value is Member {
    if (!this.options.values.includes(value)) {
      throw new ValidationError(
        util.format('%j is not a valid choice in %j', value, this.options.values),
        [],
      );
    }
  }
}

export interface ArrayOptions {
  type: DataTypeClassOrInstance;
}

interface NormalizedArrayOptions {
  type: AbstractDataType<any>;
}

/**
 * An array of `type`. Only available in Postgres.
 *
 * @example
 * DataTypes.ARRAY(DataTypes.DECIMAL)
 */
export class ARRAY<T extends AbstractDataType<any>> extends AbstractDataType<Array<AcceptableTypeOf<T>>> {
  readonly key = 'ARRAY';
  readonly options: NormalizedArrayOptions;

  /**
   * @param typeOrOptions type of array values
   */
  constructor(typeOrOptions: DataTypeClassOrInstance | ArrayOptions) {
    super();

    const rawType = isDataType(typeOrOptions) ? typeOrOptions : typeOrOptions?.type;

    if (!rawType) {
      throw new TypeError('DataTypes.ARRAY is missing type definition for its values.');
    }

    this.options = {
      type: typeof rawType === 'function' ? new rawType() : rawType,
    };
  }

  toSql() {
    return `${this.options.type.toSql()}[]`;
  }

  validate(value: any) {
    if (!Array.isArray(value)) {
      throw new ValidationError(
        util.format('%j is not a valid array', value),
        [],
      );
    }

    // TODO: validate individual items
  }

  toDialectDataType(dialect: AbstractDialect): this {
    const replacement = super.toDialectDataType(dialect);

    if (replacement === this) {
      return this;
    }

    replacement.options.type = replacement.options.type.toDialectDataType(dialect);

    return replacement;
  }

  static is<T extends AbstractDataType<any>>(
    obj: unknown,
    type: new () => T,
  ): obj is ARRAY<T> {
    return obj instanceof ARRAY && (obj).options.type instanceof type;
  }
}

export type GeometryType = 'Point' | 'LineString' | 'Polygon' | 'MultiPoint' | 'MultiLineString' | 'MultiPolygon' | 'GeometryCollection';
export type GeoJSON = {
  type: GeometryType,
};

export interface GeometryOptions {
  type?: GeometryType;
  srid?: number;
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
export class GEOMETRY extends AbstractDataType<GeoJSON> {
  readonly key: string = 'GEOMETRY';
  readonly options: GeometryOptions;

  /**
   * @param {string} [type] Type of geometry data
   * @param {string} [srid] SRID of type
   */
  constructor(type: GeometryType, srid?: number);
  constructor(options: GeometryOptions);

  // we have to define the constructor overloads using tuples due to a TypeScript limitation
  //  https://github.com/microsoft/TypeScript/issues/29732, to play nice with classToInvokable.
  /** @internal */
  constructor(...args:
    | [type: GeometryType, srid?: number]
    | [options: GeometryOptions]
  );

  constructor(typeOrOptions: GeometryType | GeometryOptions, srid?: number) {
    super();

    this.options = isObject(typeOrOptions)
      ? { ...typeOrOptions }
      : { type: typeOrOptions, srid };
  }

  stringify(value: GeoJSON, options: StringifyOptions) {
    return `STGeomFromText(${options.escape(
      wkx.Geometry.parseGeoJSON(value).toWkt(),
    )})`;
  }

  bindParam(value: GeoJSON, options: BindParamOptions) {
    return `STGeomFromText(${options.bindParam(
      wkx.Geometry.parseGeoJSON(value).toWkt(),
    )})`;
  }
}

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
export class GEOGRAPHY extends GEOMETRY {
  readonly key = 'GEOGRAPHY';
}

/**
 * The cidr type holds an IPv4 or IPv6 network specification. Takes 7 or 19 bytes.
 *
 * Only available for Postgres
 */
export class CIDR extends AbstractDataType<string> {
  readonly key = 'CIDR';

  validate(value: any) {
    if (typeof value !== 'string' || !Validator.isIPRange(value)) {
      throw new ValidationError(
        util.format('%j is not a valid CIDR', value),
        [],
      );
    }
  }
}

/**
 * The INET type holds an IPv4 or IPv6 host address, and optionally its subnet. Takes 7 or 19 bytes
 *
 * Only available for Postgres
 */
export class INET extends AbstractDataType<string> {
  readonly key = 'INET';
  validate(value: any) {
    if (typeof value !== 'string' || !Validator.isIP(value)) {
      throw new ValidationError(
        util.format('%j is not a valid INET', value),
        [],
      );
    }
  }
}

/**
 * The MACADDR type stores MAC addresses. Takes 6 bytes
 *
 * Only available for Postgres
 */
export class MACADDR extends AbstractDataType<string> {
  readonly key = 'MACADDR';

  validate(value: any) {
    if (typeof value !== 'string' || !Validator.isMACAddress(value)) {
      throw new ValidationError(
        util.format('%j is not a valid MACADDR', value),
        [],
      );
    }
  }
}

/**
 * The TSVECTOR type stores text search vectors.
 *
 * Only available for Postgres
 */
export class TSVECTOR extends AbstractDataType<string> {
  readonly key = 'TSVECTOR';

  validate(value: any) {
    if (typeof value !== 'string') {
      throw new ValidationError(
        util.format('%j is not a valid string', value),
        [],
      );
    }
  }
}
