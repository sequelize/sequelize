import {
  EMPTY_ARRAY,
  isPlainObject,
  isString,
  parseBigInt,
  parseSafeInteger,
} from '@sequelize/utils';
import dayjs from 'dayjs';
import isEqual from 'lodash/isEqual';
import isObject from 'lodash/isObject';
import { Blob } from 'node:buffer';
import util from 'node:util';
import type { Class } from 'type-fest';
import { ValidationErrorItem } from '../errors';
import type { GeoJson, GeoJsonType } from '../geo-json.js';
import { assertIsGeoJson } from '../geo-json.js';
import type { ModelStatic, Rangable, RangePart } from '../model.js';
import type { Sequelize } from '../sequelize.js';
import { makeBufferFromTypedArray } from '../utils/buffer.js';
import { isValidTimeZone } from '../utils/dayjs.js';
import { doNotUseRealDataType } from '../utils/deprecations.js';
import { joinSQLFragments } from '../utils/join-sql-fragments';
import { validator as Validator } from '../utils/validator-extras';
import {
  attributeTypeToSql,
  dataTypeClassOrInstanceToInstance,
  isDataType,
  isDataTypeClass,
  throwUnsupportedDataType,
} from './data-types-utils.js';
import type { AbstractDialect } from './dialect.js';
import type { TableNameWithSchema } from './query-interface.js';

// TODO: try merging "validate" & "sanitize" by making sanitize coerces the type, and if it cannot, throw a ValidationError.
//       right now, they share a lot of the same logic.

// legacy support
let Moment: any;
try {
  Moment = require('moment');
} catch {
  /* ignore */
}

function isMoment(value: any): boolean {
  return Moment?.isMoment(value) ?? false;
}

// If T is a constructor, returns the type of what `new T()` would return,
// otherwise, returns T
export type Constructed<T> = T extends abstract new () => infer Instance ? Instance : T;

export type AcceptableTypeOf<T extends DataType> =
  Constructed<T> extends AbstractDataType<infer Acceptable> ? Acceptable : never;

export type DataTypeInstance = AbstractDataType<any>;
export type DataTypeClass = Class<AbstractDataType<any>>;

export type DataTypeClassOrInstance = DataTypeInstance | DataTypeClass;

export type DataType = string | DataTypeClassOrInstance;

export type NormalizedDataType = string | DataTypeInstance;

export interface BindParamOptions {
  bindParam(value: unknown): string;
}

export type DataTypeUseContext =
  | { model: ModelStatic; attributeName: string; sequelize: Sequelize }
  | { tableName: TableNameWithSchema; columnName: string; sequelize: Sequelize };

/**
 * A symbol that can be used as the key for a static property on a DataType class to uniquely identify it.
 */
export const DataTypeIdentifier = Symbol('DataTypeIdentifier');

/**
 * @category DataTypes
 */
export abstract class AbstractDataType<
  /** The type of value we'll accept - ie for a column of this type, we'll accept this value as user input. */
  AcceptedType,
> {
  /**
   * This property is designed to uniquely identify the DataType.
   * Do not change this value in implementation-specific dialects, or they will not be mapped to their parent DataType properly!
   *
   * @hidden
   */
  declare static readonly [DataTypeIdentifier]: string;

  static getDataTypeId(): string {
    return this[DataTypeIdentifier];
  }

  getDataTypeId(): string {
    // @ts-expect-error -- untyped constructor
    return this.constructor.getDataTypeId();
  }

  /**
   * Where this DataType is being used.
   */
  usageContext: DataTypeUseContext | undefined;
  #dialect: AbstractDialect | undefined;

  protected _getDialect(): AbstractDialect {
    if (!this.#dialect) {
      throw new Error('toDialectDataType has not yet been called on this DataType');
    }

    return this.#dialect;
  }

  // TODO: Remove in v8
  /**
   * @hidden
   */
  static get escape() {
    throw new Error(
      'The "escape" static property has been removed. Each DataType is responsible for escaping its value correctly.',
    );
  }

  // TODO: Remove in v8
  /**
   * @hidden
   */
  static get types() {
    throw new Error('The "types" static property has been removed. Use getDataTypeDialectMeta.');
  }

  // TODO: Remove in v8
  /**
   * @hidden
   */
  static get key() {
    throw new Error('The "key" static property has been removed.');
  }

  // TODO: Remove in v8
  /**
   * @hidden
   */
  get types() {
    throw new Error('The "types" instance property has been removed.');
  }

  // TODO: Remove in v8
  /**
   * @hidden
   */
  get key() {
    throw new Error('The "key" instance property has been removed.');
  }

  // TODO: move to utils?
  protected _construct<Constructor extends abstract new () => AbstractDataType<any>>(
    ...args: ConstructorParameters<Constructor>
  ): this {
    const constructor = this.constructor as new (
      ..._args: ConstructorParameters<Constructor>
    ) => this;

    return new constructor(...args);
  }

  areValuesEqual(value: AcceptedType, originalValue: AcceptedType): boolean {
    return isEqual(value, originalValue);
  }

  /**
   * Whether this DataType wishes to handle NULL values itself.
   * This is almost exclusively used by {@link JSON} and {@link JSONB} which serialize `null` as the JSON string `'null'`.
   */
  acceptsNull(): boolean {
    return false;
  }

  /**
   * Called when a value is retrieved from the Database, and its DataType is specified.
   * Used to normalize values from the database.
   *
   * Note: It is also possible to do an initial parsing of a Database value using {@link AbstractDialect#registerDataTypeParser}.
   * That normalization uses the type ID from the database instead of a Sequelize Data Type to determine which parser to use,
   * and is called before this method.
   *
   * @param value The value to parse.
   */
  parseDatabaseValue(value: unknown): unknown {
    return value as AcceptedType;
  }

  /**
   * Used to normalize a value when {@link Model#set} is called.
   * That is, when a user sets a value on a Model instance.
   *
   * @param value
   */
  sanitize(value: unknown): unknown {
    return value;
  }

  /**
   * Checks whether the JS value is compatible with (or can be converted to) the SQL data type.
   * Throws if that is not the case.
   *
   * @param value
   */
  validate(value: any): asserts value is AcceptedType {}

  /**
   * Escapes a value for the purposes of inlining it in a SQL query.
   * The resulting value will be inlined as-is with no further escaping.
   *
   * @param value The value to escape.
   */
  escape(value: AcceptedType): string {
    const asBindValue = this.toBindableValue(value);

    if (!isString(asBindValue)) {
      throw new Error(
        `${this.constructor.name}#stringify has been overridden to return a non-string value, so ${this.constructor.name}#escape must be implemented to handle that value correctly.`,
      );
    }

    return this._getDialect().escapeString(asBindValue);
  }

  /**
   * This method is called when {@link AbstractQueryGenerator} needs to add a bind parameter to a query it is building.
   * This method allows for customizing both the SQL to add to the query, and convert the bind parameter value to a DB-compatible value.
   *
   * If you only need to prepare the bind param value, implement {@link toBindableValue} instead.
   *
   * This method must return the SQL to add to the query. You can obtain a bind parameter ID by calling {@link BindParamOptions#bindParam}
   * with the value associated to that bind parameter.
   *
   * An example of a data type that requires customizing the SQL is the {@link GEOMETRY} data type.
   *
   * @param value The value to bind.
   * @param options Options.
   */
  getBindParamSql(value: AcceptedType, options: BindParamOptions): string {
    // TODO: rename "options.bindParam" to "options.collectBindParam"
    return options.bindParam(this.toBindableValue(value));
  }

  /**
   * Converts a JS value to a value compatible with the connector library for this Data Type.
   * Unlike {@link escape}, this value does not need to be escaped. It is passed separately to the database, which
   * will handle escaping.
   *
   * @param value The value to convert.
   */
  toBindableValue(value: AcceptedType): unknown {
    return String(value);
  }

  toString(): string {
    try {
      return this.toSql();
    } catch {
      // best effort introspection (dialect may not be available)
      return this.constructor.toString();
    }
  }

  static toString() {
    return this.name;
  }

  /**
   * Returns a SQL declaration of this data type.
   * e.g. 'VARCHAR(255)', 'TEXT', etc…
   */
  abstract toSql(): string;

  /**
   * Override this method to emit an error or a warning if the Data Type, as it is configured, is not compatible
   * with the current dialect.
   *
   * @param dialect The dialect using this data type.
   */
  protected _checkOptionSupport(dialect: AbstractDialect) {
    // use "dialect.supports" to determine base support for this DataType.
    assertDataTypeSupported(dialect, this);
  }

  belongsToDialect(dialect: AbstractDialect): boolean {
    return this.#dialect === dialect;
  }

  /**
   * Returns this DataType, using its dialect-specific subclass.
   *
   * @param dialect
   */
  toDialectDataType(dialect: AbstractDialect): this {
    // This DataType has already been converted to a dialect-specific DataType.
    if (this.#dialect === dialect) {
      return this;
    }

    const DataTypeClass = this.constructor as Class<AbstractDataType<any>>;
    // get dialect-specific implementation
    const subClass = dialect.getDataTypeForDialect(DataTypeClass);

    const replacement: this =
      !subClass || subClass === DataTypeClass
        ? // optimisation: re-use instance if it doesn't belong to any dialect yet.
          this.#dialect == null
          ? this
          : this.clone()
        : // there is a convention that all DataTypes must accept a single "options" parameter as one of their signatures, but it's impossible to enforce in typing
          // @ts-expect-error -- see ^
          (new subClass(this.options) as this);

    replacement.#dialect = dialect;
    replacement._checkOptionSupport(dialect);
    if (this.usageContext) {
      replacement.attachUsageContext(this.usageContext);
    }

    return replacement;
  }

  /**
   * Returns a copy of this DataType, without usage context.
   * Designed to re-use a DataType on another Model.
   */
  clone(): this {
    // there is a convention that all DataTypes must accept a single "options" parameter as one of their signatures, but it's impossible to enforce in typing
    // @ts-expect-error -- see ^
    return this._construct(this.options);
  }

  withUsageContext(usageContext: DataTypeUseContext): this {
    const out = this.clone().attachUsageContext(usageContext);

    if (this.#dialect) {
      out.#dialect = this.#dialect;
    }

    return out;
  }

  /**
   * @param usageContext
   * @private
   */
  attachUsageContext(usageContext: DataTypeUseContext): this {
    if (this.usageContext && !isEqual(this.usageContext, usageContext)) {
      throw new Error(
        `This DataType is already attached to ${printContext(this.usageContext)}, and therefore cannot be attached to ${printContext(usageContext)}.`,
      );
    }

    this.usageContext = Object.freeze(usageContext);

    return this;
  }
}

