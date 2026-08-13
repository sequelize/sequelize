import { format } from 'node:util';
import { classToInvokable } from './utils/class-to-invokable.js';
import _ from 'lodash';
import { geojsonToWKT } from '@terraformer/wkt';
import * as sequelizeErrors from './errors.js';
import { validator as Validator } from './utils/validator-extras.js';
import * as Timezone from './utils/timezone.js';
import * as Utils from './utils.js';
import definePostgresDataTypes from './dialects/postgres/data-types.js';

const warnings = {};

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

  /**
   * Required once the types are proxy-wrapped: `Function.prototype.toString` on a
   * Proxy yields `function () { [native code] }` for every type, so without this
   * any code using a data type as an object key would collide them all together.
   */
  static toString() {
    return this.name;
  }

  static warn(link, text) {
    if (!warnings[text]) {
      warnings[text] = true;
      Utils.warn(`${text}, '\n>> Check:', ${link}`);
    }
  }

  /**
   * Build a dialect-specific type from a base one. `new this(...)` resolves to
   * the subclass being extended, so every type inherits this without declaring
   * its own.
   */
  static extend(oldType) {
    return new this(oldType.options);
  }
}

class STRING extends ABSTRACT {
  static key = 'STRING';

  constructor(length, binary) {
    super();

    const options = (typeof length === 'object' && length) || { length, binary };

    this.options = options;
    this._binary = options.binary;
    this._length = options.length || 255;
  }

  get BINARY() {
    this._binary = true;
    this.options.binary = true;

    return this;
  }

  // `this` in a static getter is the subclass being accessed, so CHAR.BINARY
  // builds a CHAR rather than a STRING.
  static get BINARY() {
    return new this().BINARY;
  }

  toSql() {
    return 'VARCHAR(' + this._length + ')' + (this._binary ? ' BINARY' : '');
  }

  validate(value) {
    if (Object.prototype.toString.call(value) !== '[object String]') {
      if ((this.options.binary && Buffer.isBuffer(value)) || typeof value === 'number') {
        return true;
      }
      throw new sequelizeErrors.ValidationError(format('%j is not a valid string', value));
    }

    return true;
  }
}

class CHAR extends STRING {
  static key = 'CHAR';

  toSql() {
    return 'CHAR(' + this._length + ')' + (this._binary ? ' BINARY' : '');
  }
}

class TEXT extends ABSTRACT {
  static key = 'TEXT';

  constructor(length) {
    super();

    const options = (typeof length === 'object' && length) || { length };

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
      throw new sequelizeErrors.ValidationError(format('%j is not a valid string', value));
    }

    return true;
  }
}

class NUMBER extends ABSTRACT {
  static key = 'NUMBER';

