'use strict';

var STRING = function(length, binary) {
  if (this instanceof STRING) {
    this._binary = !!binary;
    if (typeof length === 'number') {
      this._length = length;
    } else {
      this._length = 255;
    }
  } else {
    return new STRING(length, binary);
  }
};

var CHAR = function(length, binary) {
  if (this instanceof CHAR) {
    this._binary = !!binary;
    if (typeof length === 'number') {
      this._length = length;
    } else {
      this._length = 255;
    }
  } else {
    return new CHAR(length, binary);
  }
};

STRING.prototype = {
  get BINARY() {
    this._binary = true;
    return this;
  },
  get type() {
    return this.toString();
  },
  toString: function() {
    return 'VARCHAR(' + this._length + ')' + ((this._binary) ? ' BINARY' : '');
  }
};

CHAR.prototype = {
  get BINARY() {
    this._binary = true;
    return this;
  },
  get type() {
    return this.toString();
  },
  toString: function() {
    return 'CHAR(' + this._length + ')' + ((this._binary) ? ' BINARY' : '');
  }
};

Object.defineProperty(STRING, 'BINARY', {
  get: function() {
    return new STRING(undefined, true);
  }
});

Object.defineProperty(CHAR, 'BINARY', {
  get: function() {
    return new CHAR(undefined, true);
  }
});

var INTEGER = function() {
  return INTEGER.prototype.construct.apply(this, [INTEGER].concat(Array.prototype.slice.apply(arguments)));
};

var BIGINT = function() {
  return BIGINT.prototype.construct.apply(this, [BIGINT].concat(Array.prototype.slice.apply(arguments)));
};

var FLOAT = function() {
  return FLOAT.prototype.construct.apply(this, [FLOAT].concat(Array.prototype.slice.apply(arguments)));
};

var BLOB = function() {
  return BLOB.prototype.construct.apply(this, [BLOB].concat(Array.prototype.slice.apply(arguments)));
};

var DECIMAL = function() {
  return DECIMAL.prototype.construct.apply(this, [DECIMAL].concat(Array.prototype.slice.apply(arguments)));
};

var VIRTUAL = function() {

};

FLOAT._type = FLOAT;
FLOAT._typeName = 'FLOAT';
INTEGER._type = INTEGER;
INTEGER._typeName = 'INTEGER';
BIGINT._type = BIGINT;
BIGINT._typeName = 'BIGINT';
STRING._type = STRING;
STRING._typeName = 'VARCHAR';
CHAR._type = CHAR;
CHAR._typeName = 'CHAR';
BLOB._type = BLOB;
BLOB._typeName = 'BLOB';
DECIMAL._type = DECIMAL;
DECIMAL._typeName = 'DECIMAL';


BLOB.toString = STRING.toString = CHAR.toString = INTEGER.toString = FLOAT.toString = BIGINT.toString = DECIMAL.toString = function() {
  return new this._type().toString();
};

BLOB.prototype = {

  construct: function(RealType, length) {
    if (this instanceof RealType) {
      this._typeName = RealType._typeName;
      if (typeof length === 'string') {
        this._length = length;
      } else {
        this._length = '';
      }
    } else {
      return new RealType(length);
    }
  },

  get type() {
    return this.toString();
  },

  toString: function() {
    switch (this._length.toLowerCase()) {
    case 'tiny':
      return 'TINYBLOB';
    case 'medium':
      return 'MEDIUMBLOB';
    case 'long':
      return 'LONGBLOB';
    default:
      return this._typeName;
    }
  }
};