function printContext(usageContext: DataTypeUseContext): string {
  if ('model' in usageContext) {
    return `attribute ${usageContext.model.name}#${usageContext.attributeName}`;
  }

  return `column "${usageContext.tableName}"."${usageContext.columnName}"`;
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
 * Represents a variable length string type.
 *
 * __Fallback policy:__
 * - If the 'length' option is not supported by the dialect, a CHECK constraint will be added to ensure
 * the value remains within the specified length.
 * - If the 'binary' option is not supported by the dialect, a suitable binary type will be used instead.
 *   If none is available, an error will be raised instead.
 *
 * @example
 * ```ts
 * DataTypes.STRING(255)
 * ```
 *
 * @category DataTypes
 */
export class STRING extends AbstractDataType<string | Buffer> {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'STRING';
  readonly options: StringTypeOptions;

  constructor(length: number, binary?: boolean);
  constructor(options?: StringTypeOptions);
  // we have to define the constructor overloads using tuples due to a TypeScript limitation
  //  https://github.com/microsoft/TypeScript/issues/29732, to play nice with classToInvokable.
  /** @hidden */
  constructor(
    ...args:
      | []
      | [length: number]
      | [length: number, binary: boolean]
      | [options: StringTypeOptions]
  );

  constructor(lengthOrOptions?: number | StringTypeOptions, binary?: boolean) {
    super();

    if (isObject(lengthOrOptions)) {
      this.options = {
        length: lengthOrOptions.length,
        binary: lengthOrOptions.binary ?? false,
      };
    } else {
      this.options = {
        length: lengthOrOptions,
        binary: binary ?? false,
      };
    }
  }

  protected _checkOptionSupport(dialect: AbstractDialect) {
    if (!dialect.supports.dataTypes.COLLATE_BINARY && this.options.binary) {
      throwUnsupportedDataType(dialect, 'STRING.BINARY');
    }
  }

  toSql(): string {
    // TODO: STRING should use an unlimited length type by default - https://github.com/sequelize/sequelize/issues/14259
    return joinSQLFragments([
      `VARCHAR(${this.options.length ?? 255})`,
      this.options.binary ? 'BINARY' : '',
    ]);
  }

  validate(value: any): asserts value is string | Buffer {
    if (typeof value === 'string') {
      return;
    }

    if (!this.options.binary) {
      ValidationErrorItem.throwDataTypeValidationError(
        `${util.inspect(value)} is not a valid string. Only the string type is accepted for non-binary strings.`,
      );
    }

    rejectBlobs(value);

    if (Buffer.isBuffer(value)) {
      return;
    }

    if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
      return;
    }

    ValidationErrorItem.throwDataTypeValidationError(
      `${util.inspect(value)} is not a valid binary value: Only strings, Buffer, Uint8Array and ArrayBuffer are supported.`,
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

  escape(value: string | Buffer): string {
    if (Buffer.isBuffer(value)) {
      return this._getDialect().escapeBuffer(value);
    }

    return this._getDialect().escapeString(value);
  }

  toBindableValue(value: string | Buffer): unknown {
    return this.sanitize(value);
  }
}

/**
 * Represents a fixed length string type.
 *
 * __Fallback policy:__
 * - If this DataType is not supported, an error will be raised.
 *
 * @example
 * ```ts
 * DataTypes.CHAR(1000)
 * ```
 *
 * @category DataTypes
 */
export class CHAR extends STRING {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'CHAR';

  protected _checkOptionSupport(dialect: AbstractDialect) {
    if (!dialect.supports.dataTypes.CHAR) {
      throwUnsupportedDataType(dialect, 'CHAR');
    }

    if (!dialect.supports.dataTypes.COLLATE_BINARY && this.options.binary) {
      throwUnsupportedDataType(dialect, 'CHAR.BINARY');
    }
  }

  toSql() {
    return joinSQLFragments([
      `CHAR(${this.options.length ?? 255})`,
      this.options.binary ? 'BINARY' : '',
    ]);
  }
}

const validTextLengths = ['tiny', 'medium', 'long'];
export type TextLength = 'tiny' | 'medium' | 'long';

export interface TextOptions {
  length?: TextLength | undefined;
}

/**
 * Represents an unlimited length string type.
 *
 * @example
 * ```ts
 * DataTypes.TEXT('tiny') // TINYTEXT
 * ```
 *
 * @category DataTypes
 */
export class TEXT extends AbstractDataType<string> {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'TEXT';
  readonly options: TextOptions;

  /**
   * @param lengthOrOptions could be tiny, medium, long.
   */
  constructor(lengthOrOptions?: TextLength | TextOptions) {
    super();

    const length = (
      typeof lengthOrOptions === 'object' ? lengthOrOptions.length : lengthOrOptions
    )?.toLowerCase();

    if (length != null && !validTextLengths.includes(length)) {
      throw new TypeError(
        `If specified, the "length" option must be one of: ${validTextLengths.join(', ')}`,
      );
    }

    this.options = {
      length: length as TextLength,
    };
  }

  toSql(): string {
    switch (this.options.length) {
      case 'tiny':
        return 'TINYTEXT';
      case 'medium':
        return 'MEDIUMTEXT';
      case 'long':
        return 'LONGTEXT';
      default:
        return 'TEXT';
    }
  }

  validate(value: any): asserts value is string {
    if (typeof value !== 'string') {
      ValidationErrorItem.throwDataTypeValidationError(
        util.format('%s is not a valid string', value),
      );
    }
  }
}

/**
 * An unlimited length case-insensitive text column.
 * Original case is preserved but acts case-insensitive when comparing values (such as when finding or unique constraints).
 * Only available in Postgres and SQLite.
 *
 * __Fallback policy:__
 * - If this DataType is not supported, and no case-insensitive text alternative exists, an error will be raised.
 *
 * @example
 * ```ts
 * DataTypes.CITEXT
 * ```
 *
 * @category DataTypes
 */
export class CITEXT extends AbstractDataType<string> {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'CITEXT';

  toSql(): string {
    return 'CITEXT';
  }

  protected _checkOptionSupport(dialect: AbstractDialect) {
    if (!dialect.supports.dataTypes.CITEXT) {
      throwUnsupportedDataType(dialect, 'case-insensitive text (CITEXT)');
    }
  }

  validate(value: any): asserts value is string {
    if (typeof value !== 'string') {
      ValidationErrorItem.throwDataTypeValidationError(
        util.format('%s is not a valid string', value),
      );
    }
  }
}

export interface NumberOptions {
  /**
   * Pad the value with zeros to the specified length.
   *
   * Currently useless for types that are returned as JS BigInts or JS Numbers.
   */
  // TODO: When a number is 0-filled, return it as a string instead of number or bigint
  zerofill?: boolean | undefined;

  /**
   * Is unsigned?
   */
  unsigned?: boolean | undefined;
}

export interface IntegerOptions extends NumberOptions {
  /**
   * In MariaDB: When specified, and {@link zerofill} is set, the returned value will be padded with zeros to the specified length.
   * In MySQL: This option is ignored.
   * This option is supported in no other dialect.
   * Currently useless for types that are returned as JS BigInts or JS Numbers.
   */
  length?: number;
}

export interface DecimalNumberOptions extends NumberOptions {
  /**
   * Total number of digits.
   *
   * {@link DecimalNumberOptions#scale} must be specified if precision is specified.
   */
  precision?: number | undefined;

  /**
   * Count of decimal digits in the fractional part.
   *
   * {@link DecimalNumberOptions#precision} must be specified if scale is specified.
   */
  scale?: number | undefined;
}

type AcceptedNumber = number | bigint | boolean | string | null;

/**
 * Base number type which is used to build other types
 */
export class BaseNumberDataType<
  Options extends NumberOptions = NumberOptions,
> extends AbstractDataType<AcceptedNumber> {
  readonly options: Options;

  constructor(options?: Options) {
    super();

    // @ts-expect-error -- "options" is always optional, but we can't tell TypeScript that all properties of the object must be optional
    this.options = { ...options };
  }

  protected getNumberSqlTypeName(): string {
    throw new Error(`getNumberSqlTypeName has not been implemented in ${this.constructor.name}`);
  }

  toSql(): string {
    let result: string = this.getNumberSqlTypeName();

    if (this.options.unsigned && this._supportsNativeUnsigned(this._getDialect())) {
      result += ' UNSIGNED';
    }

    if (this.options.zerofill) {
      result += ' ZEROFILL';
    }

    return result;
  }

  protected _supportsNativeUnsigned(_dialect: AbstractDialect) {
    return false;
  }

  validate(value: any): asserts value is number {
    if (typeof value === 'number' && Number.isInteger(value) && !Number.isSafeInteger(value)) {
      ValidationErrorItem.throwDataTypeValidationError(
        util.format(
          `${this.constructor.name} received an integer % that is not a safely represented using the JavaScript number type. Use a JavaScript bigint or a string instead.`,
          value,
        ),
      );
    }

    if (!Validator.isFloat(String(value))) {
      ValidationErrorItem.throwDataTypeValidationError(
        `${util.inspect(value)} is not a valid ${this.toString().toLowerCase()}`,
      );
    }
  }

  escape(value: AcceptedNumber): string {
    return String(this.toBindableValue(value));
  }

  toBindableValue(num: AcceptedNumber): string | number {
    // This should be unnecessary but since this directly returns the passed string its worth the added validation.
    this.validate(num);

    if (Number.isNaN(num)) {
      return 'NaN';
    }

    if (num === Number.NEGATIVE_INFINITY || num === Number.POSITIVE_INFINITY) {
      const sign = num < 0 ? '-' : '';

      return `${sign}Infinity`;
    }

    return num;
  }

  getBindParamSql(value: AcceptedNumber, options: BindParamOptions): string {
    return options.bindParam(value);
  }

  get UNSIGNED(): this {
    return this._construct<typeof BaseNumberDataType>({ ...this.options, unsigned: true });
  }

  get ZEROFILL(): this {
    return this._construct<typeof BaseNumberDataType>({ ...this.options, zerofill: true });
  }

  static get UNSIGNED() {
    return new this({ unsigned: true });
  }

  static get ZEROFILL() {
    return new this({ zerofill: true });
  }
}

export class BaseIntegerDataType extends BaseNumberDataType<IntegerOptions> {
  constructor(optionsOrLength?: number | Readonly<IntegerOptions>) {
    if (typeof optionsOrLength === 'number') {
      super({ length: optionsOrLength });
    } else {
      super(optionsOrLength ?? {});
    }
  }

  validate(value: unknown) {
    super.validate(value);

    if (typeof value === 'number' && !Number.isInteger(value)) {
      ValidationErrorItem.throwDataTypeValidationError(
        `${util.inspect(value)} is not a valid ${this.toString().toLowerCase()}`,
      );
    }

    if (!Validator.isInt(String(value))) {
      ValidationErrorItem.throwDataTypeValidationError(
        `${util.inspect(value)} is not a valid ${this.toString().toLowerCase()}`,
      );
    }
  }

  sanitize(value: unknown): unknown {
    if (typeof value === 'string' || typeof value === 'bigint') {
      const out = parseSafeInteger(value);

      // let validate sort this validation instead
      if (out === null) {
        return value;
      }

      return out;
    }

    return value;
  }

  parseDatabaseValue(value: unknown): unknown {
    return this.sanitize(value);
  }

  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);

    if (this.options.zerofill && !dialect.supports.dataTypes.INTS.zerofill) {
      throwUnsupportedDataType(dialect, `${this.getDataTypeId()}.ZEROFILL`);
    }
  }

  protected _supportsNativeUnsigned(_dialect: AbstractDialect): boolean {
    return _dialect.supports.dataTypes.INTS.unsigned;
  }

  toSql(): string {
    let result: string = this.getNumberSqlTypeName();
    if (this.options.length != null) {
      result += `(${this.options.length})`;
    }

    if (this.options.unsigned && this._supportsNativeUnsigned(this._getDialect())) {
      result += ' UNSIGNED';
    }

    if (this.options.zerofill) {
      result += ' ZEROFILL';
    }

    return result;
  }
}

