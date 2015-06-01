'use strict';

var BaseTypes = require('../../data-types')
  , util = require('util')
  , _ = require('lodash');

/**
 * A variable length string. Default length 255
 *
 * Available properties: 
 *
 * @property STRING
 */
var STRING = function(length, binary) {
  if (!(this instanceof STRING)) return new STRING();
  BaseTypes.STRING.apply(this, arguments);

  this._binary = null;
};
util.inherits(STRING, BaseTypes.STRING);

STRING.prototype.toSql = function() {
  return 'VARCHAR2(' + this._length + ')' ;
};

STRING.prototype.bind_out='STRING';

/**
 * A fixed length string. Default length 255
 *
 * Available properties: 
 *
 * @property CHAR
 */
var CHAR = function(length, binary) {
  if (!(this instanceof CHAR)) return new CHAR();
  BaseTypes.CHAR.apply(this, arguments);

  this._binary = null;
};
util.inherits(CHAR, BaseTypes.CHAR);

CHAR.prototype.bind_out='CHAR';

/**
 * An unlimited length text column
 * @property TEXT
 */
// WAIT LOB SUPPORT BY oracledb
// var TEXT = function(options) {
//   if (!(this instanceof TEXT)) return new TEXT(options);
//   BaseTypes.TEXT.apply(this, arguments);
// };
// util.inherits(TEXT, BaseTypes.TEXT);

// TEXT.prototype.toSql = function() {
//   return 'CLOB';
// };
var TEXT = function(options) {
  throw ('SORRY BUT ORACLEDB LIB NOT SUPPORT CLOB.');
};

/**
 * An fixed and floating-point numbers
 * @property NUMBER
 */
var NUMBER = function(options) {
  BaseTypes.NUMBER.apply(this, arguments);

  this._unsigned = null;
  this._zerofill = null;
};
util.inherits(NUMBER, BaseTypes.NUMBER);

NUMBER.prototype.bind_out='NUMBER';

/**
 * A 32 bit integer.
 *
 * Available properties: 
 *
 * @property INTEGER
 */
var INTEGER = function(options) {
  BaseTypes.INTEGER.apply(this, arguments);
  
  this._unsigned = null;
  this._zerofill = null;

  if(this._length || this._decimals){
    this.key='NUMBER';
  }
};
util.inherits(INTEGER, NUMBER);

INTEGER.prototype.key = INTEGER.key = 'INTEGER';

INTEGER.prototype.bind_out='NUMBER';

/**
 * A 64 bit integer.
 *
 * Available properties: `UNSIGNED`, `ZEROFILL`
 *
 * @property BIGINT
 */

var BIGINT = function() {
  var options = {
    length: 19
  };
  if (!(this instanceof BIGINT)) return new BIGINT(options);
  NUMBER.call(this, options);
};
util.inherits(BIGINT, NUMBER);

BIGINT.prototype.key = BIGINT.key = 'NUMBER';

BIGINT.prototype.bind_out='NUMBER';


/**
 * Floating point number (32-bit)
 *
 * Available properties:
 *
 * @property FLOAT
 */
var FLOAT = function(length) {
  var options = typeof length === 'object' && length || {
    length: length
  };

  options.decimals=null;

  NUMBER.call(this, options);
};
util.inherits(FLOAT, BaseTypes.FLOAT);

FLOAT.prototype.key = INTEGER.key = 'FLOAT';

FLOAT.prototype.bind_out='NUMBER';

/**
 * Floating point number (64-bit)
 *
 * Available properties:
 *
 * @property FLOAT
 */
var DOUBLE = function(length, decimals) {
  var options = typeof length === 'object' && length || {
    length: length,
    decimals: decimals
  };
   NUMBER.call(this, options);
};
util.inherits(DOUBLE, BaseTypes.DOUBLE);

DOUBLE.prototype.key = DOUBLE.key = 'DOUBLE';

DOUBLE.prototype.bind_out='NUMBER';

/**
 * Decimal number. Accepts one or two arguments for precision
 *
 * Available properties: `UNSIGNED`, `ZEROFILL`
 *
 * @property DECIMAL
 */
var DECIMAL = function(precision, scale) {
  var options = typeof precision === 'object' && precision || {
    length: precision,
    decimals: scale
  };
  if (!(this instanceof DECIMAL)) return new DECIMAL(options);
  
  NUMBER.call(this, options);
  this._length = options.precision;
  this._decimals = options.scale;
};
util.inherits(DECIMAL, BaseTypes.NUMBER);

DECIMAL.prototype.key = DECIMAL.key = 'NUMBER';

DECIMAL.prototype.bind_out='NUMBER';


