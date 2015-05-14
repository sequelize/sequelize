'use strict';

var util = require('util')
  , _ = require('lodash');

/**
 * A convenience class holding commonly used data types. The datatypes are used when definining a new model using `Sequelize.define`, like this:
 * ```js
 * sequelize.define('model', {
 *   column: DataTypes.INTEGER
 * })
 * ```
 * When defining a model you can just as easily pass a string as type, but often using the types defined here is beneficial. For example, using `DataTypes.BLOB`, mean
 * that that column will be returned as an instance of `Buffer` when being fetched by sequelize.
 *
 * Some data types have special properties that can be accessed in order to change the data type.
 * For example, to get an unsigned integer with zerofill you can do `DataTypes.INTEGER.UNSIGNED.ZEROFILL`.
 * The order you access the properties in do not matter, so `DataTypes.INTEGER.ZEROFILL.UNSIGNED` is fine as well. The available properties are listed under each data type.
 *
 * To provide a length for the data type, you can invoke it like a function: `INTEGER(2)`
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
 *
 * @class DataTypes
 */

var ABSTRACT = function(options) {

};

ABSTRACT.prototype.toString = function() {
  return this.toSql();
};
ABSTRACT.prototype.toSql = function() {
  return this.key;
};

/**
 * A variable length string. Default length 255
 *
 * Available properties: `BINARY`
 *
 * @property STRING
 */
var STRING = function(length, binary) {
  var options = typeof length === 'object' && length || {
    length: length,
    binary: binary
  };

  if (!(this instanceof STRING)) return new STRING(options);

  this.options = options;
  this._binary = options.binary;
  this._length = options.length || 255;
};
util.inherits(STRING, ABSTRACT);

STRING.prototype.key = STRING.key = 'STRING';
STRING.prototype.toSql = function() {
  return 'VARCHAR(' + this._length + ')' + ((this._binary) ? ' BINARY' : '');
};
Object.defineProperty(STRING.prototype, 'BINARY', {
  get: function() {
    this._binary = true;
    this.options.binary = true;
    return this;
  }
});

/**
 * A fixed length string. Default length 255
 *
 * Available properties: `BINARY`
 *
 * @property CHAR
 */
var CHAR = function(length, binary) {
  var options = typeof length === 'object' && length || {
    length: length,
    binary: binary
  };

  if (!(this instanceof CHAR)) return new CHAR(options);
  STRING.apply(this, arguments);
};
util.inherits(CHAR, STRING);

CHAR.prototype.key = CHAR.key = 'CHAR';
CHAR.prototype.toSql = function() {
  return 'CHAR(' + this._length + ')' + ((this._binary) ? ' BINARY' : '');
};


/**
 * An unlimited length text column
 * @property TEXT
 */
var TEXT = function(options) {
  if (!(this instanceof TEXT)) return new TEXT(options);
};
util.inherits(TEXT, ABSTRACT);

TEXT.prototype.key = TEXT.key = 'TEXT';


var NUMBER = function(options) {
  this.options = options;
  this._length = options.length;
  this._zerofill = options.zerofill;
  this._decimals = options.decimals;
  this._precision = options.precision;
  this._scale = options.scale;
  this._unsigned = options.unsigned;
};
util.inherits(NUMBER, ABSTRACT);

NUMBER.prototype.key = NUMBER.key = 'NUMBER';
NUMBER.prototype.toSql = function() {
  var result = this.key;
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
};

Object.defineProperty(NUMBER.prototype, 'UNSIGNED', {
  get: function() {
    this._unsigned = true;
    this.options.unsigned = true;
    return this;
  }
});
Object.defineProperty(NUMBER.prototype, 'ZEROFILL', {
  get: function() {
    this._zerofill = true;
    this.options.zerofill = true;
    return this;
  }
});

/**
 * A 32 bit integer.
 *
 * Available properties: `UNSIGNED`, `ZEROFILL`
 *
 * @property INTEGER
 */
var INTEGER = function(length) {
  var options = typeof length === 'object' && length || {
    length: length
  };
  if (!(this instanceof INTEGER)) return new INTEGER(options);
  NUMBER.call(this, options);
};
util.inherits(INTEGER, NUMBER);

INTEGER.prototype.key = INTEGER.key = 'INTEGER';