/**
 * An 8-bit integer.
 *
 * __Fallback policy:__
 * - If this type or its unsigned option is unsupported by the dialect, it will be replaced by a SMALLINT or greater,
 *   with a CHECK constraint to ensure the value is withing the bounds of an 8-bit integer.
 * - If the zerofill option is unsupported by the dialect, an error will be raised.
 * - If the length option is unsupported by the dialect, it will be discarded.
 *
 * @example
 * ```ts
 * DataTypes.TINYINT
 * ```
 *
 * @category DataTypes
 */
export class TINYINT extends BaseIntegerDataType {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'TINYINT';

  protected getNumberSqlTypeName(): string {
    return 'TINYINT';
  }
}

/**
 * A 16-bit integer.
 *
 * __Fallback policy:__
 * - If this type or its unsigned option is unsupported by the dialect, it will be replaced by a MEDIUMINT or greater,
 *   with a CHECK constraint to ensure the value is withing the bounds of an 16-bit integer.
 * - If the zerofill option is unsupported by the dialect, an error will be raised.
 * - If the length option is unsupported by the dialect, it will be discarded.
 *
 * @example
 * ```ts
 * DataTypes.SMALLINT
 * ```
 *
 * @category DataTypes
 */
export class SMALLINT extends BaseIntegerDataType {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'SMALLINT';

  protected getNumberSqlTypeName(): string {
    return 'SMALLINT';
  }
}

/**
 * A 24-bit integer.
 *
 * __Fallback policy:__
 * - If this type or its unsigned option is unsupported by the dialect, it will be replaced by a INTEGER (32 bits) or greater,
 *   with a CHECK constraint to ensure the value is withing the bounds of an 32-bit integer.
 * - If the zerofill option is unsupported by the dialect, an error will be raised.
 * - If the length option is unsupported by the dialect, it will be discarded.
 *
 * @example
 * ```ts
 * DataTypes.MEDIUMINT
 * ```
 *
 * @category DataTypes
 */
export class MEDIUMINT extends BaseIntegerDataType {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'MEDIUMINT';

  protected getNumberSqlTypeName(): string {
    return 'MEDIUMINT';
  }
}

/**
 * A 32-bit integer.
 *
 * __Fallback policy:__
 * - When this type or its unsigned option is unsupported by the dialect, it will be replaced by a BIGINT,
 *   with a CHECK constraint to ensure the value is withing the bounds of an 32-bit integer.
 * - If the zerofill option is unsupported by the dialect, an error will be raised.
 * - If the length option is unsupported by the dialect, it will be discarded.
 *
 * @example
 * ```ts
 * DataTypes.INTEGER
 * ```
 *
 * @category DataTypes
 */
export class INTEGER extends BaseIntegerDataType {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'INTEGER';

  protected getNumberSqlTypeName(): string {
    return 'INTEGER';
  }
}

/**
 * A 64-bit integer.
 *
 * __Fallback policy:__
 * - If this type or its unsigned option is unsupported by the dialect, an error will be raised.
 * - If the zerofill option is unsupported by the dialect, an error will be raised.
 * - If the length option is unsupported by the dialect, it will be discarded.
 *
 * @example
 * ```ts
 * DataTypes.BIGINT
 * ```
 *
 * @category DataTypes
 */
export class BIGINT extends BaseIntegerDataType {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'BIGINT';

  protected getNumberSqlTypeName(): string {
    return 'BIGINT';
  }

  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);

    if (!dialect.supports.dataTypes.BIGINT) {
      throwUnsupportedDataType(dialect, 'BIGINT');
    }

    if (this.options.unsigned && !this._supportsNativeUnsigned(dialect)) {
      throwUnsupportedDataType(dialect, `${this.getDataTypeId()}.UNSIGNED`);
    }
  }

  sanitize(value: AcceptedNumber): AcceptedNumber {
    if (typeof value === 'bigint') {
      return value;
    }

    if (typeof value !== 'string' && typeof value !== 'number') {
      // let validate() handle this instead
      return value;
    }

    // TODO: Breaking Change: Return a BigInt by default - https://github.com/sequelize/sequelize/issues/14296
    return String(parseBigInt(value));
  }
}

export class BaseDecimalNumberDataType extends BaseNumberDataType<DecimalNumberOptions> {
  constructor(options?: DecimalNumberOptions);
  /**
   * @param precision defines precision
   * @param scale defines scale
   */
  constructor(precision: number, scale: number);

  // we have to define the constructor overloads using tuples due to a TypeScript limitation
  //  https://github.com/microsoft/TypeScript/issues/29732, to play nice with classToInvokable.
  /** @hidden */
  constructor(
    ...args:
      | []
      | [precision: number]
      | [precision: number, scale: number]
      | [options: DecimalNumberOptions]
  );

  constructor(precisionOrOptions?: number | DecimalNumberOptions, scale?: number) {
    if (isObject(precisionOrOptions)) {
      super(precisionOrOptions);
    } else {
      super({});

      this.options.precision = precisionOrOptions;
      this.options.scale = scale;
    }

    if (this.options.scale != null && this.options.precision == null) {
      throw new Error(
        `The ${this.getDataTypeId()} DataType requires that the "precision" option be specified if the "scale" option is specified.`,
      );
    }

    if (this.options.scale == null && this.options.precision != null) {
      throw new Error(
        `The ${this.getDataTypeId()} DataType requires that the "scale" option be specified if the "precision" option is specified.`,
      );
    }
  }