// var DECIMAL = function(precision, scale) {
//   var options = typeof precision === 'object' && precision || {
//     precision: precision,
//     scale: scale
//   };
//   if (!(this instanceof DECIMAL)) return new DECIMAL(options);
//   NUMBER.call(this, options);
// };
// util.inherits(DECIMAL, NUMBER);

// DECIMAL.prototype.key = DECIMAL.key = 'DECIMAL';
// DECIMAL.prototype.toSql = function() {
//   if (this._precision || this._scale) {
//     return 'DECIMAL(' + [this._precision, this._scale].filter(_.identity).join(',') + ')';
//   }

//   return 'DECIMAL';
// };


/**
 * A boolean / tinyint column, depending on dialect
 * @property BOOLEAN
 */
// var BOOLEAN = function() {
//   throw ('BOOLEAN IS NOT AN ORACLE DATATYPE. USE NUMBER(1,0)');
// };
var BOOLEAN = function() {
  var options = {
    length: 1
  };
  if (!(this instanceof BOOLEAN)) return new BOOLEAN(options);
  NUMBER.call(this, options);
};
util.inherits(BOOLEAN, NUMBER);

BOOLEAN.prototype.key = BOOLEAN.key = 'NUMBER';

BOOLEAN.prototype.bind_out='NUMBER';

var UUID = function() {
  if (!(this instanceof UUID)) return new UUID();
  BaseTypes.UUID.apply(this, arguments);
};
util.inherits(UUID, BaseTypes.UUID);

UUID.prototype.toSql = function() {
  return 'CHAR(36)';
};

UUID.prototype.bind_out='STRING';

/**
 * A time column
 * @property TIME
 */

// var TIME = function() {
//   if (!(this instanceof TIME)) return new TIME();
//   BaseTypes.TIME.apply(this, arguments);
// };
// util.inherits(TIME, BaseTypes.TIME);

// TIME.prototype.key = TIME.key = 'TIME';
// TIME.prototype.toSql = function() {
//   return 'INTERVAL DAY TO SECOND ';
// };
var TIME = function() {
  throw ('TIME (INTERVAL) IS NOT YET SUPPORT BY ORACLEDB LIB');
};

/**
 * A datetime column
 * @property DATE
 */

var DATE = function() {
  if (!(this instanceof DATE)) return new DATE();
  BaseTypes.DATE.apply(this, arguments);
};
util.inherits(DATE, BaseTypes.DATE);

DATE.prototype.toSql = function() {
  return 'TIMESTAMP WITH LOCAL TIME ZONE';
};

DATE.prototype.bind_out='DATE';

/**
 * A key / value column. Only available in postgres.
 * @property HSTORE
 */

var HSTORE = function() {
	throw ('HSTORE IS NOT AN ORACLE DATATYPE');
};
util.inherits(HSTORE, BaseTypes.HSTORE);

/**
 * A JSON string column. Only available in postgres.
 * @property JSON
 */
var JSONTYPE = function() {
	throw ('JSONTYPE IS NOT AN ORACLE DATATYPE');
};

/**
 * A default value of the current timestamp
 * @property NOW
 */ 
var NOW = function() {
  if (!(this instanceof NOW)) return new NOW();
  BaseTypes.NOW.apply(this, arguments);
};
util.inherits(NOW, BaseTypes.NOW);

NOW.prototype.toSql = function() {
  return 'LOCALTIMESTAMP';
};

var BLOB = function() {
  throw ('BLOB IS NOT YET SUPPORT BY ORACLEDB LIB.');
};

var RANGE = function() {
  throw ('RANGE IS NOT SUPPORT.');
};

var ENUM = function() {
  throw ('ENUM IS NOT SUPPORT.');
};

var ARRAY = function() {
  throw ('ARRAY IS NOT SUPPORT.');
};

module.exports = {
  STRING: STRING,
  CHAR: CHAR,
  TEXT: TEXT,
  NUMBER:NUMBER, 
  INTEGER:INTEGER, 
  BIGINT: BIGINT,
  FLOAT: FLOAT, 
  DOUBLE: DOUBLE,
  DECIMAL: DECIMAL, 
  BOOLEAN:BOOLEAN,
  UUID: UUID,
  TIME: TIME,
  DATE: DATE,
  HSTORE: HSTORE,
  JSONTYPE: JSONTYPE,
  NOW: NOW,
  BLOB: BLOB,
  RANGE: RANGE,
  ENUM: ENUM,
  ARRAY: ARRAY
};

_.forIn(module.exports, function (DataType, key) {
  if (!DataType.key) DataType.key = key;
  if (!DataType.extend) {
    DataType.extend = function(oldType) {
      return new DataType(oldType.options);
    };
  }
});