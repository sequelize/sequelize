'use strict';
/*jshint -W110 */

var util = require('util')
  , _ = require('lodash')
  , Wkt = require('wellknown')
  , sequelizeErrors = require('./errors')
  , warnings = {}
  , Validator = require('validator')
  , moment = require('moment-timezone');

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

ABSTRACT.prototype.dialectTypes = '';

ABSTRACT.prototype.toString = function(options) {
  return this.toSql(options);
};
ABSTRACT.prototype.toSql = function() {
  return this.key;
};
ABSTRACT.warn = function(link, text) {
  if (!warnings[text]) {
    warnings[text] = true;
    console.warn('>> WARNING:', text, '\n>> Check:', link);
  }
};
ABSTRACT.prototype.stringify = function (value, options) {
  if (this.$stringify) {
    return this.$stringify(value, options);
  }
  return value;
};

ABSTRACT.inherits = function (Constructor) {
  var baseType = this;

  if (!Constructor) {
    Constructor = function () {
      if (!(this instanceof Constructor)) {
        var args = [null].concat(arguments);
        var FactoryFunction = Constructor.bind.apply(Constructor, args);
        return new FactoryFunction();
      }
      baseType.apply(this, arguments);
    };
  }

  util.inherits(Constructor, baseType); // Instance (prototype) methods
  _.extend(Constructor, this); // Static methods

  return Constructor;
};


/**
 * A variable length string. Default length 255
 *
 * Available properties: `BINARY`
 *
 * @property STRING
 */
var STRING = ABSTRACT.inherits(function(length, binary) {
  var options = typeof length === 'object' && length || {
    length: length,
    binary: binary
  };

  if (!(this instanceof STRING)) return new STRING(options);

  this.options = options;
  this._binary = options.binary;
  this._length = options.length || 255;
});

