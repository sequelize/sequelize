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

/**
 * An unlimited length text column
 * @property TEXT
 */
var TEXT = function(options) {
  if (!(this instanceof TEXT)) return new TEXT(options);
  BaseTypes.TEXT.apply(this, arguments);
};
util.inherits(TEXT, BaseTypes.TEXT);

TEXT.prototype.toSql = function() {
  return 'CLOB';
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
};
util.inherits(INTEGER, BaseTypes.INTEGER);

/**
 * A 64 bit integer.
 *
 * Available properties: `UNSIGNED`, `ZEROFILL`
 *
 * @property BIGINT
 */

var BIGINT = function(length) {
  BaseTypes.INTEGER.apply(this, arguments);
  
  // Oracle does not support any parameters for bigint
  this._length = null;
  this.options.length = null;
  this._unsigned = null;
  this._zerofill = null;
};
util.inherits(INTEGER, BaseTypes.INTEGER);

BIGINT.prototype.toSql = function() {
  return 'NUMBER(19, 0)';
};

/**
 * Floating point number (32-bit)
 *
 * Available properties:
 *
 * @property FLOAT
 */
var FLOAT = function(length, decimals) {
  BaseTypes.FLOAT.apply(this, arguments);
  
  // Oracle does not support any parameters for bigint
  this._length = null;
  this.options.length = null;
  this._decimals = null;
};
util.inherits(FLOAT, BaseTypes.FLOAT);

FLOAT.prototype.toSql = function() {
  return 'BINARY_FLOAT';
};

/**
 * Floating point number (64-bit)
 *
 * Available properties:
 *
 * @property FLOAT
 */
var DOUBLE = function(length, decimals) {
  BaseTypes.DOUBLE.apply(this, arguments);
  
  // Oracle does not support any parameters for bigint
  this._length = null;
  this.options.length = null;
  this._decimals = null;
};
util.inherits(DOUBLE, BaseTypes.DOUBLE);

DOUBLE.prototype.toSql = function() {
  return 'BINARY_DOUBLE';
};

/**
 * Decimal number. Accepts one or two arguments for precision
 *
 * Available properties: `UNSIGNED`, `ZEROFILL`
 *
 * @property DECIMAL
 */
var DECIMAL = function(precision, scale) {
  BaseTypes.DECIMAL.apply(this, DECIMAL);

  this._unsigned = null;
  this._zerofill = null;
};
util.inherits(DECIMAL, BaseTypes.DECIMAL);

DECIMAL.prototype.toSql = function() {
  if (this._precision || this._scale) {
    return 'NUMBER(' + [this._precision, this._scale].filter(_.identity).join(',') + ')';
  }

  return 'NUMBER';
};

/**
 * A boolean / tinyint column, depending on dialect
 * @property BOOLEAN
 */
var BOOLEAN = function() {
  if (!(this instanceof BOOLEAN)) return new BOOLEAN();
  BaseTypes.BOOLEAN.apply(this, arguments);
};
util.inherits(BOOLEAN, BaseTypes.BOOLEAN);

BOOLEAN.prototype.toSql = function() {
  return 'NUMBER(1)';
};

/**
 * A time column
 * @property TIME
 */

var TIME = function() {
	throw ('TIME IS NOT AN ORACLE DATATYPE');
};
util.inherits(TIME, BaseTypes.TIME);

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

/**
 * A date only column
 * @property DATEONLY
 */
// var DATEONLY = function() {
//   if (!(this instanceof DATEONLY)) return new DATEONLY();
//   BaseTypes.DATEONLY.apply(this, arguments);
// };
// util.inherits(DATEONLY, BaseTypes.DATEONLY);
// };

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
  return 'CURRENT_TIMESTAMP';
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
  TIME: TIME,
  DATE: DATE,
  HSTORE: HSTORE,
  JSONTYPE: JSONTYPE,
  NOW: NOW
};

_.forIn(module.exports, function (DataType, key) {
  if (!DataType.key) DataType.key = key;
  if (!DataType.extend) {
    DataType.extend = function(oldType) {
      return new DataType(oldType.options);
    };
  }
});