  validate(value: any): asserts value is AcceptedNumber {
    if (Number.isNaN(value)) {
      const typeId = this.getDataTypeId();
      const dialect = this._getDialect();

      // @ts-expect-error -- 'typeId' is string, but only some dataTypes are objects
      if (dialect.supports.dataTypes[typeId]?.NaN) {
        return;
      }

      ValidationErrorItem.throwDataTypeValidationError(
        `${util.inspect(value)} is not a valid ${this.toString().toLowerCase()}`,
      );
    }

    if (value === Number.POSITIVE_INFINITY || value === Number.NEGATIVE_INFINITY) {
      const typeId = this.getDataTypeId();
      const dialect = this._getDialect();

      // @ts-expect-error -- 'typeId' is string, but only some dataTypes are objects
      if (dialect.supports.dataTypes[typeId]?.infinity) {
        return;
      }

      ValidationErrorItem.throwDataTypeValidationError(
        `${util.inspect(value)} is not a valid ${this.toString().toLowerCase()}`,
      );
    }

    super.validate(value);
  }

  isUnconstrained() {
    return this.options.scale == null && this.options.precision == null;
  }

  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);

    const typeId = this.getDataTypeId();
    if (typeId !== 'FLOAT' && typeId !== 'DOUBLE' && typeId !== 'DECIMAL' && typeId !== 'REAL') {
      return;
    }

    const supportTable = dialect.supports.dataTypes[typeId];
    if (!supportTable) {
      throwUnsupportedDataType(dialect, this.getDataTypeId());
    }

    if (!supportTable.zerofill && this.options.zerofill) {
      throwUnsupportedDataType(dialect, `${this.getDataTypeId()}.ZEROFILL`);
    }

    if (typeId === 'DECIMAL') {
      return;
    }

    const supportTable2 = dialect.supports.dataTypes[typeId];
    if (
      !supportTable2.scaleAndPrecision &&
      (this.options.scale != null || this.options.precision != null)
    ) {
      dialect.warnDataTypeIssue(
        `${dialect.name} does not support ${this.getDataTypeId()} with scale or precision specified. These options are ignored.`,
      );

      delete this.options.scale;
      delete this.options.precision;
    }
  }

  toSql(): string {
    let sql = this.getNumberSqlTypeName();
    if (!this.isUnconstrained()) {
      sql += `(${this.options.precision}, ${this.options.scale})`;
    }

    if (this.options.unsigned && this._supportsNativeUnsigned(this._getDialect())) {
      sql += ' UNSIGNED';
    }

    if (this.options.zerofill) {
      sql += ' ZEROFILL';
    }

    return sql;
  }
}

/**
 * A single-floating point number with a 4-byte precision.
 * If single-precision floating-point format is not supported, a double-precision floating-point number may be used instead.
 *
 * __Fallback policy:__
 * - If the precision or scale options are unsupported by the dialect, they will be discarded.
 * - If the zerofill option is unsupported by the dialect, an error will be raised.
 * - If the unsigned option is unsupported, it will be replaced by a CHECK > 0 constraint.
 *
 * @example
 * ```ts
 * DataTypes.FLOAT
 * ```
 *
 * @category DataTypes
 */
export class FLOAT extends BaseDecimalNumberDataType {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'FLOAT';

  protected getNumberSqlTypeName(): string {
    throw new Error(`getNumberSqlTypeName is not implemented by default in the FLOAT DataType because 'float' has very different meanings in different dialects.
In Sequelize, DataTypes.FLOAT must be a single-precision floating point, and DataTypes.DOUBLE must be a double-precision floating point.
Please override this method in your dialect, and provide the best available type for single-precision floating points.
If single-precision floating points are not available in your dialect, you may return a double-precision floating point type instead, as long as you print a warning.
If neither single precision nor double precision IEEE 754 floating point numbers are available in your dialect, you must throw an error in the _checkOptionSupport method.`);
  }

  protected _supportsNativeUnsigned(_dialect: AbstractDialect): boolean {
    return _dialect.supports.dataTypes.FLOAT.unsigned;
  }
}

/**
 * @deprecated Use {@link FLOAT} instead.
 */
// TODO (v8): remove this
export class REAL extends BaseDecimalNumberDataType {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'REAL';

  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);

    doNotUseRealDataType();
  }

  protected _supportsNativeUnsigned(_dialect: AbstractDialect): boolean {
    return _dialect.supports.dataTypes.REAL.unsigned;
  }

  protected getNumberSqlTypeName(): string {
    return 'REAL';
  }
}

/**
 * Floating point number (8-byte precision).
 * Throws an error when unsupported, instead of silently falling back to a lower precision.
 *
 * __Fallback policy:__
 * - If the precision or scale options are unsupported by the dialect, they will be discarded.
 * - If the zerofill option is unsupported by the dialect, an error will be raised.
 * - If the unsigned option is unsupported, it will be replaced by a CHECK > 0 constraint.
 *
 * @example
 * ```ts
 * DataTypes.DOUBLE
 * ```
 *
 * @category DataTypes
 */
export class DOUBLE extends BaseDecimalNumberDataType {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'DOUBLE';

  protected _supportsNativeUnsigned(_dialect: AbstractDialect): boolean {
    return _dialect.supports.dataTypes.DOUBLE.unsigned;
  }

  protected getNumberSqlTypeName(): string {
    return 'DOUBLE PRECISION';
  }
}

/**
 * Arbitrary/exact precision decimal number.
 *
 * __Fallback policy:__
 * - If the precision or scale options are unsupported by the dialect, they will be ignored.
 * - If the precision or scale options are not specified, and the dialect does not support unconstrained decimals, an error will be raised.
 * - If the zerofill option is unsupported by the dialect, an error will be raised.
 * - If the unsigned option is unsupported, it will be replaced by a CHECK > 0 constraint.
 *
 * @example
 * ```ts
 * DataTypes.DECIMAL
 * ```
 *
 * @category DataTypes
 */
export class DECIMAL extends BaseDecimalNumberDataType {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'DECIMAL';

  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);

    const decimalSupport = dialect.supports.dataTypes.DECIMAL;

    if (!decimalSupport) {
      throwUnsupportedDataType(dialect, 'DECIMAL');
    }

    if (this.isUnconstrained() && !decimalSupport.unconstrained) {
      throw new Error(
        `${dialect.name} does not support unconstrained DECIMAL types. Please specify the "precision" and "scale" options.`,
      );
    }

    if (!this.isUnconstrained() && !decimalSupport.constrained) {
      dialect.warnDataTypeIssue(
        `${dialect.name} does not support constrained DECIMAL types. The "precision" and "scale" options will be ignored.`,
      );
      this.options.scale = undefined;
      this.options.precision = undefined;
    }
  }

  sanitize(value: AcceptedNumber): AcceptedNumber {
    if (typeof value === 'number') {
      // Some dialects support NaN
      if (Number.isNaN(value)) {
        return value;
      }

      // catch loss of precision issues
      if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
        throw new Error(
          `${this.getDataTypeId()} received an integer ${util.inspect(value)} that is not a safely represented using the JavaScript number type. Use a JavaScript bigint or a string instead.`,
        );
      }
    }

    // Decimal is arbitrary precision, and *must* be represented as strings, as the JS number type does not support arbitrary precision.
    return String(value);
  }

  protected _supportsNativeUnsigned(_dialect: AbstractDialect): boolean {
    const decimalSupport = _dialect.supports.dataTypes.DECIMAL;

    return decimalSupport && decimalSupport.unsigned;
  }

  protected getNumberSqlTypeName(): string {
    return 'DECIMAL';
  }
}

/**
 * A boolean / tinyint column, depending on dialect
 *
 * __Fallback policy:__
 * - If a native boolean type is not available, a dialect-specific numeric replacement (bit, tinyint) will be used instead.
 *
 * @example
 * ```ts
 * DataTypes.BOOLEAN
 * ```
 *
 * @category DataTypes
 */
export class BOOLEAN extends AbstractDataType<boolean> {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'BOOLEAN';

  toSql() {
    // Note: This may vary depending on the dialect.
    return 'BOOLEAN';
  }

  validate(value: any): asserts value is boolean {
    if (typeof value !== 'boolean') {
      ValidationErrorItem.throwDataTypeValidationError(
        util.format('%O is not a valid boolean', value),
      );
    }
  }

  parseDatabaseValue(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }

    // Some dialects do not have a dedicated boolean type. We receive integers instead.
    if (value === 1) {
      return true;
    }

    if (value === 0) {
      return false;
    }

    // Some dialects also use BIT for booleans, which produces a Buffer.
    if (Buffer.isBuffer(value) && value.length === 1) {
      if (value[0] === 1) {
        return true;
      }

      if (value[0] === 0) {
        return false;
      }
    }

    throw new Error(`Received invalid boolean value from DB: ${util.inspect(value)}`);
  }

  escape(value: boolean | unknown): string {
    return value ? 'true' : 'false';
  }

  toBindableValue(value: boolean | unknown): unknown {
    return Boolean(value);
  }
}