  constructor(options = {}) {
    super();

    this.options = options;
    this._length = options.length;
    this._zerofill = options.zerofill;
    this._decimals = options.decimals;
    this._precision = options.precision;
    this._scale = options.scale;
    this._unsigned = options.unsigned;
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

  toSql() {
    let result = this.key;
    if (this._length) {
      result += '(' + this._length;
      if (typeof this._decimals === 'number') {
        result += ',' + this._decimals;
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
      throw new sequelizeErrors.ValidationError(format('%j is not a valid ' + _.toLower(this.key), value));
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
}

class INTEGER extends NUMBER {
  static key = 'INTEGER';

  constructor(length) {
    super((typeof length === 'object' && length) || { length });
  }

  validate(value) {
    if (!Validator.isInt(String(value))) {
      throw new sequelizeErrors.ValidationError(format('%j is not a valid ' + _.toLower(this.key), value));
    }

    return true;
  }
}

class TINYINT extends INTEGER {
  static key = 'TINYINT';
}

class SMALLINT extends INTEGER {
  static key = 'SMALLINT';
}

class MEDIUMINT extends INTEGER {
  static key = 'MEDIUMINT';
}

class BIGINT extends INTEGER {
  static key = 'BIGINT';
}

class FLOAT extends NUMBER {
  static key = 'FLOAT';

  constructor(length, decimals) {
    super((typeof length === 'object' && length) || { length, decimals });
  }

  validate(value) {
    if (!Validator.isFloat(String(value))) {
      throw new sequelizeErrors.ValidationError(format('%j is not a valid float', value));
    }

    return true;
  }
}

class REAL extends NUMBER {
  static key = 'REAL';

  constructor(length, decimals) {
    super((typeof length === 'object' && length) || { length, decimals });
  }
}

class DOUBLE extends NUMBER {
  static key = 'DOUBLE PRECISION';

  constructor(length, decimals) {
    super((typeof length === 'object' && length) || { length, decimals });
  }
}

class DECIMAL extends NUMBER {
  static key = 'DECIMAL';

  constructor(precision, scale) {
    super((typeof precision === 'object' && precision) || { precision, scale });
  }

  toSql() {
    if (this._precision || this._scale) {
      return 'DECIMAL(' + [this._precision, this._scale].filter(Boolean).join(',') + ')';
    }

    return 'DECIMAL';
  }

  validate(value) {
    if (!Validator.isDecimal(String(value))) {
      throw new sequelizeErrors.ValidationError(format('%j is not a valid decimal', value));
    }

    return true;
  }
}

for (const floating of [FLOAT, DOUBLE, REAL]) {
  floating.prototype.escape = false;
  floating.prototype._stringify = function _stringify(value) {
    if (isNaN(value)) {
      return "'NaN'";
    } else if (!isFinite(value)) {
      const sign = value < 0 ? '-' : '';
      return "'" + sign + "Infinity'";
    }

    return value;
  };
}

class BOOLEAN extends ABSTRACT {
  static key = 'BOOLEAN';

  toSql() {
    return 'TINYINT(1)';
  }

  validate(value) {
    if (!Validator.isBoolean(String(value))) {
      throw new sequelizeErrors.ValidationError(format('%j is not a valid boolean', value));
    }

    return true;
  }

  _sanitize(value) {
    if (value !== null && value !== undefined) {
      if (Buffer.isBuffer(value) && value.length === 1) {
        // Bit fields are returned as buffers
        value = value[0];
      }

      if (typeof value === 'string') {
        // Only take action on valid boolean strings.
        value = value === 'true' ? true : value === 'false' ? false : value;
      } else if (typeof value === 'number') {
        // Only take action on valid boolean integers.
        value = value === 1 ? true : value === 0 ? false : value;
      }
    }

    return value;
  }
}
BOOLEAN.parse = BOOLEAN.prototype._sanitize;

class TIME extends ABSTRACT {
  static key = 'TIME';

  toSql() {
    return 'TIME';
  }
}

class DATE extends ABSTRACT {
  static key = 'DATE';

  constructor(length) {
    super();

    const options = (typeof length === 'object' && length) || { length };

    this.options = options;
    this._length = options.length || '';
  }

  toSql() {
    return 'DATETIME';
  }

  validate(value) {
    if (!Validator.isDate(String(value))) {
      throw new sequelizeErrors.ValidationError(format('%j is not a valid date', value));
    }

    return true;
  }

  _sanitize(value, options) {
    if ((!options || (options && !options.raw)) && !(value instanceof Date) && !!value) {
      return new Date(value);
    }

    return value;
  }

  _isChanged(value, originalValue) {
    if (
      originalValue &&
      !!value &&
      (value === originalValue ||
        (value instanceof Date && originalValue instanceof Date && value.getTime() === originalValue.getTime()))
    ) {
      return false;
    }

    // not changed when set to same empty value
    if (!originalValue && !value && originalValue === value) {
      return false;
    }

    return true;
  }

  /**
   * The UTC offset `date` should be rendered at, in minutes east of UTC.
   *
   * `options.timezone` is either an IANA zone name, whose offset depends on the
   * instant, or a fixed UTC offset. With neither, the host's local offset is used.
   *
   * @param {Date} date - the instant being rendered
   * @param {Object} options - query options, optionally carrying `timezone`
   * @returns {number} minutes east of UTC
   * @private
   */
  _applyTimezone(date, options) {
    const timezone = options.timezone;

    if (!timezone) {
      return -new Date(date).getTimezoneOffset();
    }

    return Timezone.isIanaZone(timezone)
      ? Timezone.zoneOffsetMinutes(date, timezone)
      : (Timezone.parseOffsetMinutes(timezone) ?? 0);
  }

  _stringify(date, options) {
    // A where clause reaches stringify without passing through _sanitize, so the
    // value is not necessarily a Date yet
    const value = Timezone.toDate(date);

    // The trailing offset is the configured timezone, _not_ UTC
    return Timezone.formatWithOffset(value, this._applyTimezone(value, options));
  }
}

class DATEONLY extends ABSTRACT {
  static key = 'DATEONLY';

  toSql() {
    return 'DATE';
  }

  _stringify(date) {
    return Timezone.formatDateOnly(date);
  }

  _sanitize(value, options) {
    if ((!options || (options && !options.raw)) && !!value) {
      return Timezone.formatDateOnly(value);
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

class HSTORE extends ABSTRACT {
  static key = 'HSTORE';

  validate(value) {
    if (!_.isPlainObject(value)) {
      throw new sequelizeErrors.ValidationError(format('%j is not a valid hstore', value));
    }

    return true;
  }
}

class JSONTYPE extends ABSTRACT {
  static key = 'JSON';

  validate() {
    return true;
  }

  _stringify(value) {
    return JSON.stringify(value);
  }
}

class JSONB extends JSONTYPE {
  static key = 'JSONB';
}

class NOW extends ABSTRACT {
  static key = 'NOW';
}

class BLOB extends ABSTRACT {
  static key = 'BLOB';

  constructor(length) {
    super();

    const options = (typeof length === 'object' && length) || { length };

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
      throw new sequelizeErrors.ValidationError(format('%j is not a valid blob', value));
    }

    return true;
  }

  _stringify(value) {
    if (!Buffer.isBuffer(value)) {
      if (Array.isArray(value)) {
        value = Buffer.from(value);
      } else {
        value = Buffer.from(value.toString());
      }
    }
    const hex = value.toString('hex');

    return this._hexify(hex);
  }

  _hexify(hex) {
    return "X'" + hex + "'";
  }
}

BLOB.prototype.escape = false;

class RANGE extends ABSTRACT {
  static key = 'RANGE';

  constructor(subtype) {
    super();

    const options = _.isPlainObject(subtype) ? subtype : { subtype };

    if (!options.subtype) {
      options.subtype = new INTEGER();
    }

    if (typeof options.subtype === 'function') {
      options.subtype = new options.subtype();
    }

    this._subtype = options.subtype.key;
    this.options = options;
  }

  // `pgRangeSubtypes` / `pgRangeCastTypes` are declared below; they are read at
  // call time, not when the class is defined.
  toSql() {
    return pgRangeSubtypes[this._subtype.toLowerCase()];
  }

  toCastType() {
    return pgRangeCastTypes[this._subtype.toLowerCase()];
  }

  validate(value) {
    if (_.isPlainObject(value) && value.inclusive) {
      value = value.inclusive;
    }

    if (!Array.isArray(value)) {
      throw new sequelizeErrors.ValidationError(format('%j is not a valid range', value));
    }

    if (value.length !== 2) {
      throw new sequelizeErrors.ValidationError('A range must be an array with two elements');
    }

    return true;
  }
}

const pgRangeSubtypes = {
  integer: 'int4range',
  bigint: 'int8range',
  decimal: 'numrange',
  dateonly: 'daterange',
  date: 'tstzrange',
  datenotz: 'tsrange'
};

const pgRangeCastTypes = {
  integer: 'integer',
  bigint: 'bigint',
  decimal: 'numeric',
  dateonly: 'date',
  date: 'timestamptz',
  datenotz: 'timestamp'
};

class UUID extends ABSTRACT {
  static key = 'UUID';

  validate(value, options) {
    if (typeof value !== 'string' || (!Validator.isUUID(value) && (!options || !options.acceptStrings))) {
      throw new sequelizeErrors.ValidationError(format('%j is not a valid uuid', value));
    }

    return true;
  }
}

class UUIDV1 extends ABSTRACT {
  static key = 'UUIDV1';

  validate(value, options) {
    if (typeof value !== 'string' || (!Validator.isUUID(value) && (!options || !options.acceptStrings))) {
      throw new sequelizeErrors.ValidationError(format('%j is not a valid uuid', value));
    }

    return true;
  }
}

class UUIDV4 extends ABSTRACT {
  static key = 'UUIDV4';

  validate(value, options) {
    if (typeof value !== 'string' || (!Validator.isUUID(value, 4) && (!options || !options.acceptStrings))) {
      throw new sequelizeErrors.ValidationError(format('%j is not a valid uuidv4', value));
    }

    return true;
  }
}

class VIRTUAL extends ABSTRACT {
  static key = 'VIRTUAL';

  constructor(ReturnType, fields) {
    super();

    if (typeof ReturnType === 'function') {
      ReturnType = new ReturnType();
    }

    this.returnType = ReturnType;
    this.fields = fields;
  }
}

class ENUM extends ABSTRACT {
  static key = 'ENUM';

  constructor(...args) {
    super();

    const [value] = args;
    const options = (typeof value === 'object' && !Array.isArray(value) && value) || {
      values: args.reduce((result, element) => {
        return result.concat(Array.isArray(element) ? element : [element]);
      }, [])
    };

    this.values = options.values;
    this.options = options;
  }

  validate(value) {
    if (!this.values.includes(value)) {
      throw new sequelizeErrors.ValidationError(format('%j is not a valid choice in %j', value, this.values));
    }

    return true;
  }
}

class ARRAY extends ABSTRACT {
  static key = 'ARRAY';

  constructor(type) {
    super();

    const options = _.isPlainObject(type) ? type : { type };

    this.type = typeof options.type === 'function' ? new options.type() : options.type;
  }

  toSql() {
    return this.type.toSql() + '[]';
  }

  validate(value) {
    if (!Array.isArray(value)) {
      throw new sequelizeErrors.ValidationError(format('%j is not a valid array', value));
    }

    return true;
  }

  static is(obj, type) {
    return obj instanceof ARRAY && obj.type instanceof type;
  }
}

class GEOMETRY extends ABSTRACT {
  static key = 'GEOMETRY';

  constructor(type, srid) {
    super();

    const options = _.isPlainObject(type) ? type : { type, srid };

    this.options = options;
    this.type = options.type;
    this.srid = options.srid;
  }

  _stringify(value, options) {
    return 'GeomFromText(' + options.escape(geojsonToWKT(value)) + ')';
  }
}
GEOMETRY.prototype.escape = false;

class GEOGRAPHY extends ABSTRACT {
  static key = 'GEOGRAPHY';

  constructor(type, srid) {
    super();

    const options = _.isPlainObject(type) ? type : { type, srid };

    this.options = options;
    this.type = options.type;
    this.srid = options.srid;
  }

  _stringify(value, options) {
    return 'GeomFromText(' + options.escape(geojsonToWKT(value)) + ')';
  }
}
GEOGRAPHY.prototype.escape = false;

class CIDR extends ABSTRACT {
  static key = 'CIDR';

  validate(value) {
    if (typeof value !== 'string' || !Validator.isIPRange(value)) {
      throw new sequelizeErrors.ValidationError(format('%j is not a valid CIDR', value));
    }

    return true;
  }
}

class INET extends ABSTRACT {
  static key = 'INET';

  validate(value) {
    if (typeof value !== 'string' || !Validator.isIP(value)) {
      throw new sequelizeErrors.ValidationError(format('%j is not a valid INET', value));
    }

    return true;
  }
}

class MACADDR extends ABSTRACT {
  static key = 'MACADDR';

  validate(value) {
    if (typeof value !== 'string' || !Validator.isMACAddress(value)) {
      throw new sequelizeErrors.ValidationError(format('%j is not a valid MACADDR', value));
    }

    return true;
  }
}

/**
 * A convenience class holding commonly used data types. The datatypes are used when defining a new model using `Sequelize.define`, like this:
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
 *
 * Three of the values provided here (`NOW`, `UUIDV1` and `UUIDV4`) are special default values, that should not be used to define types. Instead they are used as shorthands for
 * defining default values. For example, to get a uuid field with a default value generated following v1 of the UUID standard:
 * ```js`
 * sequelize.define('model',` {
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
 *
 * @property {function(length=255: integer)} STRING A variable length string
 * @property {function(length=255: integer)} CHAR A fixed length string.
 * @property {function(length: string)} TEXT An unlimited length text column. Available lengths: `tiny`, `medium`, `long`
 * @property {function(length: integer)} TINYINT A 8 bit integer.
 * @property {function(length: integer)} SMALLINT A 16 bit integer.
 * @property {function(length: integer)} MEDIUMINT A 24 bit integer.
 * @property {function(length=255: integer)} INTEGER A 32 bit integer.
 * @property {function(length: integer)} BIGINT A 64 bit integer. Note: an attribute defined as `BIGINT` will be treated like a `string` due this [feature from node-postgres](https://github.com/brianc/node-postgres/pull/353) to prevent precision loss. To have this attribute as a `number`, this is a possible [workaround](https://github.com/sequelize/sequelize/issues/2383#issuecomment-58006083).
 * @property {function(length: integer, decimals: integer)} FLOAT Floating point number (4-byte precision).
 * @property {function(length: integer, decimals: integer)} DOUBLE Floating point number (8-byte precision).
 * @property {function(precision: integer, scale: integer)} DECIMAL Decimal number.
 * @property {function(length: integer, decimals: integer)} REAL Floating point number (4-byte precision).
 * @property {function} BOOLEAN A boolean / tinyint column, depending on dialect
 * @property {function(length: string)} BLOB Binary storage. Available lengths: `tiny`, `medium`, `long`
 * @property {function(values: string[])} ENUM An enumeration. `DataTypes.ENUM('value', 'another value')`.
 * @property {function(length: integer)} DATE A datetime column
 * @property {function} DATEONLY A date only column (no timestamp)
 * @property {function} TIME A time column
 * @property {function} NOW A default value of the current timestamp
 * @property {function} UUID A column storing a unique universal identifier. Use with `UUIDV1` or `UUIDV4` for default values.
 * @property {function} UUIDV1 A default unique universal identifier generated following the UUID v1 standard
 * @property {function} UUIDV4 A default unique universal identifier generated following the UUID v4 standard
 * @property {function} HSTORE A key / value store column. Only available in Postgres.
 * @property {function} JSON A JSON string column.
 * @property {function} JSONB A binary storage JSON column. Only available in Postgres.
 * @property {function(type: DataTypes)} ARRAY An array of `type`, e.g. `DataTypes.ARRAY(DataTypes.DECIMAL)`. Only available in Postgres.
 * @property {function(type: DataTypes)} RANGE Range types are data types representing a range of values of some element type (called the range's subtype).
 * Only available in Postgres. See [the Postgres documentation](http://www.postgresql.org/docs/9.4/static/rangetypes.html) for more details
 * @property {function(type: string, srid: string)} GEOMETRY A column storing Geometry information. Requires PostGIS.
 *
 * GeoJSON is accepted as input and returned as output.
 * In PostGIS, the GeoJSON is parsed using the PostGIS function `ST_GeomFromGeoJSON`.
 * Therefore, one can just follow the [GeoJSON spec](http://geojson.org/geojson-spec.html) for handling geometry objects.  See the following examples:
 *
 * ```js
 * // Create a new point:
 * const point = { type: 'Point', coordinates: [39.807222,-76.984722]};
 *
 * User.create({username: 'username', geometry: point });
 *
 * // Create a new linestring:
 * const line = { type: 'LineString', 'coordinates': [ [100.0, 0.0], [101.0, 1.0] ] };
 *
 * User.create({username: 'username', geometry: line });
 *
 * // Create a new polygon:
 * const polygon = { type: 'Polygon', coordinates: [
 *                 [ [100.0, 0.0], [101.0, 0.0], [101.0, 1.0],
 *                   [100.0, 1.0], [100.0, 0.0] ]
 *                 ]};
 *
 * User.create({username: 'username', geometry: polygon });

 * // Create a new point with a custom SRID:
 * const point = {
 *   type: 'Point',
 *   coordinates: [39.807222,-76.984722],
 *   crs: { type: 'name', properties: { name: 'EPSG:4326'} }
 * };
 *
 * User.create({username: 'username', geometry: point })
 * ```
 * @property {function(type: string, srid: string)} GEOGRAPHY A geography datatype represents two dimensional spacial objects in an elliptic coord system.
 * @property {function(returnType: DataTypes, fields: string[])} VIRTUAL A virtual value that is not stored in the DB. This could for example be useful if you want to provide a default value in your model that is returned to the user but not stored in the DB.
 *
 * You could also use it to validate a value before permuting and storing it. Checking password length before hashing it for example:
 * ```js
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
 * In the above code the password is stored plainly in the password field so it can be validated, but is never stored in the DB.
 *
 * VIRTUAL also takes a return type and dependency fields as arguments
 * If a virtual attribute is present in `attributes` it will automatically pull in the extra fields as well.
 * Return type is mostly useful for setups that rely on types like GraphQL.
 * ```js
 * {
 *   active: {
 *     type: new DataTypes.VIRTUAL(DataTypes.BOOLEAN, ['createdAt']),
 *     get: function() {
 *       return this.get('createdAt') > Date.now() - (7 * 24 * 60 * 60 * 1000)
 *     }
 *   }
 * }
 * ```
 */
const DataTypes = {
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
  NONE: VIRTUAL,
  ENUM,
  RANGE,
  REAL,
  DOUBLE,
  'DOUBLE PRECISION': DOUBLE,
  GEOMETRY,
  GEOGRAPHY,
  CIDR,
  INET,
  MACADDR
};

// Each type declares `static key`; mirror it onto the prototype as a plain
// writable property. Sequelize's documented contract for custom types is
// `SOMETYPE.prototype.key = SOMETYPE.key = 'SOMETYPE'`, so `key` must stay
// assignable rather than becoming an accessor.
// Own-property check, not `!dataType.prototype.key`: subclasses inherit `key`
// through the class chain, so a plain lookup would skip every subclass.
for (const dataType of Object.values(DataTypes)) {
  if (!Object.hasOwn(dataType.prototype, 'key')) {
    dataType.prototype.key = dataType.key;
  }
}

for (const dataType of Object.values(DataTypes)) {
  dataType.types = {};
}

// The dialect types subclass these, so they must still be plain classes here:
// `class PgTEXT extends BaseTypes.TEXT` calls `super()`, which on a wrapped base
// would hit the proxy's construct trap and hand back a *base* instance as `this`.
const dialectTypes = definePostgresDataTypes(DataTypes);

// Data types are public API and may be used bare (`DataTypes.STRING`), called
// (`DataTypes.STRING(255)`) or constructed (`new DataTypes.STRING(255)`). Classes
// throw when called without `new`, so wrap each one -- after the dialect types
// have been built, exactly as Sequelize v6 does.
for (const map of [DataTypes, dialectTypes]) {
  for (const [name, dataType] of Object.entries(map)) {
    map[name] = classToInvokable(dataType);
  }
}

DataTypes.postgres = dialectTypes;

export default DataTypes;