/**
 * A 64 bit integer.
 *
 * Available properties: `UNSIGNED`, `ZEROFILL`
 *
 * @property BIGINT
 */

var BIGINT = function(length) {
  var options = typeof length === 'object' && length || {
    length: length
  };
  if (!(this instanceof BIGINT)) return new BIGINT(options);
  NUMBER.call(this, options);
};
util.inherits(BIGINT, NUMBER);

BIGINT.prototype.key = BIGINT.key = 'BIGINT';

/**
 * Floating point number (4-byte precision). Accepts one or two arguments for precision
 *
 * Available properties: `UNSIGNED`, `ZEROFILL`
 *
 * @property FLOAT
 */
var FLOAT = function(length, decimals) {
  var options = typeof length === 'object' && length || {
    length: length,
    decimals: decimals
  };
  if (!(this instanceof FLOAT)) return new FLOAT(options);
  NUMBER.call(this, options);
};
util.inherits(FLOAT, NUMBER);

FLOAT.prototype.key = FLOAT.key = 'FLOAT';

/**
 * Floating point number (4-byte precision). Accepts one or two arguments for precision
 *
 * Available properties: `UNSIGNED`, `ZEROFILL`
 *
 * @property REAL
 */
var REAL = function(length, decimals) {
  var options = typeof length === 'object' && length || {
    length: length,
    decimals: decimals
  };
  if (!(this instanceof REAL)) return new REAL(options);
  NUMBER.call(this, options);
};
util.inherits(REAL, NUMBER);

REAL.prototype.key = REAL.key = 'REAL';

/**
 * Floating point number (8-byte precision). Accepts one or two arguments for precision
 *
 * Available properties: `UNSIGNED`, `ZEROFILL`
 *
 * @property DOUBLE
 */
var DOUBLE = function(length, decimals) {
  var options = typeof length === 'object' && length || {
    length: length,
    decimals: decimals
  };
  if (!(this instanceof DOUBLE)) return new DOUBLE(options);
  NUMBER.call(this, options);
};
util.inherits(DOUBLE, NUMBER);

DOUBLE.prototype.key = DOUBLE.key = 'DOUBLE PRECISION';

/**
 * Decimal number. Accepts one or two arguments for precision
 *
 * Available properties: `UNSIGNED`, `ZEROFILL`
 *
 * @property DECIMAL
 */
var DECIMAL = function(precision, scale) {
  var options = typeof precision === 'object' && precision || {
    precision: precision,
    scale: scale
  };
  if (!(this instanceof DECIMAL)) return new DECIMAL(options);
  NUMBER.call(this, options);
};
util.inherits(DECIMAL, NUMBER);

DECIMAL.prototype.key = DECIMAL.key = 'DECIMAL';
DECIMAL.prototype.toSql = function() {
  if (this._precision || this._scale) {
    return 'DECIMAL(' + [this._precision, this._scale].filter(_.identity).join(',') + ')';
  }

  return 'DECIMAL';
};

/**
 * A boolean / tinyint column, depending on dialect
 * @property BOOLEAN
 */
var BOOLEAN = function() {
  if (!(this instanceof BOOLEAN)) return new BOOLEAN();
  ABSTRACT.apply(this, arguments);
};
util.inherits(BOOLEAN, ABSTRACT);

BOOLEAN.prototype.key = BOOLEAN.key = 'BOOLEAN';
BOOLEAN.prototype.toSql = function() {
  return 'TINYINT(1)';
};

/**
 * A time column
 * @property TIME
 */

var TIME = function() {
  if (!(this instanceof TIME)) return new TIME();
  ABSTRACT.apply(this, arguments);
};
util.inherits(TIME, ABSTRACT);

TIME.prototype.key = TIME.key = 'TIME';
TIME.prototype.toSql = function() {
  return 'TIME';
};

/**
 * A datetime column
 * @property DATE
 */
var DATE = function() {
  if (!(this instanceof DATE)) return new DATE();
  ABSTRACT.apply(this, arguments);
};
util.inherits(DATE, ABSTRACT);

DATE.prototype.key = DATE.key = 'DATE';
DATE.prototype.toSql = function() {
  return 'DATETIME';
};

/**
 * A date only column
 * @property DATEONLY
 */