export interface TimeOptions {
  /**
   * The precision of the date.
   */
  precision?: number | undefined;
}

/**
 * A time column.
 *
 * __Fallback policy:__
 * If the dialect does not support this type natively, it will be replaced by a string type,
 * and a CHECK constraint to enforce a valid ISO 8601 time format.
 *
 * @example
 * ```ts
 * DataTypes.TIME(3)
 * ```
 *
 * @category DataTypes
 */
export class TIME extends AbstractDataType<string> {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'TIME';
  readonly options: TimeOptions;

  /**
   * @param precisionOrOptions precision to allow storing milliseconds
   */
  constructor(precisionOrOptions?: number | TimeOptions) {
    super();

    this.options = {
      precision:
        typeof precisionOrOptions === 'object' ? precisionOrOptions.precision : precisionOrOptions,
    };
  }

  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);

    if (this.options.precision != null && !dialect.supports.dataTypes.TIME.precision) {
      throwUnsupportedDataType(dialect, 'TIME(precision)');
    }
  }

  toSql() {
    if (this.options.precision != null) {
      return `TIME(${this.options.precision})`;
    }

    return 'TIME';
  }
}

export interface DateOptions {
  /**
   * The precision of the date.
   */
  precision?: number | undefined;
}

type RawDate = Date | string | number;
export type AcceptedDate = RawDate | dayjs.Dayjs | number;

/**
 * A date and time.
 *
 * __Fallback policy:__
 * If the dialect does not support this type natively, it will be replaced by a string type,
 * and a CHECK constraint to enforce a valid ISO 8601 date-only format.
 *
 * @example
 * ```ts
 * DataTypes.DATE(3)
 * ```
 *
 * @category DataTypes
 */
export class DATE extends AbstractDataType<AcceptedDate> {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'DATE';
  readonly options: DateOptions;

  /**
   * @param precisionOrOptions precision to allow storing milliseconds
   */
  constructor(precisionOrOptions?: number | DateOptions) {
    super();

    this.options = {
      precision:
        typeof precisionOrOptions === 'object' ? precisionOrOptions.precision : precisionOrOptions,
    };

    if (
      this.options.precision != null &&
      (this.options.precision < 0 || !Number.isInteger(this.options.precision))
    ) {
      throw new TypeError('Option "precision" must be a positive integer');
    }
  }

  toSql() {
    // TODO [>=8]: Consider making precision default to 3 instead of being dialect-dependent.
    if (this.options.precision != null) {
      return `DATETIME(${this.options.precision})`;
    }

    return 'DATETIME';
  }

  validate(value: any) {
    if (!Validator.isDate(String(value))) {
      ValidationErrorItem.throwDataTypeValidationError(
        util.format('%O is not a valid date', value),
      );
    }
  }

  sanitize(value: unknown): unknown {
    if (value instanceof Date || dayjs.isDayjs(value) || isMoment(value)) {
      return value;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      return new Date(value);
    }

    throw new TypeError(
      `${util.inspect(value)} cannot be converted to a Date object, and is not a DayJS nor Moment object`,
    );
  }

  parseDatabaseValue(value: unknown): unknown {
    return this.sanitize(value);
  }

  areValuesEqual(value: AcceptedDate, originalValue: AcceptedDate): boolean {
    if (
      originalValue &&
      Boolean(value) &&
      (value === originalValue ||
        (value instanceof Date &&
          originalValue instanceof Date &&
          value.getTime() === originalValue.getTime()))
    ) {
      return true;
    }

    // not changed when set to same empty value
    if (!originalValue && !value && originalValue === value) {
      return true;
    }

    return false;
  }

  protected _applyTimezone(date: AcceptedDate) {
    const timezone = this._getDialect().sequelize.options.timezone;

    if (timezone) {
      if (isValidTimeZone(timezone)) {
        return dayjs(date).tz(timezone);
      }

      return dayjs(date).utcOffset(timezone);
    }

    return dayjs(date);
  }

  toBindableValue(date: AcceptedDate) {
    // Z here means current timezone, _not_ UTC
    return this._applyTimezone(date).format('YYYY-MM-DD HH:mm:ss.SSS Z');
  }
}

/**
 * A date only column (no timestamp)
 *
 * __Fallback policy:__
 * If the dialect does not support this type natively, it will be replaced by a string type,
 * and a CHECK constraint to enforce a valid ISO 8601 datetime format.
 *
 * @example
 * ```ts
 * DataTypes.DATEONLY
 * ```
 *
 * @category DataTypes
 */
export class DATEONLY extends AbstractDataType<AcceptedDate> {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'DATEONLY';

  toSql() {
    return 'DATE';
  }

  toBindableValue(date: AcceptedDate) {
    return dayjs.utc(date).format('YYYY-MM-DD');
  }

  sanitize(value: unknown): unknown {
    if (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date)) {
      throw new TypeError(`${value} cannot be normalized into a DateOnly string.`);
    }

    if (value) {
      return dayjs.utc(value).format('YYYY-MM-DD');
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

export type HstoreRecord = Record<string, boolean | number | string | null>;

/**
 * A key / value store column. Only available in Postgres.
 *
 * __Fallback policy:__
 * If the dialect does not support this type natively, an error will be raised.
 *
 * @example
 * ```ts
 * DataTypes.HSTORE
 * ```
 *
 * @category DataTypes
 */
export class HSTORE extends AbstractDataType<HstoreRecord> {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'HSTORE';

  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    if (!dialect.supports.dataTypes.HSTORE) {
      throwUnsupportedDataType(dialect, 'HSTORE');
    }
  }

  validate(value: any) {
    if (!isPlainObject(value)) {
      ValidationErrorItem.throwDataTypeValidationError(
        util.format('%O is not a valid hstore, it must be a plain object', value),
      );
    }

    const hstore = value as Record<PropertyKey, unknown>;

    for (const key of Object.keys(hstore)) {
      if (!isString(hstore[key])) {
        ValidationErrorItem.throwDataTypeValidationError(
          util.format(
            `%O is not a valid hstore, its values must be strings but ${key} is %O`,
            hstore,
            hstore[key],
          ),
        );
      }
    }
  }

  toSql(): string {
    return 'HSTORE';
  }
}

/**
 * A JSON string column.
 *
 * __Fallback policy:__
 * If the dialect does not support this type natively, but supports verifying a string as is valid JSON through CHECK constraints,
 * that will be used instead.
 * If neither are available, an error will be raised.
 *
 * @example
 * ```ts
 * DataTypes.JSON
 * ```
 *
 * @category DataTypes
 */
export class JSON extends AbstractDataType<any> {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'JSON';

  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    if (!dialect.supports.dataTypes.JSON) {
      throwUnsupportedDataType(dialect, 'JSON');
    }
  }

  /**
   * We stringify null too.
   */
  acceptsNull(): boolean {
    const sequelize = this._getDialect().sequelize;

    return sequelize.options.nullJsonStringification !== 'sql';
  }

  toBindableValue(value: any): string {
    if (value === null) {
      const sequelize = this._getDialect().sequelize;

      const isExplicit = sequelize.options.nullJsonStringification === 'explicit';
      if (isExplicit) {
        throw new Error(
          `Attempted to insert the JavaScript null into a JSON column, but the "nullJsonStringification" option is set to "explicit", so Sequelize cannot decide whether to use the SQL NULL or the JSON 'null'. Use the SQL_NULL or JSON_NULL variable instead, or set the option to a different value. See https://sequelize.org/docs/v7/querying/json/ for details.`,
        );
      }
    }

    return globalThis.JSON.stringify(value);
  }

  toSql(): string {
    return 'JSON';
  }
}

/**
 * A binary storage JSON column. Only available in Postgres.
 *
 * __Fallback policy:__
 * If the dialect does not support this type natively, an error will be raised.
 *
 * @example
 * ```ts
 * DataTypes.JSONB
 * ```
 *
 * @category DataTypes
 */
export class JSONB extends JSON {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'JSONB';

  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);
    if (!dialect.supports.dataTypes.JSONB) {
      throwUnsupportedDataType(dialect, 'JSONB');
    }
  }

  toSql(): string {
    return 'JSONB';
  }
}

/**
 * A default value of the current timestamp. Not a valid type.
 *
 * @example
 * ```ts
 * const User = sequelize.define('User', {
 *   registeredAt: {
 *     type: DataTypes.DATE,
 *     defaultValue: DataTypes.NOW,
 *   },
 * });
 * ```
 *
 * @category DataTypes
 */
// TODO: this should not be a DataType. Replace with a new version of `fn` that is dialect-aware, so we don't need to hardcode it in toDefaultValue().
export class NOW extends AbstractDataType<never> {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'NOW';

  toSql(): string {
    return 'NOW';
  }
}

export type AcceptedBlob = Buffer | string;

export type BlobLength = 'tiny' | 'medium' | 'long';

export interface BlobOptions {
  // TODO: must also allow BLOB(255), BLOB(16M) in db2/ibmi
  length?: BlobLength | undefined;
}

/**
 * Binary storage. BLOB is the "TEXT" of binary data: it allows data of arbitrary size.
 *
 * __Fallback policy:__
 * If this type is not supported, an error will be raised.
 *
 * @example
 * ```ts
 * const User = sequelize.define('User', {
 *   profilePicture: {
 *     type: DataTypes.BLOB,
 *   },
 * });
 * ```
 *
 * @category DataTypes
 */