STRING.prototype.key = STRING.key = 'STRING';
STRING.prototype.toSql = function() {
  return 'VARCHAR(' + this._length + ')' + ((this._binary) ? ' BINARY' : '');
};
STRING.prototype.validate = function(value) {
  if (Object.prototype.toString.call(value) !== '[object String]') {
    if ((this.options.binary && Buffer.isBuffer(value)) || _.isNumber(value)) {
      return true;
    }
    throw new sequelizeErrors.ValidationError(util.format('%j is not a valid string', value));
  }

  return true;
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
var CHAR = STRING.inherits(function(length, binary) {
  var options = typeof length === 'object' && length || {
    length: length,
    binary: binary
  };

  if (!(this instanceof CHAR)) return new CHAR(options);
  STRING.apply(this, arguments);
});

CHAR.prototype.key = CHAR.key = 'CHAR';
CHAR.prototype.toSql = function() {
  return 'CHAR(' + this._length + ')' + ((this._binary) ? ' BINARY' : '');
};

/**
 * An (un)limited length text column. Available lengths: `tiny`, `medium`, `long`
 * @property TEXT
 */
var TEXT = ABSTRACT.inherits(function(length) {
  var options = typeof length === 'object' && length || {
    length: length
  };
  if (!(this instanceof TEXT)) return new TEXT(options);
  this.options = options;
  this._length = options.length || '';
});

TEXT.prototype.key = TEXT.key = 'TEXT';
TEXT.prototype.toSql = function() {
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
};
TEXT.prototype.validate = function(value) {
  if (typeof value !== 'string') {
    throw new sequelizeErrors.ValidationError(util.format('%j is not a valid string', value));
   }

  return true;
};

var NUMBER = ABSTRACT.inherits(function(options) {
  this.options = options;
  this._length = options.length;
  this._zerofill = options.zerofill;
  this._decimals = options.decimals;
  this._precision = options.precision;
  this._scale = options.scale;
  this._unsigned = options.unsigned;
});

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
NUMBER.prototype.validate = function(value) {
  if (!_.isNumber(value)) {
    throw new sequelizeErrors.ValidationError(util.format('%j is not a valid number', value));
  }

  return true;
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
var INTEGER = NUMBER.inherits(function(length) {
  var options = typeof length === 'object' && length || {
    length: length
  };
  if (!(this instanceof INTEGER)) return new INTEGER(options);
  NUMBER.call(this, options);
});

INTEGER.prototype.key = INTEGER.key = 'INTEGER';
INTEGER.prototype.validate = function(value) {
  if (!Validator.isInt(value)) {
    throw new sequelizeErrors.ValidationError(util.format('%j is not a valid integer', value));
  }

  return true;
};

/**
 * A 64 bit integer.
 *
 * Available properties: `UNSIGNED`, `ZEROFILL`
 *
 * @property BIGINT
 */

var BIGINT = NUMBER.inherits(function(length) {
  var options = typeof length === 'object' && length || {
    length: length
  };
  if (!(this instanceof BIGINT)) return new BIGINT(options);
  NUMBER.call(this, options);
});

BIGINT.prototype.key = BIGINT.key = 'BIGINT';
BIGINT.prototype.validate = function(value) {
  if (!Validator.isInt(value)) {
    throw new sequelizeErrors.ValidationError(util.format('%j is not a valid bigint', value));
  }

  return true;
};

/**
 * Floating point number (4-byte precision). Accepts one or two arguments for precision
 *
 * Available properties: `UNSIGNED`, `ZEROFILL`
 *
 * @property FLOAT
 */
var FLOAT = NUMBER.inherits(function(length, decimals) {
  var options = typeof length === 'object' && length || {
    length: length,
    decimals: decimals
  };
  if (!(this instanceof FLOAT)) return new FLOAT(options);
  NUMBER.call(this, options);
});

FLOAT.prototype.key = FLOAT.key = 'FLOAT';
FLOAT.prototype.validate = function(value) {
  if (!Validator.isFloat(value)) {
    throw new sequelizeErrors.ValidationError(util.format('%j is not a valid float', value));
  }

  return true;
};

/**
 * Floating point number (4-byte precision). Accepts one or two arguments for precision
 *
 * Available properties: `UNSIGNED`, `ZEROFILL`
 *
 * @property REAL
 */
var REAL = NUMBER.inherits(function(length, decimals) {
  var options = typeof length === 'object' && length || {
    length: length,
    decimals: decimals
  };
  if (!(this instanceof REAL)) return new REAL(options);
  NUMBER.call(this, options);
});

REAL.prototype.key = REAL.key = 'REAL';

/**
 * Floating point number (8-byte precision). Accepts one or two arguments for precision
 *
 * Available properties: `UNSIGNED`, `ZEROFILL`
 *
 * @property DOUBLE
 */
var DOUBLE = NUMBER.inherits(function(length, decimals) {
  var options = typeof length === 'object' && length || {
    length: length,
    decimals: decimals
  };
  if (!(this instanceof DOUBLE)) return new DOUBLE(options);
  NUMBER.call(this, options);
});

DOUBLE.prototype.key = DOUBLE.key = 'DOUBLE PRECISION';

/**
 * Decimal number. Accepts one or two arguments for precision
 *
 * Available properties: `UNSIGNED`, `ZEROFILL`
 *
 * @property DECIMAL
 */
var DECIMAL = NUMBER.inherits(function(precision, scale) {
  var options = typeof precision === 'object' && precision || {
    precision: precision,
    scale: scale
  };
  if (!(this instanceof DECIMAL)) return new DECIMAL(options);
  NUMBER.call(this, options);
});

DECIMAL.prototype.key = DECIMAL.key = 'DECIMAL';
DECIMAL.prototype.toSql = function() {
  if (this._precision || this._scale) {
    return 'DECIMAL(' + [this._precision, this._scale].filter(_.identity).join(',') + ')';
  }

  return 'DECIMAL';
};
DECIMAL.prototype.validate = function(value) {
  if (!Validator.isDecimal(value)) {
    throw new sequelizeErrors.ValidationError(util.format('%j is not a valid decimal', value));
  }

  return true;
};

/**
 * A boolean / tinyint column, depending on dialect
 * @property BOOLEAN
 */
var BOOLEAN = ABSTRACT.inherits();

BOOLEAN.prototype.key = BOOLEAN.key = 'BOOLEAN';
BOOLEAN.prototype.toSql = function() {
  return 'TINYINT(1)';
};
BOOLEAN.prototype.validate = function(value) {
  if (!Validator.isBoolean(value)) {
    throw new sequelizeErrors.ValidationError(util.format('%j is not a valid boolean', value));
  }

  return true;
};

/**
 * A time column
 * @property TIME
 */

var TIME = ABSTRACT.inherits();

TIME.prototype.key = TIME.key = 'TIME';
TIME.prototype.toSql = function() {
  return 'TIME';
};

/**
 * A datetime column
 * @property DATE
 */
var DATE = ABSTRACT.inherits(function (length) {
  var options = typeof length === 'object' && length || {
      length: length
    };

  if (!(this instanceof DATE)) return new DATE(options);

  this.options = options;
  this._length = options.length || '';
});

DATE.prototype.key = DATE.key = 'DATE';
DATE.prototype.toSql = function() {
  return 'DATETIME';
};
DATE.prototype.validate = function(value) {
  if (!Validator.isDate(value)) {
    throw new sequelizeErrors.ValidationError(util.format('%j is not a valid date', value));
  }

  return true;
};

DATE.prototype.$applyTimezone = function (date, options) {
  date = moment(date);

  if (options.timezone) {
    if (moment.tz.zone(options.timezone)) {
      date = date.tz(options.timezone);
    } else {
      date = date.utcOffset(options.timezone);
    }
  }

  return date;
};

DATE.prototype.$stringify = function (date, options) {
  date = this.$applyTimezone(date, options);

  // Z here means current timezone, _not_ UTC
  return date.format('YYYY-MM-DD HH:mm:ss.SSS Z');
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

var HSTORE = ABSTRACT.inherits();

HSTORE.prototype.key = HSTORE.key = 'HSTORE';
HSTORE.prototype.validate = function(value) {
  if (!_.isPlainObject(value)) {
    throw new sequelizeErrors.ValidationError(util.format('%j is not a valid hstore', value));
  }

  return true;
};

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
JSONTYPE.prototype.validate = function(value) {
  return true;
};

JSONTYPE.prototype.$stringify = function (value, options) {
  return JSON.stringify(value);
};

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
var NOW = ABSTRACT.inherits();

NOW.prototype.key = NOW.key = 'NOW';

/**
 * Binary storage. Available lengths: `tiny`, `medium`, `long`
 *
 * @property BLOB
 */

var BLOB = ABSTRACT.inherits(function(length) {
  var options = typeof length === 'object' && length || {
    length: length
  };
  if (!(this instanceof BLOB)) return new BLOB(options);
  this.options = options;
  this._length = options.length || '';
});

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
BLOB.prototype.validate = function(value) {
  if (!_.isString(value) && !Buffer.isBuffer(value)) {
    throw new sequelizeErrors.ValidationError(util.format('%j is not a valid blob', value));
  }

  return true;
};

BLOB.prototype.escape = false;
BLOB.prototype.$stringify = function (value) {
  if (!Buffer.isBuffer(value)) {
    value = new Buffer(value);
  }
  var hex = value.toString('hex');

  return this.$hexify(hex);
};

BLOB.prototype.$hexify = function (hex) {
  return "X'" + hex + "'";
};

/**
 * Range types are data types representing a range of values of some element type (called the range's subtype).
 * Only available in postgres.
 * See {@link http://www.postgresql.org/docs/9.4/static/rangetypes.html|Postgres documentation} for more details
 * @property RANGE
 */

var RANGE = ABSTRACT.inherits(function (subtype) {
  var options = _.isPlainObject(subtype) ? subtype : { subtype: subtype };

  if (!options.subtype) options.subtype = new INTEGER();

  if (_.isFunction(options.subtype)) {
    options.subtype = new options.subtype();
  }

  if (!(this instanceof RANGE)) return new RANGE(options);
  ABSTRACT.apply(this, arguments);

  this._subtype = options.subtype.key;
  this.options = options;
});

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
RANGE.prototype.validate = function(value) {
  if (_.isPlainObject(value) && value.inclusive) {
    value = value.inclusive;
  }

  if (!_.isArray(value)) {
    throw new sequelizeErrors.ValidationError(util.format('%j is not a valid range', value));
  }

  if (value.length !== 2) {
    throw new sequelizeErrors.ValidationError('A range must be an array with two elements');
  }

  return true;
};


/**
 * A column storing a unique univeral identifier. Use with `UUIDV1` or `UUIDV4` for default values.
 * @property UUID
 */
var UUID = ABSTRACT.inherits();

UUID.prototype.key = UUID.key = 'UUID';
UUID.prototype.validate = function(value) {
  if (!Validator.isUUID(value)) {
    throw new sequelizeErrors.ValidationError(util.format('%j is not a valid uuid', value));
  }

  return true;
};

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
UUIDV1.prototype.validate = function(value) {
  if (!Validator.isUUID(value)) {
    throw new sequelizeErrors.ValidationError(util.format('%j is not a valid uuid', value));
  }

  return true;
};

/**
 * A default unique universal identifier generated following the UUID v4 standard
 * @property UUIDV4
 */

var UUIDV4 = function() {
  if (!(this instanceof UUIDV4)) return new UUIDV4();
  ABSTRACT.apply(this, arguments);
};
util.inherits(UUIDV4, ABSTRACT);

UUIDV4.prototype.key = UUIDV4.key = 'UUIDV4';
UUIDV4.prototype.validate = function(value) {
  if (!Validator.isUUID(value, 4)) {
    throw new sequelizeErrors.ValidationError(util.format('%j is not a valid uuidv4', value));
  }

  return true;
};

/**
 * A virtual value that is not stored in the DB. This could for example be useful if you want to provide a default value in your model that is returned to the user but not stored in the DB.
 *
 * You could also use it to validate a value before permuting and storing it. Checking password length before hashing it for example:
 * ```js
 * sequelize.define('user', {
 *   password_hash: DataTypes.STRING,
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
 *
 * VIRTUAL also takes a return type and dependency fields as arguments
 * If a virtual attribute is present in `attributes` it will automatically pull in the extra fields aswell.
 * Return type is mostly usefull for setups that rely on types like GraphQL.
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
 *
 * In the above code the password is stored plainly in the password field so it can be validated, but is never stored in the DB.
 * @property VIRTUAL
 * @alias NONE
 */
var VIRTUAL = function(ReturnType, fields) {
  if (!(this instanceof VIRTUAL)) return new VIRTUAL(ReturnType, fields);
  if (typeof ReturnType === 'function') ReturnType = new ReturnType();

  this.returnType = ReturnType;
  this.fields = fields;
};
util.inherits(VIRTUAL, ABSTRACT);

VIRTUAL.prototype.key = VIRTUAL.key = 'VIRTUAL';

/**
 * An enumeration. `DataTypes.ENUM('value', 'another value')`.
 *
 * @property ENUM
 */
var ENUM = ABSTRACT.inherits(function(value) {
  var options = typeof value === 'object' && !Array.isArray(value) && value || {
    values: Array.prototype.slice.call(arguments).reduce(function(result, element) {
      return result.concat(Array.isArray(element) ? element : [element]);
    }, [])
  };
  if (!(this instanceof ENUM)) return new ENUM(options);
  this.values = options.values;
  this.options = options;
});

ENUM.prototype.key = ENUM.key = 'ENUM';
ENUM.prototype.validate = function(value) {
  if (!_.contains(this.values, value)) {
    throw new sequelizeErrors.ValidationError(util.format('%j is not a valid choice in %j', value, this.values));
  }

  return true;
};

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
ARRAY.prototype.validate = function(value) {
  if (!Array.isArray(value)) {
    throw new sequelizeErrors.ValidationError(util.format('%j is not a valid array', value));
  }

  return true;
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

var GEOMETRY = ABSTRACT.inherits(function(type, srid) {
  var options = _.isPlainObject(type) ? type : {
    type: type,
    srid: srid
  };

  if (!(this instanceof GEOMETRY)) return new GEOMETRY(options);

  this.options = options;
  this.type = options.type;
  this.srid = options.srid;
});

GEOMETRY.prototype.key = GEOMETRY.key = 'GEOMETRY';

GEOMETRY.prototype.escape = false;
GEOMETRY.prototype.$stringify = function (value) {
  return 'GeomFromText(\'' + Wkt.stringify(value) + '\')';
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

var dataTypes = {
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
  'DOUBLE PRECISION': DOUBLE,
  GEOMETRY: GEOMETRY
};

_.each(dataTypes, function (dataType) {
  dataType.types = {};
});

dataTypes.postgres = require('./dialects/postgres/data-types')(dataTypes);
dataTypes.mysql = require('./dialects/mysql/data-types')(dataTypes);
dataTypes.sqlite = require('./dialects/sqlite/data-types')(dataTypes);
dataTypes.mssql = require('./dialects/mssql/data-types')(dataTypes);

module.exports = dataTypes;