var DATEONLY = function() {
  if (!(this instanceof DATEONLY)) return new DATEONLY();
  ABSTRACT.apply(this, arguments);
};
util.inherits(DATEONLY, ABSTRACT);

DATEONLY.prototype.key = DATEONLY.key = 'DATEONLY';
DATEONLY.prototype.toSql = function() {
  return 'DATE';
};

/**
 * A key / value column. Only available in postgres.
 * @property HSTORE
 */

var HSTORE = function() {
  if (!(this instanceof HSTORE)) return new HSTORE();
  ABSTRACT.apply(this, arguments);
};
util.inherits(HSTORE, ABSTRACT);

HSTORE.prototype.key = HSTORE.key = 'HSTORE';

/**
 * A JSON string column. Only available in postgres.
 * @property JSON
 */
var JSONTYPE = function() {
  if (!(this instanceof JSONTYPE)) return new JSONTYPE();
  ABSTRACT.apply(this, arguments);
};
util.inherits(JSONTYPE, ABSTRACT);

JSONTYPE.prototype.key = JSONTYPE.key = 'JSON';

/**
 * A pre-processed JSON data column. Only available in postgres.
 * @property JSONB
 */
var JSONB = function() {
  if (!(this instanceof JSONB)) return new JSONB();
  JSONTYPE.apply(this, arguments);
};
util.inherits(JSONB, JSONTYPE);

JSONB.prototype.key = JSONB.key = 'JSONB';

/**
 * A default value of the current timestamp
 * @property NOW
 */
var NOW = function() {
  if (!(this instanceof NOW)) return new NOW();
  ABSTRACT.apply(this, arguments);
};
util.inherits(NOW, ABSTRACT);

NOW.prototype.key = NOW.key = 'NOW';

/**
 * Binary storage. Available lengths: `tiny`, `medium`, `long`
 *
 * @property BLOB
 */

var BLOB = function(length) {
  var options = typeof length === 'object' && length || {
    length: length
  };
  if (!(this instanceof BLOB)) return new BLOB(options);
  this._length = options.length || '';
};
util.inherits(BLOB, ABSTRACT);

BLOB.prototype.key = BLOB.key = 'BLOB';
BLOB.prototype.toSql = function() {
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
};

/**
 * Range types are data types representing a range of values of some element type (called the range's subtype).
 * Only available in postgres.
 * See {@link http://www.postgresql.org/docs/9.4/static/rangetypes.html|Postgres documentation} for more details
 * @property RANGE
 */

var RANGE = function (subtype) {
  var options = _.isPlainObject(subtype) ? subtype : { subtype: subtype };

  if (!options.subtype) options.subtype = INTEGER;

  if (!(this instanceof RANGE)) return new RANGE(options);
  ABSTRACT.apply(this, arguments);

  this._subtype = options.subtype.key;
};
util.inherits(RANGE, ABSTRACT);

var pgRangeSubtypes = {
  integer: 'int4range',
  bigint: 'int8range',
  decimal: 'numrange',
  dateonly: 'daterange',
  date: 'tstzrange'
};

RANGE.prototype.key = RANGE.key = 'RANGE';
RANGE.prototype.toSql = function() {
  return pgRangeSubtypes[this._subtype.toLowerCase()];
};

/**
 * A column storing a unique univeral identifier. Use with `UUIDV1` or `UUIDV4` for default values.
 * @property UUID
 */
var UUID = function() {
  if (!(this instanceof UUID)) return new UUID();
  ABSTRACT.apply(this, arguments);
};
util.inherits(UUID, ABSTRACT);

UUID.prototype.key = UUID.key = 'UUID';

/**
 * A default unique universal identifier generated following the UUID v1 standard
 * @property UUIDV1
 */

var UUIDV1 = function() {
  if (!(this instanceof UUIDV1)) return new UUIDV1();
  ABSTRACT.apply(this, arguments);
};
util.inherits(UUIDV1, ABSTRACT);

UUIDV1.prototype.key = UUIDV1.key = 'UUIDV1';

/**
 * A default unique universal identifier generated following the UUID v2 standard
 * @property UUIDV4
 */

var UUIDV4 = function() {
  if (!(this instanceof UUIDV4)) return new UUIDV4();
  ABSTRACT.apply(this, arguments);
};
util.inherits(UUIDV4, ABSTRACT);