// TODO: add FIXED_BINARY & VAR_BINARY data types. They are not the same as CHAR BINARY / VARCHAR BINARY.
export class BLOB extends AbstractDataType<AcceptedBlob> {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'BLOB';
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
        return 'BLOB';
    }
  }

  validate(value: any) {
    if (
      Buffer.isBuffer(value) ||
      typeof value === 'string' ||
      value instanceof Uint8Array ||
      value instanceof ArrayBuffer
    ) {
      return;
    }

    rejectBlobs(value);

    ValidationErrorItem.throwDataTypeValidationError(
      `${util.inspect(value)} is not a valid binary value: Only strings, Buffer, Uint8Array and ArrayBuffer are supported.`,
    );
  }

  sanitize(value: unknown): unknown {
    if (value instanceof Uint8Array || value instanceof ArrayBuffer) {
      return makeBufferFromTypedArray(value);
    }

    if (typeof value === 'string') {
      return Buffer.from(value);
    }

    return value;
  }

  escape(value: string | Buffer) {
    const buf = typeof value === 'string' ? Buffer.from(value, 'binary') : value;

    return this._getDialect().escapeBuffer(buf);
  }

  getBindParamSql(value: AcceptedBlob, options: BindParamOptions) {
    return options.bindParam(value);
  }
}

export interface RangeOptions {
  subtype?: DataTypeClassOrInstance;
}

/**
 * Range types are data types representing a range of values of some element type (called the range's subtype).
 * Only available in Postgres. See [the Postgres documentation](http://www.postgresql.org/docs/9.4/static/rangetypes.html) for more details
 *
 * __Fallback policy:__
 * If this type is not supported, an error will be raised.
 *
 * @example
 * ```ts
 * // A range of integers
 * DataTypes.RANGE(DataTypes.INTEGER)
 * // A range of bigints
 * DataTypes.RANGE(DataTypes.BIGINT)
 * // A range of decimals
 * DataTypes.RANGE(DataTypes.DECIMAL)
 * // A range of timestamps
 * DataTypes.RANGE(DataTypes.DATE)
 * // A range of dates
 * DataTypes.RANGE(DataTypes.DATEONLY)
 * ```
 *
 * @category DataTypes
 */
export class RANGE<
  T extends BaseNumberDataType | DATE | DATEONLY = INTEGER,
> extends AbstractDataType<Rangable<AcceptableTypeOf<T>> | AcceptableTypeOf<T>> {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'RANGE';
  readonly options: {
    subtype: AbstractDataType<any>;
  };

  /**
   * @param subtypeOrOptions A subtype for range, like RANGE(DATE)
   */
  constructor(subtypeOrOptions: DataTypeClassOrInstance | RangeOptions) {
    super();

    const subtypeRaw =
      (isDataType(subtypeOrOptions) ? subtypeOrOptions : subtypeOrOptions?.subtype) ??
      new INTEGER();

    const subtype: DataTypeInstance = isDataTypeClass(subtypeRaw) ? new subtypeRaw() : subtypeRaw;

    this.options = {
      subtype,
    };
  }

  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);

    if (!dialect.supports.dataTypes.RANGE) {
      throwUnsupportedDataType(dialect, 'RANGE');
    }
  }

  toDialectDataType(dialect: AbstractDialect): this {
    let replacement = super.toDialectDataType(dialect);

    if (replacement === this) {
      replacement = replacement.clone();
    }

    replacement.options.subtype = replacement.options.subtype.toDialectDataType(dialect);

    return replacement;
  }

  parseDatabaseValue(_value: unknown): unknown {
    throw new Error(`DataTypes.RANGE is not supported in ${this._getDialect().name}.`);
  }

  sanitize(value: unknown): unknown {
    if (!Array.isArray(value)) {
      return value;
    }

    // this is the "empty" range, which is not the same value as "(,)" (represented by [null, null])
    if (value.length === 0) {
      return value;
    }

    let [low, high] = value;
    if (!isPlainObject(low)) {
      low = { value: low ?? null, inclusive: true };
    }

    if (!isPlainObject(high)) {
      high = { value: high ?? null, inclusive: false };
    }

    return [this.#sanitizeSide(low), this.#sanitizeSide(high)];
  }

  #sanitizeSide(rangePart: RangePart<unknown>) {
    if (rangePart.value == null) {
      return rangePart;
    }

    return { ...rangePart, value: this.options.subtype.sanitize(rangePart.value) };
  }

  validate(value: any) {
    if (!Array.isArray(value) || (value.length !== 2 && value.length !== 0)) {
      ValidationErrorItem.throwDataTypeValidationError(
        `A range must either be an array with two elements, or an empty array for the empty range. Got ${util.inspect(value)}.`,
      );
    }
  }

  toSql(): string {
    throw new Error('RANGE has not been implemented in this dialect.');
  }
}

export interface UuidOptions {
  version: 1 | 4 | 'all';
}

/**
 * A column storing a unique universal identifier.
 * Use with `sql.uuidV1` or `sql.uuidV4` for default values.
 *
 * __Fallback policy:__
 * If this type is not supported, it will be replaced by a string type with a CHECK constraint to enforce a GUID format.
 *
 * @example
 * ```ts
 * const User = sequelize.define('User', {
 *   id: {
 *     type: DataTypes.UUID.V4,
 *     defaultValue: sql.uuidV4,
 *   },
 * });
 * ```
 *
 * @category DataTypes
 */
export class UUID extends AbstractDataType<string> {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'UUID';

  readonly options: UuidOptions;

  constructor(options?: Partial<UuidOptions>) {
    super();

    this.options = {
      version: options?.version ?? 'all',
    };
  }

  get V4() {
    return this._construct<typeof UUID>({
      ...this.options,
      version: 4,
    });
  }

  static get V4() {
    return new this({ version: 4 });
  }

  get V1() {
    return this._construct<typeof UUID>({
      ...this.options,
      version: 1,
    });
  }

  static get V1() {
    return new this({ version: 1 });
  }

  validate(value: any) {
    if (typeof value !== 'string' || !Validator.isUUID(value, this.options.version)) {
      ValidationErrorItem.throwDataTypeValidationError(
        util.format(`%O is not a valid uuid (version: ${this.options.version})`, value),
      );
    }
  }

  toSql(): string {
    return 'UUID';
  }
}

/**
 * A default unique universal identifier generated following the UUID v1 standard.
 * Cannot be used as a type, must be used as a default value instead.
 *
 * @category DataTypes
 * @deprecated use `DataTypes.UUID.V1` (data type) & `sql.uuidV1` (default value) instead
 */
export class UUIDV1 extends AbstractDataType<string> {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'UUIDV1';

  validate(value: any) {
    if (typeof value !== 'string' || !Validator.isUUID(value, 1)) {
      ValidationErrorItem.throwDataTypeValidationError(
        util.format('%O is not a valid uuidv1', value),
      );
    }
  }

  toSql(): string {
    throw new Error('toSQL should not be called on DataTypes.UUIDV1');
  }
}

/**
 * A default unique universal identifier generated following the UUID v4 standard.
 * Cannot be used as a type, must be used as a default value instead.
 *
 * @category DataTypes
 * @deprecated use `DataTypes.UUID.V4` (data type) & `sql.uuidV4` (default value) instead
 */
export class UUIDV4 extends AbstractDataType<string> {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'UUIDV4';

  validate(value: unknown) {
    if (typeof value !== 'string' || !Validator.isUUID(value, 4)) {
      ValidationErrorItem.throwDataTypeValidationError(
        util.format('%O is not a valid uuidv4', value),
      );
    }
  }

  toSql(): string {
    throw new Error('toSQL should not be called on DataTypes.UUIDV4');
  }
}

export interface VirtualOptions {
  returnType?: DataTypeClassOrInstance | undefined;
  attributeDependencies?: string[] | undefined;
}

export interface NormalizedVirtualOptions {
  returnType: DataTypeClassOrInstance | undefined;
  attributeDependencies: string[];
}

/**
 * A virtual value that is not stored in the DB. This could for example be useful if you want to provide a default value in your model that is returned to the user but not stored in the DB.
 *
 * You could also use it to validate a value before permuting and storing it. VIRTUAL also takes a return type and dependency fields as arguments
 * If a virtual attribute is present in `attributes` it will automatically pull in the extra fields as well.
 * Return type is mostly useful for setups that rely on types like GraphQL.
 *
 * @example Checking password length before hashing it
 * ```ts
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
 * ```
 *
 * In the above code the password is stored plainly in the password field so it can be validated, but is never stored in the DB.
 *
 * @example Virtual with dependency fields
 * ```ts
 * {
 *   active: {
 *     type: new DataTypes.VIRTUAL(DataTypes.BOOLEAN, ['createdAt']),
 *     get: function() {
 *       return this.get('createdAt') > Date.now() - (7 * 24 * 60 * 60 * 1000)
 *     }
 *   }
 * }
 * ```
 *
 * @category DataTypes
 */
export class VIRTUAL<T> extends AbstractDataType<T> {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'VIRTUAL';

  options: NormalizedVirtualOptions;

  constructor(returnType?: DataTypeClassOrInstance, attributeDependencies?: string[]);
  constructor(options?: VirtualOptions);

