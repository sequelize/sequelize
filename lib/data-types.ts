import util from 'util';
import _ from 'lodash';
import wkx from 'wkx';
import * as sequelizeErrors from './errors';
import { validator as Validator } from './utils/validator-extras';
import momentTz from 'moment-timezone';
import moment, { Moment } from 'moment';
import { logger } from './utils/logger';
import { classToInvokable } from './utils/class-to-invokable';
import { joinSQLFragments } from './utils/join-sql-fragments';

import postgresDataTypes from './dialects/postgres/data-types';
import mysqlDataTypes from './dialects/mysql/data-types';
import mariadbDataTypes from './dialects/mariadb/data-types';
import sqliteDataTypes from './dialects/sqlite/data-types';
import mssqlDataTypes from './dialects/mssql/data-types';
import db2DataTypes from './dialects/db2/data-types';
import snowflakeDataTypes from './dialects/snowflake/data-types';

const warnings: Record<string, boolean> = {};

type AbstractCtor<T = string> = ABSTRACT<T> & { new (options?: unknown): ABSTRACT<T> };

function isConstructor<T>(type: AbstractCtor<T> | ABSTRACT<T>): type is AbstractCtor<T> {
  return typeof type === 'function';
}

interface BindParamOptions {
  bindParam(value: unknown): string;
}

interface StringifyOptions {
  escape(value: string): string;
}

abstract class ABSTRACT<T = string> {
  protected _bindParam?(value: T, options?: BindParamOptions): string;
  protected _sanitize?(value: unknown, options: object): unknown;
  protected _stringify?(value: T, options?: object): string;
  protected _isChanged?(value: T, originalValue: T): boolean;
  public static parse?(value: unknown): unknown;
  public validate?(value: T, options?: object): boolean;
  /** Key used for column type in dialect */
  public key!: string;
  public static key: string;
  /** URL to the list of dialect types */
  public dialectTypes = '';
  public static types: object;
  public options = {};

  toString(options: object) {
    return this.toSql(options);
  }
  toSql(_options?: object) {
    return this.key;
  }
  stringify(value: T, options: object) {
    if (this._stringify) {
      return this._stringify(value, options);
    }
    return (value as unknown) as string;
  }
  bindParam(value: T, options: BindParamOptions) {
    if (this._bindParam) {
      return this._bindParam(value, options);
    }
    return options.bindParam(this.stringify(value, options));
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
  static extend(this: AbstractCtor, oldType: ABSTRACT) {
    return new this(oldType.options);
  }
}

interface StringOptions {
  binary?: boolean;
  length?: number;
}

/**
 * STRING A variable length string
 */
class STRING extends ABSTRACT {
  /** Is this binary? */
  protected _binary?: boolean;
  /** Length of string */
  protected _length: number;
  public options: StringOptions;

  /**
   * @param {number} [length=255] length of string
   * @param {boolean} [binary=false] Is this binary?
   */
  constructor(length?: number | StringOptions, binary?: boolean) {
    super();
    const options = typeof length === 'object' && length || {
      length,
      binary
    };
    this.options = options;
    this._binary = options.binary;
    this._length = options.length || 255;
  }
  toSql() {
    return joinSQLFragments([
      `VARCHAR(${this._length})`,
      this._binary && 'BINARY'
    ]);
  }
  validate(value: string) {
    if (Object.prototype.toString.call(value) !== '[object String]') {
      if (this.options.binary && Buffer.isBuffer(value) || typeof value === 'number') {
        return true;
      }
      throw new sequelizeErrors.ValidationError(util.format('%j is not a valid string', value));
    }
    return true;
  }

  get BINARY() {
    this._binary = true;
    this.options.binary = true;
    return this;
  }

