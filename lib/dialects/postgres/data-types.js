'use strict';

var BaseTypes = require('../../data-types')
  , util = require('util')
  , _ = require('lodash')
  , wkx = require('wkx')
  , wkt = require('wellknown');  

BaseTypes.ABSTRACT.prototype.dialectTypes = 'http://www.postgresql.org/docs/9.4/static/datatype.html';

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

BaseTypes.TEXT.prototype.toSql = function() {
  if (this._length) {
    this.warn('PostgreSQL does not support TEXT with options. Plain `TEXT` will be used instead.');
    this._length = undefined;
  }
  return 'TEXT';
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
  if (this._length || this.options.length || this._unsigned || this._zerofill) {
    this.warn('PostgreSQL does not support INTEGER with options. Plain `INTEGER` will be used instead.');
    this._length = undefined;
    this.options.length = undefined;
    this._unsigned = undefined;
    this._zerofill = undefined;
  }
};
util.inherits(INTEGER, BaseTypes.INTEGER);

var BIGINT = function() {
  if (!(this instanceof BIGINT)) return new BIGINT();
  BaseTypes.BIGINT.apply(this, arguments);

  // POSTGRES does not support any parameters for bigint
  if (this._length || this.options.length || this._unsigned || this._zerofill) {
    this.warn('PostgreSQL does not support BIGINT with options. Plain `BIGINT` will be used instead.');
    this._length = undefined;
    this.options.length = undefined;
    this._unsigned = undefined;
    this._zerofill = undefined;
  }
};
util.inherits(BIGINT, BaseTypes.BIGINT);

var REAL = function() {
  if (!(this instanceof REAL)) return new REAL();
  BaseTypes.REAL.apply(this, arguments);

  // POSTGRES does not support any parameters for real
  if (this._length || this.options.length || this._unsigned || this._zerofill) {
    this.warn('PostgreSQL does not support REAL with options. Plain `REAL` will be used instead.');
    this._length = undefined;
    this.options.length = undefined;
    this._unsigned = undefined;
    this._zerofill = undefined;
  }
};
util.inherits(REAL, BaseTypes.REAL);

var DOUBLE = function() {
  if (!(this instanceof DOUBLE)) return new DOUBLE();
  BaseTypes.DOUBLE.apply(this, arguments);

  // POSTGRES does not support any parameters for double
  if (this._length || this.options.length || this._unsigned || this._zerofill) {
    this.warn('PostgreSQL does not support DOUBLE with options. Plain `DOUBLE` will be used instead.');
    this._length = undefined;
    this.options.length = undefined;
    this._unsigned = undefined;
    this._zerofill = undefined;
  }
};
util.inherits(DOUBLE, BaseTypes.DOUBLE);

var FLOAT = function() {
  if (!(this instanceof FLOAT)) return new FLOAT();
  BaseTypes.FLOAT.apply(this, arguments);

  // POSTGRES does only support lengths as parameter.
  // Values between 1-24 result in REAL
  // Values between 25-53 result in DOUBLE PRECISION
  // If decimals are provided remove these and print a warning
  if (this._decimals) {
    this.warn('PostgreSQL does not support FLOAT with decimals. Plain `FLOAT` will be used instead.');
    this._length = undefined;
    this.options.length = undefined;
    this._decimals = undefined;
  }
  if (this._unsigned) {
    this.warn('PostgreSQL does not support FLOAT unsigned. `UNSIGNED` was removed.');
    this._unsigned = undefined;
  }
  if (this._zerofill) {
    this.warn('PostgreSQL does not support FLOAT zerofill. `ZEROFILL` was removed.');
    this._zerofill = undefined;
  }
};
util.inherits(FLOAT, BaseTypes.FLOAT);

BaseTypes.BLOB.prototype.toSql = function() {
  if (this._length) {
    this.warn('PostgreSQL does not support BLOB (BYTEA) with options. Plain `BYTEA` will be used instead.');
    this._length = undefined;
  }
  return 'BYTEA';
};

var GEOMETRY = function() {
  if (!(this instanceof GEOMETRY)) return new GEOMETRY();
  BaseTypes.GEOMETRY.apply(this, arguments);
};
util.inherits(GEOMETRY, BaseTypes.GEOMETRY);

GEOMETRY.prototype.toSql = function() {
  var result = this.key;

  if (this.type){
    result += '(' + this.type;

    if (this.srid){
      result += ',' + this.srid;
    }

    result += ')';
  }

  return result;
};

GEOMETRY.prototype.parse = function(value) {
  var b = new Buffer(value, 'hex');
  return wkt.parse(wkx.Geometry.parse(b).toWkt());
};

module.exports = {
  STRING: STRING,
  CHAR: CHAR,
  BOOLEAN: BOOLEAN,
  DATE: DATE,
  INTEGER: INTEGER,
  BIGINT: BIGINT,
  REAL: REAL,
  'DOUBLE PRECISION': DOUBLE,
  FLOAT: FLOAT,
  GEOMETRY: GEOMETRY
};

_.forIn(module.exports, function (DataType, key) {
  if (!DataType.key) DataType.key = key;
  if (!DataType.extend) {
    DataType.extend = function(oldType) {
      return new DataType(oldType.options);
    };
  }
});