  // we have to define the constructor overloads using tuples due to a TypeScript limitation
  //  https://github.com/microsoft/TypeScript/issues/29732, to play nice with classToInvokable.
  /** @hidden */
  constructor(
    ...args:
      | [returnType?: DataTypeClassOrInstance, attributeDependencies?: string[]]
      | [options?: VirtualOptions]
  );

  /**
   * @param [returnTypeOrOptions] return type for virtual type, or an option bag
   * @param [attributeDependencies] array of attributes this virtual type is dependent on
   */
  constructor(
    returnTypeOrOptions?: DataTypeClassOrInstance | VirtualOptions,
    attributeDependencies?: string[],
  ) {
    super();

    const returnType =
      returnTypeOrOptions == null
        ? undefined
        : isDataType(returnTypeOrOptions)
          ? returnTypeOrOptions
          : returnTypeOrOptions.returnType;

    this.options = {
      returnType: returnType ? dataTypeClassOrInstanceToInstance(returnType) : undefined,
      attributeDependencies:
        (isDataType(returnTypeOrOptions)
          ? attributeDependencies
          : returnTypeOrOptions?.attributeDependencies) ?? [],
    };
  }

  toSql(): string {
    throw new Error('toSQL should not be called on DataTypes.VIRTUAL');
  }

  get returnType() {
    return this.options.returnType;
  }

  get attributeDependencies() {
    return this.options.attributeDependencies;
  }
}

/**
 * If an array, each element in the array is a possible value for the ENUM.
 *
 * If a record (plain object, typescript enum),
 * it will use the keys as the list of possible values for the ENUM, in the order specified by the Object.
 * This is designed to be used with TypeScript enums, but it can be used with plain objects as well.
 * Because we don't handle any mapping between the enum keys and values, we require that they be the same.
 */
type EnumValues<Member extends string> = readonly Member[] | Record<Member, Member>;

export interface EnumOptions<Member extends string> {
  values: EnumValues<Member>;
}

export interface NormalizedEnumOptions<Member extends string> {
  values: readonly Member[];
}

/**
 * An enumeration, Postgres Only
 *
 * __Fallback policy:__
 * If this type is not supported, it will be replaced by a string type with a CHECK constraint to enforce a list of values.
 *
 * @example
 * ```ts
 * DataTypes.ENUM('value', 'another value')
 * DataTypes.ENUM(['value', 'another value'])
 * DataTypes.ENUM({
 *   values: ['value', 'another value'],
 * });
 * ```
 *
 * @category DataTypes
 */
export class ENUM<Member extends string> extends AbstractDataType<Member> {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'ENUM';
  readonly options: NormalizedEnumOptions<Member>;

  /**
   * @param options either array of values or options object with values array. It also supports variadic values.
   */
  constructor(options: EnumOptions<Member>);
  constructor(members: EnumValues<Member>);
  constructor(...members: Member[]);
  // we have to define the constructor overloads using tuples due to a TypeScript limitation
  //  https://github.com/microsoft/TypeScript/issues/29732, to play nice with classToInvokable.
  /** @hidden */
  constructor(
    ...args: [options: EnumOptions<Member>] | [members: EnumValues<Member>] | [...members: Member[]]
  );
  constructor(...args: [EnumValues<Member> | Member | EnumOptions<Member>, ...Member[]]) {
    super();

    const values: readonly Member[] = this.#getEnumValues(args);

    if (values.length === 0) {
      throw new TypeError(
        `
DataTypes.ENUM cannot be used without specifying its possible enum values.

Note that the "values" property has been removed from column definitions. The following is no longer supported:

sequelize.define('MyModel', {
  roles: {
    type: DataTypes.ENUM,
    values: ['admin', 'user'],
  },
});

Instead, define enum values like this:

sequelize.define('MyModel', {
  roles: {
    type: DataTypes.ENUM(['admin', 'user']),
  },
});
`.trim(),
      );
    }

    for (const value of values) {
      if (typeof value !== 'string') {
        throw new TypeError(
          util.format(
            `One of the possible values passed to DataTypes.ENUM (%O) is not a string. Only strings can be used as enum values.`,
            value,
          ),
        );
      }
    }

    this.options = {
      values,
    };
  }

  #getEnumValues(
    args: [EnumValues<Member> | Member | EnumOptions<Member>, ...Member[]],
  ): readonly Member[] {
    if (args.length === 0) {
      return EMPTY_ARRAY;
    }

    const [first, ...rest] = args;

    if (isString(first)) {
      return [first, ...rest];
    }

    if (rest.length > 0) {
      throw new TypeError(
        'DataTypes.ENUM has been constructed incorrectly: Its first parameter is the option bag or the array of values, but more than one parameter has been provided.',
      );
    }

    let enumOrArray: EnumValues<Member>;
    if (!Array.isArray(first) && 'values' in first && typeof first.values !== 'string') {
      // This is the option bag
      // @ts-expect-error -- Array.isArray does not narrow correctly when the array is readonly
      enumOrArray = first.values;
    } else {
      // @ts-expect-error -- Array.isArray does not narrow correctly when the array is readonly
      enumOrArray = first;
    }

    if (Array.isArray(enumOrArray)) {
      return [...enumOrArray];
    }

    // @ts-expect-error -- Array.isArray does not narrow correctly when the array is readonly
    const theEnum: Record<Member, Member> = enumOrArray;
    const enumKeys = Object.keys(theEnum) as Member[];
    for (const enumKey of enumKeys) {
      if (theEnum[enumKey] !== enumKey) {
        throw new TypeError(
          `DataTypes.ENUM has been constructed incorrectly: When specifying values as a TypeScript enum or an object of key-values, the values of the object must be equal to their keys.`,
        );
      }
    }

    return enumKeys;
  }

  validate(value: any): asserts value is Member {
    if (!this.options.values.includes(value)) {
      ValidationErrorItem.throwDataTypeValidationError(
        util.format('%O is not a valid choice for enum %O', value, this.options.values),
      );
    }
  }

  toSql(): string {
    throw new Error(`ENUM has not been implemented in the ${this._getDialect().name} dialect.`);
  }
}

export interface ArrayOptions {
  type: DataTypeClassOrInstance;
}

interface NormalizedArrayOptions {
  type: NormalizedDataType;
}

/**
 * An array of `type`. Only available in Postgres.
 *
 * __Fallback policy:__
 * If this type is not supported, an error will be raised.
 *
 * @example
 * ```ts
 * DataTypes.ARRAY(DataTypes.DECIMAL)
 * ```
 *
 * @category DataTypes
 */
export class ARRAY<T extends AbstractDataType<any>> extends AbstractDataType<
  Array<AcceptableTypeOf<T>>
> {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'ARRAY';
  readonly options: NormalizedArrayOptions;

  /**
   * @param typeOrOptions type of array values
   */
  constructor(typeOrOptions: DataType | ArrayOptions) {
    super();

    const rawType = isDataType(typeOrOptions) ? typeOrOptions : typeOrOptions?.type;

    if (!rawType) {
      throw new TypeError('DataTypes.ARRAY is missing type definition for its values.');
    }

    this.options = {
      type: isString(rawType) ? rawType : dataTypeClassOrInstanceToInstance(rawType),
    };
  }

  toSql(): string {
    return `${attributeTypeToSql(this.options.type)}[]`;
  }

  validate(value: any) {
    if (!Array.isArray(value)) {
      ValidationErrorItem.throwDataTypeValidationError(
        util.format('%O is not a valid array', value),
      );
    }

    if (isString(this.options.type)) {
      return;
    }

    const subType: AbstractDataType<any> = this.options.type;

    for (const item of value) {
      subType.validate(item);
    }
  }

  sanitize(value: unknown): unknown {
    if (!Array.isArray(value)) {
      return value;
    }

    if (isString(this.options.type)) {
      return;
    }

    const subType: AbstractDataType<any> = this.options.type;

    return value.map(item => subType.sanitize(item));
  }

  parseDatabaseValue(value: unknown[]): unknown {
    if (!Array.isArray(value)) {
      throw new Error(
        `DataTypes.ARRAY Received a non-array value from database: ${util.inspect(value)}`,
      );
    }

    if (isString(this.options.type)) {
      return value;
    }

    const subType: AbstractDataType<any> = this.options.type;

    return value.map(item => subType.parseDatabaseValue(item));
  }

  toBindableValue(value: Array<AcceptableTypeOf<T>>): unknown {
    if (isString(this.options.type)) {
      return value;
    }

    const subType: AbstractDataType<any> = this.options.type;

    return value.map(val => subType.toBindableValue(val));
  }

  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);

    if (!dialect.supports.dataTypes.ARRAY) {
      throwUnsupportedDataType(dialect, 'ARRAY');
    }
  }

  toDialectDataType(dialect: AbstractDialect): this {
    let replacement = super.toDialectDataType(dialect);

    if (replacement === this) {
      replacement = replacement.clone();
    }

    if (!isString(replacement.options.type)) {
      replacement.options.type = replacement.options.type.toDialectDataType(dialect);
    }

    return replacement;
  }

  attachUsageContext(usageContext: DataTypeUseContext): this {
    if (!isString(this.options.type)) {
      this.options.type.attachUsageContext(usageContext);
    }

    return super.attachUsageContext(usageContext);
  }

  static is<T extends AbstractDataType<any>>(obj: unknown, type: new () => T): obj is ARRAY<T> {
    return obj instanceof ARRAY && obj.options.type instanceof type;
  }
}