UUIDV4.prototype.key = UUIDV4.key = 'UUIDV4';

/**
 * A virtual value that is not stored in the DB. This could for example be useful if you want to provide a default value in your model that is returned to the user but not stored in the DB.
 *
 * You could also use it to validate a value before permuting and storing it. Checking password length before hashing it for example:
 * ```js
 * sequelize.define('user', {
 *   password_hash: DataTypes.STRING
 *   password: {
 *     type: DataTypes.VIRTUAL,
 *     set: function (val) {
 *        this.setDataValue('password', val); // Remember to set the data value, otherwise it won't be validated
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
 * @property VIRTUAL
 * @alias NONE
 */
var VIRTUAL = function() {
  if (!(this instanceof VIRTUAL)) return new VIRTUAL();
  ABSTRACT.apply(this, arguments);
};
util.inherits(VIRTUAL, ABSTRACT);

VIRTUAL.prototype.key = VIRTUAL.key = 'VIRTUAL';

/**
 * An enumeration. `DataTypes.ENUM('value', 'another value')`.
 *
 * @property ENUM
 */
var ENUM = function(value) {
  var options = typeof value === 'object' && !Array.isArray(value) && value || {
    values: Array.prototype.slice.call(arguments).reduce(function(result, element) {
      return result.concat(Array.isArray(element) ? element : [element]);
    }, [])
  };
  if (!(this instanceof ENUM)) return new ENUM(options);
  this.values = options.values;
};
util.inherits(ENUM, ABSTRACT);

ENUM.prototype.key = ENUM.key = 'ENUM';

/**
 * An array of `type`, e.g. `DataTypes.ARRAY(DataTypes.DECIMAL)`. Only available in postgres.
 * @property ARRAY
 */
var ARRAY = function(type) {
  var options = _.isPlainObject(type) ? type : {
    type: type
  };
  if (!(this instanceof ARRAY)) return new ARRAY(options);
  this.type = typeof options.type === 'function' ? new options.type() : options.type;
};
util.inherits(ARRAY, ABSTRACT);

ARRAY.prototype.key = ARRAY.key = 'ARRAY';
ARRAY.prototype.toSql = function() {
  return this.type.toSql() + '[]';
};
ARRAY.is = function(obj, type) {
  return obj instanceof ARRAY && obj.type instanceof type;
};

var helpers = {
  BINARY: [STRING, CHAR],
  UNSIGNED: [NUMBER, INTEGER, BIGINT, FLOAT, DOUBLE, REAL],
  ZEROFILL: [NUMBER, INTEGER, BIGINT, FLOAT, DOUBLE, REAL],
  PRECISION: [DECIMAL],
  SCALE: [DECIMAL]
};

Object.keys(helpers).forEach(function (helper) {
  helpers[helper].forEach(function (DataType) {
    if (!DataType[helper]) {
      Object.defineProperty(DataType, helper, {
        get: function() {
          var dataType = new DataType();
          if (typeof dataType[helper] === 'object') {
            return dataType;
          }
          return dataType[helper].apply(dataType, arguments);
        }
      });
    }
  });
});

module.exports = {
  ABSTRACT: ABSTRACT,
  STRING: STRING,
  CHAR: CHAR,
  TEXT: TEXT,
  NUMBER: NUMBER,
  INTEGER: INTEGER,
  BIGINT: BIGINT,
  FLOAT: FLOAT,
  TIME: TIME,
  DATE: DATE,
  DATEONLY: DATEONLY,
  BOOLEAN: BOOLEAN,
  NOW: NOW,
  BLOB: BLOB,
  DECIMAL: DECIMAL,
  NUMERIC: DECIMAL,
  UUID: UUID,
  UUIDV1: UUIDV1,
  UUIDV4: UUIDV4,
  HSTORE: HSTORE,
  JSON: JSONTYPE,
  JSONB: JSONB,
  VIRTUAL: VIRTUAL,
  ARRAY: ARRAY,
  NONE: VIRTUAL,
  ENUM: ENUM,
  RANGE: RANGE,
  REAL: REAL,
  DOUBLE: DOUBLE,
  'DOUBLE PRECISION': DOUBLE
};