FLOAT.prototype = BIGINT.prototype = INTEGER.prototype = {

  construct: function(RealType, length, decimals, unsigned, zerofill) {
    if (this instanceof RealType) {
      this._typeName = RealType._typeName;
      this._unsigned = !!unsigned;
      this._zerofill = !!zerofill;
      if (typeof length === 'number') {
        this._length = length;
      }
      if (typeof decimals === 'number') {
        this._decimals = decimals;
      }
    } else {
      return new RealType(length, decimals, unsigned, zerofill);
    }
  },

  get type() {
    return this.toString();
  },

  get UNSIGNED() {
    this._unsigned = true;
    return this;
  },

  get ZEROFILL() {
    this._zerofill = true;
    return this;
  },

  toString: function() {
    var result = this._typeName;
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
};

DECIMAL.prototype = {

  construct: function(RealType, precision, scale) {
    if (this instanceof RealType) {
      this._typeName = RealType._typeName;
      if (typeof precision === 'number') {
        this._precision = precision;
      } else {
        this._precision = 0;
      }
      if (typeof scale === 'number') {
        this._scale = scale;
      } else {
        this._scale = 0;
      }
    } else {
      return new RealType(precision, scale);
    }
  },

  get type() {
    return this.toString();
  },

  get PRECISION() {
    return this._precision;
  },

  get SCALE() {
    return this._scale;
  },

  toString: function() {
    if (this._precision || this._scale) {
      return 'DECIMAL(' + this._precision + ',' + this._scale + ')';
    }

    return 'DECIMAL';
  }
};

var unsignedDesc = {
  get: function() {
    return new this._type(undefined, undefined, true);
  }
};

var zerofillDesc = {
  get: function() {
    return new this._type(undefined, undefined, undefined, true);
  }
};

var typeDesc = {
  get: function() {
    return new this._type().toString();
  }
};

var decimalDesc = {
  get: function() {
    return new this._type(undefined, undefined, undefined);
  }
};

Object.defineProperty(STRING, 'type', typeDesc);
Object.defineProperty(CHAR, 'type', typeDesc);
Object.defineProperty(INTEGER, 'type', typeDesc);
Object.defineProperty(BIGINT, 'type', typeDesc);
Object.defineProperty(FLOAT, 'type', typeDesc);
Object.defineProperty(BLOB, 'type', typeDesc);
Object.defineProperty(DECIMAL, 'type', typeDesc);

Object.defineProperty(INTEGER, 'UNSIGNED', unsignedDesc);
Object.defineProperty(BIGINT, 'UNSIGNED', unsignedDesc);
Object.defineProperty(FLOAT, 'UNSIGNED', unsignedDesc);

Object.defineProperty(INTEGER, 'ZEROFILL', zerofillDesc);
Object.defineProperty(BIGINT, 'ZEROFILL', zerofillDesc);
Object.defineProperty(FLOAT, 'ZEROFILL', zerofillDesc);

Object.defineProperty(DECIMAL, 'PRECISION', decimalDesc);
Object.defineProperty(DECIMAL, 'SCALE', decimalDesc);


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
 * Some data types have special properties that can be accessed in order to change the data type. For example, to get an unsigned integer with zerofill you can do `DataTypes.INTEGER.UNSIGNED.ZEROFILL`.
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
module.exports = {
  /**
   * A variable length string. Default length 255
   *
   * Available properties: `BINARY`
   *
   * @property STRING
   */
  STRING: STRING,
  /** 
   * A fixed length string. Default length 255
   *
   * Available properties: `BINARY`
   * 
   * @property CHAR
   */
  CHAR: CHAR,
  /**
   * An unlimited length text column
   * @property TEXT
   */
  TEXT: 'TEXT',
  /**
   * A 32 bit integer.
   *
   * Available properties: `UNSIGNED`, `ZEROFILL`
   *
   * @property INTEGER
   */
  INTEGER: INTEGER,
  /**
   * A 64 bit integer.
   *
   * Available properties: `UNSIGNED`, `ZEROFILL`
   *
   * @property BIGINT
   */
  BIGINT: BIGINT,
  /**
   * A datetime column
   * @property DATE
   */
  DATE: 'DATETIME',
  /**
   * A boolean / tinyint column, depending on dialect
   * @property BOOLEAN
   */
  BOOLEAN: 'TINYINT(1)',
  /**
   * Floating point number. Accepts one or two arguments for precision
   * 
   * Available properties: `UNSIGNED`, `ZEROFILL`
   *
   * @property FLOAT
   */
  FLOAT: FLOAT,
  /**
   * A default value of the current timestamp
   * @property NOW
   */
  NOW: 'NOW',
  /**
   * Binary storage. Available lengths: `tiny`, `medium`, `long`
   *
   * @property BLOB
   */
  BLOB: BLOB,
  /**
   * Decimal number. Accepts one or two arguments for precision
   * 
   * Available properties: `UNSIGNED`, `ZEROFILL`
   *
   * @property DECIMAL
   */
  DECIMAL: DECIMAL,
  /**
   * A column storing a unique univeral identifier. Use with `UUIDV1` or `UUIDV4` for default values.
   * @property UUID
   */
  UUID: 'UUID',
  /**
   * A default unique universal identifier generated following the UUID v1 standard
   * @property UUIDV1
   */
  UUIDV1: 'UUIDV1',
  /**
   * A default unique universal identifier generated following the UUID v2 standard
   * @property UUIDV4
   */
  UUIDV4: 'UUIDV4',

  /**
   * A key / value column. Only available in postgres.
   * @property HSTORE
   */
  HSTORE: 'HSTORE',

  /**
   * A JSON string column. Only available in postgres.
   */
  JSON: 'JSON',

  /**
   * A virtual value that is not stored in the DB. This could for example be useful if you want to provide a default value in your model
   * that is returned to the user but not stored in the DB.
   * 
   * You could also use it to validate a value before permuting and storing it. Checking password length before hashing it for example:
   * ```js
   * sequelize.define('user', {
   *   password_hash: DataTypes.STRING
   *   password: {
   *     type: DataTypes.VIRTUAL,
   *     set: function (val) {
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
   * @property VIRTUAL
   * @alias NONE
   */
  VIRTUAL: VIRTUAL,
  NONE: VIRTUAL,

  /**
   * An enumeration. `DataTypes.ENUM('value', 'another value')`.
   * 
   * @property ENUM
   */
  get ENUM() {
    var result = function() {
      return {
        type: 'ENUM',
        values: Array.prototype.slice.call(arguments).reduce(function(result, element) {
          return result.concat(Array.isArray(element) ? element : [element]);
        }, []),
        toString: result.toString
      };
    };

    result.toString = result.valueOf = function() { return 'ENUM'; };

    return result;
  },

  /**
   * An array of `type`, e.g. `DataTypes.ARRAY(DataTypes.DECIMAL)`. Only available in postgres.
   * @property ARRAY
   */
  ARRAY: function(type) { return type + '[]'; }
};