export interface GeometryOptions {
  type?: GeoJsonType | undefined;
  srid?: number | undefined;
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
 * __Fallback policy:__
 * If this type is not supported, an error will be raised.
 *
 * @example Defining a Geometry type attribute
 * ```ts
 * DataTypes.GEOMETRY
 * DataTypes.GEOMETRY('POINT')
 * DataTypes.GEOMETRY('POINT', 4326)
 * ```
 *
 * @example Create a new point
 * ```ts
 * const point = { type: 'Point', coordinates: [-76.984722, 39.807222]}; // GeoJson format: [lng, lat]
 *
 * User.create({username: 'username', geometry: point });
 * ```
 *
 * @example Create a new linestring
 * ```ts
 * const line = { type: 'LineString', 'coordinates': [ [100.0, 0.0], [101.0, 1.0] ] };
 *
 * User.create({username: 'username', geometry: line });
 * ```
 *
 * @example Create a new polygon
 * ```ts
 * const polygon = { type: 'Polygon', coordinates: [
 *                 [ [100.0, 0.0], [101.0, 0.0], [101.0, 1.0],
 *                   [100.0, 1.0], [100.0, 0.0] ]
 *                 ]};
 *
 * User.create({username: 'username', geometry: polygon });
 * ```
 *
 * @example Create a new point with a custom SRID
 * ```ts
 * const point = {
 *   type: 'Point',
 *   coordinates: [-76.984722, 39.807222], // GeoJson format: [lng, lat]
 *   crs: { type: 'name', properties: { name: 'EPSG:4326'} }
 * };
 *
 * User.create({username: 'username', geometry: point })
 * ```
 *
 * @category DataTypes
 */
export class GEOMETRY extends AbstractDataType<GeoJson> {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'GEOMETRY';
  readonly options: GeometryOptions;

  /**
   * @param {string} [type] Type of geometry data
   * @param {string} [srid] SRID of type
   */
  constructor(type: GeoJsonType, srid?: number);
  constructor(options: GeometryOptions);

  // we have to define the constructor overloads using tuples due to a TypeScript limitation
  //  https://github.com/microsoft/TypeScript/issues/29732, to play nice with classToInvokable.
  /** @hidden */
  constructor(...args: [type: GeoJsonType, srid?: number] | [options: GeometryOptions]);

  constructor(typeOrOptions: GeoJsonType | GeometryOptions, srid?: number) {
    super();

    this.options = isObject(typeOrOptions) ? { ...typeOrOptions } : { type: typeOrOptions, srid };
  }

  protected _checkOptionSupport(dialect: AbstractDialect) {
    super._checkOptionSupport(dialect);

    if (!dialect.supports.dataTypes.GEOMETRY) {
      throwUnsupportedDataType(dialect, 'GEOMETRY');
    }
  }

  validate(value: unknown): asserts value is GeoJson {
    try {
      assertIsGeoJson(value);
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }

      // TODO: add 'cause'
      ValidationErrorItem.throwDataTypeValidationError(error.message);
    }

    return super.validate(value);
  }

  toSql(): string {
    return 'GEOMETRY';
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
 * __Fallback policy:__
 * If this type is not supported, an error will be raised.
 *
 * @example Defining a Geography type attribute
 * ```ts
 * DataTypes.GEOGRAPHY
 * DataTypes.GEOGRAPHY('POINT')
 * DataTypes.GEOGRAPHY('POINT', 4326)
 * ```
 *
 * @category DataTypes
 */
export class GEOGRAPHY extends GEOMETRY {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'GEOGRAPHY';

  protected _checkOptionSupport(dialect: AbstractDialect) {
    if (!dialect.supports.dataTypes.GEOGRAPHY) {
      throwUnsupportedDataType(dialect, 'GEOGRAPHY');
    }
  }

  toSql(): string {
    return 'GEOGRAPHY';
  }
}

/**
 * The cidr type holds an IPv4 or IPv6 network specification. Takes 7 or 19 bytes.
 *
 * Only available for Postgres
 *
 * __Fallback policy:__
 * If this type is not supported, an error will be raised.
 *
 * @example
 * ```ts
 * DataTypes.CIDR
 * ```
 *
 * @category DataTypes
 */
export class CIDR extends AbstractDataType<string> {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'CIDR';

  protected _checkOptionSupport(dialect: AbstractDialect) {
    if (!dialect.supports.dataTypes.CIDR) {
      throwUnsupportedDataType(dialect, 'CIDR');
    }
  }

  validate(value: any) {
    if (typeof value !== 'string' || !Validator.isIPRange(value)) {
      ValidationErrorItem.throwDataTypeValidationError(
        util.format('%O is not a valid CIDR', value),
      );
    }
  }

  toSql(): string {
    return 'CIDR';
  }
}

/**
 * The INET type holds an IPv4 or IPv6 host address, and optionally its subnet. Takes 7 or 19 bytes
 *
 * Only available for Postgres
 *
 * __Fallback policy:__
 * If this type is not supported, an error will be raised.
 *
 * @example
 * ```ts
 * DataTypes.INET
 * ```
 *
 * @category DataTypes
 */
export class INET extends AbstractDataType<string> {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'INET';

  protected _checkOptionSupport(dialect: AbstractDialect) {
    if (!dialect.supports.dataTypes.INET) {
      throwUnsupportedDataType(dialect, 'INET');
    }
  }

  validate(value: any) {
    if (typeof value !== 'string' || !Validator.isIP(value)) {
      ValidationErrorItem.throwDataTypeValidationError(
        util.format('%O is not a valid INET', value),
      );
    }
  }

  toSql(): string {
    return 'INET';
  }
}

/**
 * The MACADDR type stores MAC addresses. Takes 6 bytes
 *
 * Only available for Postgres
 *
 * __Fallback policy:__
 * If this type is not supported, an error will be raised.
 *
 * @example
 * ```ts
 * DataTypes.MACADDR
 * ```
 *
 * @category DataTypes
 */
export class MACADDR extends AbstractDataType<string> {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'MACADDR';

  protected _checkOptionSupport(dialect: AbstractDialect) {
    if (!dialect.supports.dataTypes.MACADDR) {
      throwUnsupportedDataType(dialect, 'MACADDR');
    }
  }

  validate(value: any) {
    if (typeof value !== 'string' || !Validator.isMACAddress(value, { eui: '48' })) {
      ValidationErrorItem.throwDataTypeValidationError(
        util.format('%O is not a valid MACADDR', value),
      );
    }
  }

  toSql(): string {
    return 'MACADDR';
  }
}

/**
 * The MACADDR type stores MAC addresses. Takes 8 bytes
 *
 * Only available for Postgres
 *
 * __Fallback policy:__
 * If this type is not supported, an error will be raised.
 *
 * @example
 * ```ts
 * DataTypes.MACADDR8
 * ```
 *
 * @category DataTypes
 */
export class MACADDR8 extends AbstractDataType<string> {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'MACADDR8';

  protected _checkOptionSupport(dialect: AbstractDialect) {
    if (!dialect.supports.dataTypes.MACADDR8) {
      throwUnsupportedDataType(dialect, 'MACADDR8');
    }
  }

  validate(value: any) {
    if (typeof value !== 'string' || !Validator.isMACAddress(value, { eui: '64' })) {
      ValidationErrorItem.throwDataTypeValidationError(
        util.format('%O is not a valid MACADDR8', value),
      );
    }
  }

  toSql(): string {
    return 'MACADDR8';
  }
}

/**
 * The TSVECTOR type stores text search vectors.
 *
 * Only available for Postgres
 *
 * __Fallback policy:__
 * If this type is not supported, an error will be raised.
 *
 * @example
 * ```ts
 * DataTypes.TSVECTOR
 * ```
 *
 * @category DataTypes
 */
export class TSVECTOR extends AbstractDataType<string> {
  /** @hidden */
  static readonly [DataTypeIdentifier]: string = 'TSVECTOR';

  validate(value: any) {
    if (typeof value !== 'string') {
      ValidationErrorItem.throwDataTypeValidationError(
        util.format('%O is not a valid string', value),
      );
    }
  }

  protected _checkOptionSupport(dialect: AbstractDialect) {
    if (!dialect.supports.dataTypes.TSVECTOR) {
      throwUnsupportedDataType(dialect, 'TSVECTOR');
    }
  }

  toSql(): string {
    return 'TSVECTOR';
  }
}

function rejectBlobs(value: unknown) {
  // We have a DataType called BLOB. People might try to use the built-in Blob type with it, which they cannot.
  // To clarify why it doesn't work, we have a dedicated message for it.
  if (Blob && value instanceof Blob) {
    ValidationErrorItem.throwDataTypeValidationError(
      'Blob instances are not supported values, because reading their data is an async operation. Call blob.arrayBuffer() to get a buffer, and pass that to Sequelize instead.',
    );
  }
}

function assertDataTypeSupported(dialect: AbstractDialect, dataType: AbstractDataType<any>) {
  const typeId = dataType.getDataTypeId();

  if (
    typeId in dialect.supports.dataTypes &&
    // @ts-expect-error -- it's possible that typeId isn't listed in the support table, but that's checked above
    !dialect.supports.dataTypes[typeId]
  ) {
    throwUnsupportedDataType(dialect, typeId);
  }
}