  static get BINARY() {
    return new this().BINARY;
  }
}

/**
 * CHAR A fixed length string
 */
class CHAR extends STRING {
  /**
   * @param {number} [length=255] length of string
   * @param {boolean} [binary=false] Is this binary?
   */
  constructor(length?: number | StringOptions, binary?: boolean) {
    super(typeof length === 'object' && length || { length, binary });
  }
  toSql() {
    return joinSQLFragments([
      `CHAR(${this._length})`,
      this._binary && 'BINARY'
    ]);
  }
}

/**
 * Unlimited length TEXT column
 */
class TEXT extends ABSTRACT {
  protected _length: string;
  /**
   * @param {string} [length=''] could be tiny, medium, long.
   */
  constructor(length?: string) {
    super();
    const options = typeof length === 'object' && length || { length };
    this.options = options;
    this._length = options.length || '';
  }
  toSql() {
    switch (this._length.toLowerCase()) {
      case 'tiny':
        return 'TINYTEXT';
      case 'medium':
        return 'MEDIUMTEXT';
      case 'long':
        return 'LONGTEXT';
      default:
        return this.key;
    }
  }
  validate(value: string) {
    if (typeof value !== 'string') {
      throw new sequelizeErrors.ValidationError(util.format('%j is not a valid string', value));
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
class CITEXT extends ABSTRACT {
  toSql() {
    return 'CITEXT';
  }
  validate(value: string) {
    if (typeof value !== 'string') {
      throw new sequelizeErrors.ValidationError(util.format('%j is not a valid string', value));
    }
    return true;
  }
}

interface NumberOptions {
  /** length of type, like `INT(4)` */
  length?: string | number;
  /** Is zero filled? */
  zerofill?: boolean;
  /** Is unsigned? */
  unsigned?: boolean;
  /** number of decimal points, used with length `FLOAT(5, 4)` */
  decimals?: string | number;
  /** defines precision for decimal type */
  precision?: string | number;
  /** defines scale for decimal type */
  scale?: string | number;
}

/**
 * Base number type which is used to build other types
 */
class NUMBER extends ABSTRACT<number> {
  protected _length?: string | number;
  protected _zerofill?: boolean;
  protected _decimals?: string | number;
  protected _precision?: string | number;
  protected _scale?: string | number;
  protected _unsigned?: boolean;
  public options: NumberOptions;
  /**
   * @param {object} options type options
   * @param {string|number} [options.length] length of type, like `INT(4)`
   * @param {boolean} [options.zerofill] Is zero filled?
   * @param {boolean} [options.unsigned] Is unsigned?
   * @param {string|number} [options.decimals] number of decimal points, used with length `FLOAT(5, 4)`
   * @param {string|number} [options.precision] defines precision for decimal type
   * @param {string|number} [options.scale] defines scale for decimal type
   */
  constructor(options: number | NumberOptions = {}) {
    super();
    if (typeof options === 'number') {
      options = {
        length: options
      };
    }
    this.options = options;
    this._length = options.length;
    this._zerofill = options.zerofill;
    this._decimals = options.decimals;
    this._precision = options.precision;
    this._scale = options.scale;
    this._unsigned = options.unsigned;
  }
  toSql() {
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
  validate(value: number) {
    if (!Validator.isFloat(String(value))) {
      throw new sequelizeErrors.ValidationError(util.format(`%j is not a valid ${this.key.toLowerCase()}`, value));
    }
    return true;
  }
  _stringify(number: any) {
    if (typeof number === 'number' || typeof number === 'boolean' || number === null || number === undefined) {
      return number;
    }
    if (typeof number.toString === 'function') {
      return number.toString();
    }
    return number;
  }

  get UNSIGNED() {
    this._unsigned = true;
    this.options.unsigned = true;
    return this;
  }

  get ZEROFILL() {
    this._zerofill = true;
    this.options.zerofill = true;
    return this;
  }

  static get UNSIGNED() {
    return new this().UNSIGNED;
  }

  static get ZEROFILL() {
    return new this().ZEROFILL;
  }
}

/**
 * A 32 bit integer
 */
class INTEGER extends NUMBER {
  validate(value: number) {
    if (!Validator.isInt(String(value))) {
      throw new sequelizeErrors.ValidationError(util.format(`%j is not a valid ${this.key.toLowerCase()}`, value));
    }
    return true;
  }
}

/**
 * A 8 bit integer
 */
class TINYINT extends INTEGER {
}

/**
 * A 16 bit integer
 */
class SMALLINT extends INTEGER {
}

/**
 * A 24 bit integer
 */
class MEDIUMINT extends INTEGER {
}

/**
 * A 64 bit integer
 */
class BIGINT extends INTEGER {
}

interface FloatOptions {
  length: string | number;
  decimals: string | number;
}

/**
 * Floating point number (4-byte precision).
 */
class FLOAT extends NUMBER {
  /**
   * @param {string|number} [length] length of type, like `FLOAT(4)`
   * @param {string|number} [decimals] number of decimal points, used with length `FLOAT(5, 4)`
   */
  constructor(length: number | string | FloatOptions, decimals: string | number) {
    super(typeof length === 'object' && length || { length, decimals });
  }
  validate(value: number) {
    if (!Validator.isFloat(String(value))) {
      throw new sequelizeErrors.ValidationError(util.format('%j is not a valid float', value));
    }
    return true;
  }
}

/**
 * Floating point number (4-byte precision).
 */
class REAL extends NUMBER {
  /**
   * @param {string|number} [length] length of type, like `REAL(4)`
   * @param {string|number} [decimals] number of decimal points, used with length `REAL(5, 4)`
   */
  constructor(length: number | string | FloatOptions, decimals: string | number) {
    super(typeof length === 'object' && length || { length, decimals });
  }
}

/**
 * Floating point number (8-byte precision).
 */
class DOUBLE extends NUMBER {
  /**
   * @param {string|number} [length] length of type, like `DOUBLE PRECISION(25)`
   * @param {string|number} [decimals] number of decimal points, used with length `DOUBLE PRECISION(25, 10)`
   */
  constructor(length: string | number | FloatOptions, decimals: string | number) {
    super(typeof length === 'object' && length || { length, decimals });
  }
}

interface DecimalOptions {
  /** defines precision */
  precision: string | number;
  /** defines scale */
  scale: string | number;
}

/**
 * Decimal type, variable precision, take length as specified by user
 */
class DECIMAL extends NUMBER {
  /**
   * @param {string|number} [precision] defines precision
   * @param {string|number} [scale] defines scale
   */
  constructor(precision: string | number | DecimalOptions, scale: string | number) {
    super(typeof precision === 'object' && precision || { precision, scale });
  }
  toSql() {
    if (this._precision || this._scale) {
      return `DECIMAL(${[this._precision, this._scale].filter(_.identity).join(',')})`;
    }
    return 'DECIMAL';
  }
  validate(value: number) {
    if (!Validator.isDecimal(String(value))) {
      throw new sequelizeErrors.ValidationError(util.format('%j is not a valid decimal', value));
    }
    return true;
  }
}

// TODO: Create intermediate class
const protoExtensions = {
  escape: false,
  _value(value: number) {
    if (isNaN(value)) {
      return 'NaN';
    }
    if (!isFinite(value)) {
      const sign = value < 0 ? '-' : '';
      return `${sign}Infinity`;
    }

    return value;
  },
  _stringify(value: number) {
    return `'${this._value(value)}'`;
  },
  _bindParam(value: number, options: BindParamOptions) {
    return options.bindParam(this._value(value));
  }
};

for (const floating of [FLOAT, DOUBLE, REAL]) {
  Object.assign(floating.prototype, protoExtensions);
}

/**
 * A boolean / tinyint column, depending on dialect
 */
class BOOLEAN extends ABSTRACT<boolean> {
  toSql() {
    return 'TINYINT(1)';
  }
  validate(value: boolean) {
    if (!Validator.isBoolean(String(value))) {
      throw new sequelizeErrors.ValidationError(util.format('%j is not a valid boolean', value));
    }
    return true;
  }
  _sanitize(value: Buffer | string | number) {
    if (value !== null && value !== undefined) {
      if (Buffer.isBuffer(value) && value.length === 1) {
        // Bit fields are returned as buffers
        value = value[0];
      }
      const type = typeof value;
      if (type === 'string') {
        // Only take action on valid boolean strings.
        return value === 'true' ? true : value === 'false' ? false : value;
      }
      if (type === 'number') {
        // Only take action on valid boolean integers.
        return value === 1 ? true : value === 0 ? false : value;
      }
    }
    return value;
  }
}

BOOLEAN.parse = BOOLEAN.prototype._sanitize;

/**
 * A time column
 *
 */
class TIME extends ABSTRACT {
  toSql() {
    return 'TIME';
  }
}

interface DateOptions {
  length: string | number;
}

/**
 * Date column with timezone, default is UTC
 */
class DATE extends ABSTRACT<Date> {
  protected _length: string | number;
  public options: DateOptions;
  /**
   * @param {string|number} [length] precision to allow storing milliseconds
   */
  constructor(length: string | number | DateOptions) {
    super();
    const options = typeof length === 'object' && length || { length };
    this.options = options;
    this._length = options.length || '';
  }
  toSql() {
    return 'DATETIME';
  }
  validate(value: Date) {
    if (!Validator.isDate(String(value))) {
      throw new sequelizeErrors.ValidationError(util.format('%j is not a valid date', value));
    }
    return true;
  }
  _sanitize(value: Date, options: { raw: boolean }) {
    if ((!options || options && !options.raw) && !(value instanceof Date) && !!value) {
      return new Date(value);
    }
    return value;
  }
  _isChanged(value: Date, originalValue: Date) {
    if (originalValue && !!value &&
      (value === originalValue ||
        value instanceof Date && originalValue instanceof Date && value.getTime() === originalValue.getTime())) {
      return false;
    }
    // not changed when set to same empty value
    if (!originalValue && !value && originalValue === value) {
      return false;
    }
    return true;
  }
  _applyTimezone(date: Moment | Date, options: { timezone: string }) {
    if (options.timezone) {
      if (momentTz.tz.zone(options.timezone)) {
        return momentTz(date).tz(options.timezone);
      }
      return date = moment(date).utcOffset(options.timezone);
    }
    return momentTz(date);
  }
  _stringify(date: Moment | Date, options: { timezone: string }) {
    date = this._applyTimezone(date, options);
    // Z here means current timezone, _not_ UTC
    return date.format('YYYY-MM-DD HH:mm:ss.SSS Z');
  }
}

/**
 * A date only column (no timestamp)
 */
class DATEONLY extends ABSTRACT<Date> {
  toSql() {
    return 'DATE';
  }
  _stringify(date: Date) {
    return moment(date).format('YYYY-MM-DD');
  }
  _sanitize(value: Date, options: { raw: boolean }) {
    if ((!options || options && !options.raw) && !!value) {
      return moment(value).format('YYYY-MM-DD');
    }
    return value;
  }
  _isChanged(value: Date, originalValue: Date) {
    if (originalValue && !!value && originalValue === value) {
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
 * A key / value store column. Only available in Postgres.
 */
class HSTORE extends ABSTRACT<object> {
  validate(value: object) {
    if (!_.isPlainObject(value)) {
      throw new sequelizeErrors.ValidationError(util.format('%j is not a valid hstore', value));
    }
    return true;
  }
}

/**
 * A JSON string column. Available in MySQL, Postgres and SQLite
 */
class JSONTYPE extends ABSTRACT<object> {
  validate() {
    return true;
  }
  _stringify(value: object) {
    return JSON.stringify(value);
  }
}

/**
 * A binary storage JSON column. Only available in Postgres.
 */
class JSONB extends JSONTYPE {}

/**
 * A default value of the current timestamp
 */
class NOW extends ABSTRACT {}

interface BlobOptions {
  length: string;
}

/**
 * Binary storage
 */
class BLOB extends ABSTRACT {
  public escape = false;
  protected _length: string;
  /**
   * @param {string} [length=''] could be tiny, medium, long.
   */
  constructor(length: string | BlobOptions = '') {
    super();
    const options = typeof length === 'object' && length || { length };
    this.options = options;
    this._length = options.length || '';
  }
  toSql() {
    switch (this._length.toLowerCase()) {
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
  validate(value: string | Buffer) {
    if (typeof value !== 'string' && !Buffer.isBuffer(value)) {
      throw new sequelizeErrors.ValidationError(util.format('%j is not a valid blob', value));
    }
    return true;
  }
  _stringify(value: string | Buffer) {
    if (!Buffer.isBuffer(value)) {
      if (Array.isArray(value)) {
        value = Buffer.from(value);
      }
      else {
        value = Buffer.from(value.toString());
      }
    }
    const hex = value.toString('hex');
    return this._hexify(hex);
  }
  _hexify(hex: string) {
    return `X'${hex}'`;
  }
  _bindParam(value: string | any[] | Buffer, options: BindParamOptions) {
    if (!Buffer.isBuffer(value)) {
      if (Array.isArray(value)) {
        value = Buffer.from(value);
      }
      else {
        value = Buffer.from(value.toString());
      }
    }
    return options.bindParam(value);
  }
}

interface RangeOptions {
  subtype: AbstractCtor<any> | ABSTRACT<any>;
}

/**
 * Range types are data types representing a range of values of some element type (called the range's subtype).
 * Only available in Postgres. See [the Postgres documentation](http://www.postgresql.org/docs/9.4/static/rangetypes.html) for more details
 */
class RANGE<T> extends ABSTRACT<T[]> {
  public options: RangeOptions;
  protected _subtype: string;
  /**
   * @param {ABSTRACT} subtype A subtype for range, like RANGE(DATE)
   */
  constructor(subtype: RangeOptions | AbstractCtor) {
    super();
    const options = (_.isPlainObject(subtype) ? subtype : { subtype }) as RangeOptions;
    if (!options.subtype) options.subtype = new INTEGER();
    if (isConstructor(options.subtype)) {
      options.subtype = new options.subtype();
    }
    this._subtype = options.subtype.key;
    this.options = options;
  }
  validate(value: T[]) {
    if (!Array.isArray(value)) {
      throw new sequelizeErrors.ValidationError(util.format('%j is not a valid range', value));
    }
    if (value.length !== 2) {
      throw new sequelizeErrors.ValidationError('A range must be an array with two elements');
    }
    return true;
  }
}

interface UuidOptions {
  acceptStrings: boolean;
}

/**
 * A column storing a unique universal identifier.
 * Use with `UUIDV1` or `UUIDV4` for default values.
 */
class UUID extends ABSTRACT {
  validate(value: string, options: UuidOptions) {
    if (typeof value !== 'string' || !Validator.isUUID(value) && (!options || !options.acceptStrings)) {
      throw new sequelizeErrors.ValidationError(util.format('%j is not a valid uuid', value));
    }
    return true;
  }
}

/**
 * A default unique universal identifier generated following the UUID v1 standard
 */
class UUIDV1 extends ABSTRACT {
  validate(value: string, options: UuidOptions) {
    if (typeof value !== 'string' || !Validator.isUUID(value) && (!options || !options.acceptStrings)) {
      throw new sequelizeErrors.ValidationError(util.format('%j is not a valid uuid', value));
    }
    return true;
  }
}

/**
 * A default unique universal identifier generated following the UUID v4 standard
 */
class UUIDV4 extends ABSTRACT {
  validate(value: string, options: UuidOptions) {
    if (typeof value !== 'string' || !Validator.isUUID(value, 4) && (!options || !options.acceptStrings)) {
      throw new sequelizeErrors.ValidationError(util.format('%j is not a valid uuidv4', value));
    }
    return true;
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
class VIRTUAL<T = string> extends ABSTRACT<T> {
  /** Return type for virtual type */
  public returnType: ABSTRACT<T>;
  /** Array of fields this virtual type is dependent on */
  public fields: string[];

  /**
   * @param {ABSTRACT} [ReturnType] return type for virtual type
   * @param {Array} [fields] array of fields this virtual type is dependent on
   */
  constructor(ReturnType: ABSTRACT<T> | AbstractCtor<T>, fields: string[]) {
    super();
    if (isConstructor(ReturnType)) ReturnType = new ReturnType();
    this.returnType = ReturnType;
    this.fields = fields;
  }
}

interface EnumOptions<T> {
  values: T[];
}

function isEnumOptions<T>(value: EnumOptions<T>[] | T[][]): value is EnumOptions<T>[] {
  return typeof value[0] === 'object' && !Array.isArray(value[0]);
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
class ENUM<T> extends ABSTRACT<T> {
  public values: T[];
  public options: EnumOptions<T>;
  /**
   * @param {...any|{ values: any[] }|any[]} args either array of values or options object with values array. It also supports variadic values
   */
  constructor(...args: EnumOptions<T>[] | T[][]) {
    super();
    let options: EnumOptions<T>;
    if (isEnumOptions(args)) {
      options = args[0];
    } else {
      options = {
        values: args.reduce((result, element) => {
          return result.concat(Array.isArray(element) ? element : [element]);
        })
      };
    }
    this.values = options.values;
    this.options = options;
  }
  validate(value: T) {
    if (!this.values.includes(value)) {
      throw new sequelizeErrors.ValidationError(util.format('%j is not a valid choice in %j', value, this.values));
    }
    return true;
  }
}

interface ArrayOptions<T> {
  type: AbstractCtor<T> | ABSTRACT<T>;
}

/**
 * An array of `type`. Only available in Postgres.
 *
 * @example
 * DataTypes.ARRAY(DataTypes.DECIMAL)
 */
class ARRAY<T> extends ABSTRACT<T[]> {
  public options: ArrayOptions<T>;
  public type: ABSTRACT<T>;
  /**
   * @param {ABSTRACT} type type of array values
   */
  constructor(type: ArrayOptions<T> | AbstractCtor<T>) {
    super();
    const options = (_.isPlainObject(type) ? type : { type }) as ArrayOptions<T>;
    this.options = options;
    this.type = isConstructor(options.type) ? new options.type() : options.type;
  }
  toSql() {
    return `${this.type.toSql()}[]`;
  }
  validate(value: T[]) {
    if (!Array.isArray(value)) {
      throw new sequelizeErrors.ValidationError(util.format('%j is not a valid array', value));
    }
    return true;
  }
  static is(obj: ABSTRACT<unknown>, type: AbstractCtor<unknown>) {
    return obj instanceof ARRAY && obj.type instanceof type;
  }
}

interface GeometryOptions {
  type: string;
  srid: string;
}

/**
 * A column storing Geometry information.
 * It is only available in PostgreSQL (with PostGIS), MariaDB or MySQL.
 *
 * GeoJSON is accepted as input and returned as output.
 *
 * In PostGIS, the GeoJSON is parsed using the PostGIS function `ST_GeomFromGeoJSON`.
 * In MySQL it is parsed using the function `ST_GeomFromText`.
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
 *   coordinates: [-76.984722, 39.807222]; // GeoJson format: [lng, lat]
 *   crs: { type: 'name', properties: { name: 'EPSG:4326'} }
 * };
 *
 * User.create({username: 'username', geometry: point })
 *
 *
 * @see {@link DataTypes.GEOGRAPHY}
 */
class GEOMETRY extends ABSTRACT<object> {
  public escape = false;
  /** Type of geometry data */
  public type: string;
  /** SRID of type */
  public srid: string;
  public options: GeometryOptions;
  /**
   * @param {string} [type] Type of geometry data
   * @param {string} [srid] SRID of type
   */
  constructor(type: string | GeometryOptions, srid?: string) {
    super();
    const options = (_.isPlainObject(type) ? type : { type, srid }) as GeometryOptions;
    this.options = options;
    this.type = options.type;
    this.srid = options.srid;
  }
  _stringify(value: object, options: StringifyOptions) {
    return `ST_GeomFromText(${options.escape(wkx.Geometry.parseGeoJSON(value).toWkt())})`;
  }
  _bindParam(value: object, options: BindParamOptions) {
    return `ST_GeomFromText(${options.bindParam(wkx.Geometry.parseGeoJSON(value).toWkt())})`;
  }
}

interface GeographyOptions {
  type: string;
  srid: string;
}

/**
 * A geography datatype represents two dimensional spacial objects in an elliptic coord system.
 *
 * __The difference from geometry and geography type:__
 *
 * PostGIS 1.5 introduced a new spatial type called geography, which uses geodetic measurement instead of Cartesian measurement.
 * Coordinate points in the geography type are always represented in WGS 84 lon lat degrees (SRID 4326),
 * but measurement functions and relationships ST_Distance, ST_DWithin, ST_Length, and ST_Area always return answers in meters or assume inputs in meters.
 *
 * __What is best to use? It depends:__
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
class GEOGRAPHY extends ABSTRACT<object> {
  public escape = false;
  /** Type of geography data */
  public type: string;
  /** SRID of type */
  public srid: string;
  public options: GeographyOptions;
  /**
   * @param {string} [type] Type of geography data
   * @param {string} [srid] SRID of type
   */
  constructor(type: string | GeographyOptions, srid: string) {
    super();
    const options = (_.isPlainObject(type) ? type : { type, srid }) as GeometryOptions;
    this.options = options;
    this.type = options.type;
    this.srid = options.srid;
  }
  _stringify(value: object, options: StringifyOptions) {
    return `ST_GeomFromText(${options.escape(wkx.Geometry.parseGeoJSON(value).toWkt())})`;
  }
  _bindParam(value: object, options: BindParamOptions) {
    return `ST_GeomFromText(${options.bindParam(wkx.Geometry.parseGeoJSON(value).toWkt())})`;
  }
}

/**
 * The cidr type holds an IPv4 or IPv6 network specification. Takes 7 or 19 bytes.
 *
 * Only available for Postgres
 */
class CIDR extends ABSTRACT {
  validate(value: string) {
    if (typeof value !== 'string' || !Validator.isIPRange(value)) {
      throw new sequelizeErrors.ValidationError(util.format('%j is not a valid CIDR', value));
    }
    return true;
  }
}

/**
 * The INET type holds an IPv4 or IPv6 host address, and optionally its subnet. Takes 7 or 19 bytes
 *
 * Only available for Postgres
 */
class INET extends ABSTRACT {
  validate(value: string) {
    if (typeof value !== 'string' || !Validator.isIP(value)) {
      throw new sequelizeErrors.ValidationError(util.format('%j is not a valid INET', value));
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
class MACADDR extends ABSTRACT {
  validate(value: string) {
    if (typeof value !== 'string' || !Validator.isMACAddress(value)) {
      throw new sequelizeErrors.ValidationError(util.format('%j is not a valid MACADDR', value));
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
class TSVECTOR extends ABSTRACT {
  validate(value: string) {
    if (typeof value !== 'string') {
      throw new sequelizeErrors.ValidationError(util.format('%j is not a valid string', value));
    }
    return true;
  }
}

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
const DataTypes = module.exports = {
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
  TSVECTOR
};

_.each(DataTypes, (dataType, name) => {
  // guard for aliases
  if (!Object.prototype.hasOwnProperty.call(dataType, 'key')) {
    dataType.types = {};
    dataType.key = dataType.prototype.key = name;
  }
});

// TODO: dialect map requires dialect specific maps to have typing information
const dialectMap = {
  postgres: postgresDataTypes(DataTypes),
  mysql: mysqlDataTypes(DataTypes),
  mariadb: mariadbDataTypes(DataTypes),
  sqlite: sqliteDataTypes(DataTypes),
  mssql: mssqlDataTypes(DataTypes),
  db2: db2DataTypes(DataTypes),
  snowflake: snowflakeDataTypes(DataTypes)
};

const dialectList = Object.values(dialectMap);

for (const dataTypes of dialectList) {
  _.each(dataTypes, (DataType, key) => {
    if (!DataType.key) {
      DataType.key = DataType.prototype.key = key;
    }
  });
}

// TODO: dialect map requires dialect specific maps to have typing information
// Wrap all data types to not require `new`
for (const dataTypes of [DataTypes, ...dialectList] as Record<string, any>[]) {
  _.each(dataTypes, (DataType, key) => {
    dataTypes[key] = classToInvokable(DataType);
  });
}

Object.assign(DataTypes, dialectMap);
