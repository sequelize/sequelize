'use strict';

const util = require('util');
const _ = require('lodash');
const wkx = require('wkx');
const sequelizeErrors = require('./errors');
const Validator = require('./utils/validator-extras').validator;
const momentTz = require('moment-timezone');
const moment = require('moment');
const { logger } = require('./utils/logger');
const warnings = {};
const { classToInvokable } = require('./utils/class-to-invokable');
const { joinSQLFragments } = require('./utils/join-sql-fragments');

class ABSTRACT {
  toString(options) {
    return this.toSql(options);
  }
  toSql() {
    return this.key;
  }
  stringify(value, options) {
    if (this._stringify) {
      return this._stringify(value, options);
    }
    return value;
  }
  bindParam(value, options) {
    if (this._bindParam) {
      return this._bindParam(value, options);
    }
    return options.bindParam(this.stringify(value, options));
  }
  static toString() {
    return this.name;
  }
  static warn(link, text) {
    if (!warnings[text]) {
      warnings[text] = true;
      logger.warn(`${text} \n>> Check: ${link}`);
    }
  }
  static extend(oldType) {
    return new this(oldType.options);
  }
}

ABSTRACT.prototype.dialectTypes = '';

/**
 * STRING A variable length string
 */
class STRING extends ABSTRACT {
  /**
   * @param {number} [length=255] length of string
   * @param {boolean} [binary=false] Is this binary?
   */
  constructor(length, binary) {
    super();
    const options = typeof length === 'object' && length || { length, binary };
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
  validate(value) {
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
  constructor(length, binary) {
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
  /**
   * @param {string} [length=''] could be tiny, medium, long.
   */
  constructor(length) {
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
  validate(value) {
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
  validate(value) {
    if (typeof value !== 'string') {
      throw new sequelizeErrors.ValidationError(util.format('%j is not a valid string', value));
    }
    return true;
  }
}

/**
 * Base number type which is used to build other types
 */
class NUMBER extends ABSTRACT {
  /**
   * @param {object} options type options
   * @param {string|number} [options.length] length of type, like `INT(4)`
   * @param {boolean} [options.zerofill] Is zero filled?
   * @param {boolean} [options.unsigned] Is unsigned?
   * @param {string|number} [options.decimals] number of decimal points, used with length `FLOAT(5, 4)`
   * @param {string|number} [options.precision] defines precision for decimal type
   * @param {string|number} [options.scale] defines scale for decimal type
   */
  constructor(options = {}) {
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
  validate(value) {
    if (!Validator.isFloat(String(value))) {
      throw new sequelizeErrors.ValidationError(util.format(`%j is not a valid ${this.key.toLowerCase()}`, value));
    }
    return true;
  }
  _stringify(number) {
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
  validate(value) {
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

/**
 * Floating point number (4-byte precision).
 */
class FLOAT extends NUMBER {
  /**
   * @param {string|number} [length] length of type, like `FLOAT(4)`
   * @param {string|number} [decimals] number of decimal points, used with length `FLOAT(5, 4)`
   */
  constructor(length, decimals) {
    super(typeof length === 'object' && length || { length, decimals });
  }
  validate(value) {
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
  constructor(length, decimals) {
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
  constructor(length, decimals) {
    super(typeof length === 'object' && length || { length, decimals });
  }
}

/**
 * Decimal type, variable precision, take length as specified by user
 */
class DECIMAL extends NUMBER {
  /**
   * @param {string|number} [precision] defines precision
   * @param {string|number} [scale] defines scale
   */
  constructor(precision, scale) {
    super(typeof precision === 'object' && precision || { precision, scale });
  }
  toSql() {
    if (this._precision || this._scale) {
      return `DECIMAL(${[this._precision, this._scale].filter(_.identity).join(',')})`;
    }
    return 'DECIMAL';
  }
  validate(value) {
    if (!Validator.isDecimal(String(value))) {
      throw new sequelizeErrors.ValidationError(util.format('%j is not a valid decimal', value));
    }
    return true;
  }
}

// TODO: Create intermediate class
const protoExtensions = {
  escape: false,
  _value(value) {
    if (isNaN(value)) {
      return 'NaN';
    }
    if (!isFinite(value)) {
      const sign = value < 0 ? '-' : '';
      return `${sign}Infinity`;
    }

    return value;
  },
  _stringify(value) {
    return `'${this._value(value)}'`;
  },
  _bindParam(value, options) {
    return options.bindParam(this._value(value));
  }
};

for (const floating of [FLOAT, DOUBLE, REAL]) {
  Object.assign(floating.prototype, protoExtensions);
}

/**
 * A boolean / tinyint column, depending on dialect
 */
class BOOLEAN extends ABSTRACT {
  toSql() {
    return 'TINYINT(1)';
  }
  validate(value) {
    if (!Validator.isBoolean(String(value))) {
      throw new sequelizeErrors.ValidationError(util.format('%j is not a valid boolean', value));
    }
    return true;
  }
  _sanitize(value) {
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

/**
 * Date column with timezone, default is UTC
 */
class DATE extends ABSTRACT {
  /**
   * @param {string|number} [length] precision to allow storing milliseconds
   */
  constructor(length) {
    super();
    const options = typeof length === 'object' && length || { length };
    this.options = options;
    this._length = options.length || '';
  }
  toSql() {
    return 'DATETIME';
  }
  validate(value) {
    if (!Validator.isDate(String(value))) {
      throw new sequelizeErrors.ValidationError(util.format('%j is not a valid date', value));
    }
    return true;
  }
  _sanitize(value, options) {
    if ((!options || options && !options.raw) && !(value instanceof Date) && !!value) {
      return new Date(value);
    }
    return value;
  }
  _isChanged(value, originalValue) {
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
  _applyTimezone(date, options) {
    if (options.timezone) {
      if (momentTz.tz.zone(options.timezone)) {
        return momentTz(date).tz(options.timezone);
      }
      return date = moment(date).utcOffset(options.timezone);
    }
    return momentTz(date);
  }
  _stringify(date, options) {
    date = this._applyTimezone(date, options);
    // Z here means current timezone, _not_ UTC
    return date.format('YYYY-MM-DD HH:mm:ss.SSS Z');
  }
}

/**
 * A date only column (no timestamp)
 */
class DATEONLY extends ABSTRACT {
  toSql() {
    return 'DATE';
  }
  _stringify(date) {
    return moment(date).format('YYYY-MM-DD');
  }
  _sanitize(value, options) {
    if ((!options || options && !options.raw) && !!value) {
      return moment(value).format('YYYY-MM-DD');
    }
    return value;
  }
  _isChanged(value, originalValue) {
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
class HSTORE extends ABSTRACT {
  validate(value) {
    if (!_.isPlainObject(value)) {
      throw new sequelizeErrors.ValidationError(util.format('%j is not a valid hstore', value));
    }
    return true;
  }
}

/**
 * A JSON string column. Available in MySQL, Postgres and SQLite
 */
class JSONTYPE extends ABSTRACT {
  validate() {
    return true;
  }
  _stringify(value) {
    return JSON.stringify(value);
  }
}

/**
 * A binary storage JSON column. Only available in Postgres.
 */
class JSONB extends JSONTYPE {
}

/**
 * A default value of the current timestamp
 */
class NOW extends ABSTRACT {
}

/**
 * Binary storage
 */
class BLOB extends ABSTRACT {
  /**
   * @param {string} [length=''] could be tiny, medium, long.
   */
  constructor(length) {
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
  validate(value) {
    if (typeof value !== 'string' && !Buffer.isBuffer(value)) {
      throw new sequelizeErrors.ValidationError(util.format('%j is not a valid blob', value));
    }
    return true;
  }
  _stringify(value) {
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
  _hexify(hex) {
    return `X'${hex}'`;
  }
  _bindParam(value, options) {
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


BLOB.prototype.escape = false;

/**
 * Range types are data types representing a range of values of some element type (called the range's subtype).
 * Only available in Postgres. See [the Postgres documentation](http://www.postgresql.org/docs/9.4/static/rangetypes.html) for more details
 */
class RANGE extends ABSTRACT {
  /**
   * @param {ABSTRACT} subtype A subtype for range, like RANGE(DATE)
   */
  constructor(subtype) {
    super();
    const options = _.isPlainObject(subtype) ? subtype : { subtype };
    if (!options.subtype)
      options.subtype = new INTEGER();
    if (typeof options.subtype === 'function') {
      options.subtype = new options.subtype();
    }
    this._subtype = options.subtype.key;
    this.options = options;
  }
  validate(value) {
    if (!Array.isArray(value)) {
      throw new sequelizeErrors.ValidationError(util.format('%j is not a valid range', value));
    }
    if (value.length !== 2) {
      throw new sequelizeErrors.ValidationError('A range must be an array with two elements');
    }
    return true;
  }
}

/**
 * A column storing a unique universal identifier.
 * Use with `UUIDV1` or `UUIDV4` for default values.
 */
class UUID extends ABSTRACT {
  validate(value, options) {
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
  validate(value, options) {
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
  validate(value, options) {
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
class VIRTUAL extends ABSTRACT {
  /**
   * @param {ABSTRACT} [ReturnType] return type for virtual type
   * @param {Array} [fields] array of fields this virtual type is dependent on
   */
  constructor(ReturnType, fields) {
    super();
    if (typeof ReturnType === 'function')
      ReturnType = new ReturnType();
    this.returnType = ReturnType;
    this.fields = fields;
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
class ENUM extends ABSTRACT {
  /**
   * @param {...any|{ values: any[] }|any[]} args either array of values or options object with values array. It also supports variadic values
   */
  constructor(...args) {
    super();
    const value = args[0];
    const options = typeof value === 'object' && !Array.isArray(value) && value || {
      values: args.reduce((result, element) => {
        return result.concat(Array.isArray(element) ? element : [element]);
      }, [])
    };
    this.values = options.values;
    this.options = options;
  }
  validate(value) {
    if (!this.values.includes(value)) {
      throw new sequelizeErrors.ValidationError(util.format('%j is not a valid choice in %j', value, this.values));
    }
    return true;
  }
}

/**
 * An array of `type`. Only available in Postgres.
 *
 * @example
 * DataTypes.ARRAY(DataTypes.DECIMAL)
 */
class ARRAY extends ABSTRACT {
  /**
   * @param {ABSTRACT} type type of array values
   */
  constructor(type) {
    super();
    const options = _.isPlainObject(type) ? type : { type };
    this.options = options;
    this.type = typeof options.type === 'function' ? new options.type() : options.type;
  }
  toSql() {
    return `${this.type.toSql()}[]`;
  }
  validate(value) {
    if (!Array.isArray(value)) {
      throw new sequelizeErrors.ValidationError(util.format('%j is not a valid array', value));
    }
    return true;
  }
  static is(obj, type) {
    return obj instanceof ARRAY && obj.type instanceof type;
  }
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
 * const point = { type: 'Point', coordinates: [39.807222,-76.984722]};
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
 *   coordinates: [39.807222,-76.984722],
 *   crs: { type: 'name', properties: { name: 'EPSG:4326'} }
 * };
 *
 * User.create({username: 'username', geometry: point })
 *
 *
 * @see {@link DataTypes.GEOGRAPHY}
 */
class GEOMETRY extends ABSTRACT {
  /**
   * @param {string} [type] Type of geometry data
   * @param {string} [srid] SRID of type
   */
  constructor(type, srid) {
    super();
    const options = _.isPlainObject(type) ? type : { type, srid };
    this.options = options;
    this.type = options.type;
    this.srid = options.srid;
  }
  _stringify(value, options) {
    return `ST_GeomFromText(${options.escape(wkx.Geometry.parseGeoJSON(value).toWkt())})`;
  }
  _bindParam(value, options) {
    return `ST_GeomFromText(${options.bindParam(wkx.Geometry.parseGeoJSON(value).toWkt())})`;
  }
}

GEOMETRY.prototype.escape = false;

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
class GEOGRAPHY extends ABSTRACT {
  /**
   * @param {string} [type] Type of geography data
   * @param {string} [srid] SRID of type
   */
  constructor(type, srid) {
    super();
    const options = _.isPlainObject(type) ? type : { type, srid };
    this.options = options;
    this.type = options.type;
    this.srid = options.srid;
  }
  _stringify(value, options) {
    return `ST_GeomFromText(${options.escape(wkx.Geometry.parseGeoJSON(value).toWkt())})`;
  }
  _bindParam(value, options) {
    return `ST_GeomFromText(${options.bindParam(wkx.Geometry.parseGeoJSON(value).toWkt())})`;
  }
}


GEOGRAPHY.prototype.escape = false;

/**
 * The cidr type holds an IPv4 or IPv6 network specification. Takes 7 or 19 bytes.
 *
 * Only available for Postgres
 */
class CIDR extends ABSTRACT {
  validate(value) {
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
  validate(value) {
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
  validate(value) {
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
  validate(value) {
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

const dialectMap = {};
dialectMap.postgres = require('./dialects/postgres/data-types')(DataTypes);
dialectMap.mysql = require('./dialects/mysql/data-types')(DataTypes);
dialectMap.mariadb = require('./dialects/mariadb/data-types')(DataTypes);
dialectMap.sqlite = require('./dialects/sqlite/data-types')(DataTypes);
dialectMap.mssql = require('./dialects/mssql/data-types')(DataTypes);

const dialectList = Object.values(dialectMap);

for (const dataTypes of dialectList) {
  _.each(dataTypes, (DataType, key) => {
    if (!DataType.key) {
      DataType.key = DataType.prototype.key = key;
    }
  });
}

// Wrap all data types to not require `new`
for (const dataTypes of [DataTypes, ...dialectList]) {
  _.each(dataTypes, (DataType, key) => {
    dataTypes[key] = classToInvokable(DataType);
  });
}

Object.assign(DataTypes, dialectMap);
