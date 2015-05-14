'use strict';

var BaseTypes = require('../../data-types')
  , util = require('util')
  , _ = require('lodash');

var STRING = function() {
  if (!(this instanceof STRING)) return new STRING();
  BaseTypes.STRING.apply(this, arguments);
};
util.inherits(STRING, BaseTypes.STRING);

STRING.prototype.toSql = function() {
  if (this._binary) {
    return 'BYTEA';
  }
  return BaseTypes.STRING.prototype.toSql.call(this);
};

var CHAR = function() {
  if (!(this instanceof CHAR)) return new CHAR();
  BaseTypes.CHAR.apply(this, arguments);
};
util.inherits(CHAR, BaseTypes.CHAR);

CHAR.prototype.toSql = function() {
  if (this._binary) {
    return 'BYTEA';
  }
  return BaseTypes.CHAR.prototype.toSql.call(this);
};

var BOOLEAN = function() {
  if (!(this instanceof BOOLEAN)) return new BOOLEAN();
  BaseTypes.BOOLEAN.apply(this, arguments);
};
util.inherits(BOOLEAN, BaseTypes.BOOLEAN);

BOOLEAN.prototype.toSql = function() {
  return 'BOOLEAN';
};

var DATE = function() {
  if (!(this instanceof DATE)) return new DATE();
  BaseTypes.DATE.apply(this, arguments);
};
util.inherits(DATE, BaseTypes.DATE);

DATE.prototype.toSql = function() {
  return 'TIMESTAMP WITH TIME ZONE';
};

var INTEGER = function() {
  if (!(this instanceof INTEGER)) return new INTEGER();
  BaseTypes.INTEGER.apply(this, arguments);

  // POSTGRES does not support any parameters for integer
  this._length = null;
  this.options.length = null;
  this._unsigned = null;
  this._zerofill = null;
};
util.inherits(INTEGER, BaseTypes.INTEGER);

var BIGINT = function() {
  if (!(this instanceof BIGINT)) return new BIGINT();
  BaseTypes.BIGINT.apply(this, arguments);

  // POSTGRES does not support any parameters for bigint
  this._length = null;
  this.options.length = null;
  this._unsigned = null;
  this._zerofill = null;
};
util.inherits(BIGINT, BaseTypes.BIGINT);

var REAL = function() {
  if (!(this instanceof REAL)) return new REAL();
  BaseTypes.REAL.apply(this, arguments);

  // POSTGRES does not support any parameters for real
  this._length = null;
  this.options.length = null;
  this._unsigned = null;
  this._zerofill = null;
};
util.inherits(REAL, BaseTypes.REAL);

var DOUBLE = function() {
  if (!(this instanceof DOUBLE)) return new DOUBLE();
  BaseTypes.DOUBLE.apply(this, arguments);

  // POSTGRES does not support any parameters for double
  this._length = null;
  this.options.length = null;
  this._unsigned = null;
  this._zerofill = null;
};
util.inherits(DOUBLE, BaseTypes.DOUBLE);

var FLOAT = function() {
  if (!(this instanceof FLOAT)) return new FLOAT();
  BaseTypes.FLOAT.apply(this, arguments);

  // POSTGRES does not support any parameters for float
  this._length = null;
  this.options.length = null;
  this._unsigned = null;
  this._zerofill = null;
};
util.inherits(FLOAT, BaseTypes.FLOAT);

FLOAT.prototype.toSql = function() {
  return 'DOUBLE PRECISION';
};

var BLOB = function() {
  if (!(this instanceof BLOB)) return new BLOB();
  BaseTypes.BLOB.apply(this, arguments);
};
util.inherits(BLOB, BaseTypes.BLOB);

BLOB.prototype.toSql = function() {
  return 'BYTEA';
};

module.exports = {
  STRING: STRING,
  CHAR: CHAR,
  BOOLEAN: BOOLEAN,
  DATE: DATE,
  INTEGER: INTEGER,
  BIGINT: BIGINT,
  BLOB: BLOB,
  REAL: REAL,
  'DOUBLE PRECISION': DOUBLE,
  FLOAT: FLOAT
};

_.forIn(module.exports, function (DataType, key) {
  if (!DataType.key) DataType.key = key;
  if (!DataType.extend) {
    DataType.extend = function(oldType) {
      return new DataType(oldType.options);
    };
  }
});