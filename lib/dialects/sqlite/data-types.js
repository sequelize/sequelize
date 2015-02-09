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
    return 'VARCHAR BINARY(' + this._length + ')';
  } else {
    return BaseTypes.STRING.prototype.toSql.call(this);
  }
};

var CHAR = function() {
  if (!(this instanceof CHAR)) return new CHAR();
  BaseTypes.CHAR.apply(this, arguments);
};
util.inherits(CHAR, BaseTypes.CHAR);

CHAR.prototype.toSql = function() {
  if (this._binary) {
    return 'CHAR BINARY(' + this._length + ')';
  } else {
    return BaseTypes.CHAR.prototype.toSql.call(this);
  }
};

var NUMBER = function() {
  BaseTypes.NUMBER.apply(this, arguments);
};
util.inherits(NUMBER, BaseTypes.NUMBER);

NUMBER.prototype.toSql = function() {
  var result = this.key;

  if (this._unsigned) {
    result += ' UNSIGNED';
  }
  if (this._zerofill) {
    result += ' ZEROFILL';
  }

  if (this._length) {
    result += '(' + this._length;
    if (typeof this._decimals === 'number') {
      result += ',' + this._decimals;
    }
    result += ')';
  }
  return result;
};

var INTEGER = function(length) {
  var options = typeof length === "object" && length || {
    length: length
  };
  if (!(this instanceof INTEGER)) return new INTEGER(options);
  NUMBER.call(this, options);
};
util.inherits(INTEGER, BaseTypes.INTEGER);
INTEGER.prototype.key = INTEGER.key = 'INTEGER';
INTEGER.prototype.toSql = function() {
  return NUMBER.prototype.toSql.call(this);
};

var BIGINT = function(length) {
  var options = typeof length === "object" && length || {
    length: length
  };
  if (!(this instanceof BIGINT)) return new BIGINT(options);
  NUMBER.call(this, options);
};
util.inherits(BIGINT, BaseTypes.BIGINT);
BIGINT.prototype.key = BIGINT.key = 'BIGINT';
BIGINT.prototype.toSql = function() {
  return NUMBER.prototype.toSql.call(this);
};

var FLOAT = function(length, decimals) {
  var options = typeof length === "object" && length || {
    length: length,
    decimals: decimals
  };
  if (!(this instanceof FLOAT)) return new FLOAT(options);
  NUMBER.call(this, options); 
};
util.inherits(FLOAT, BaseTypes.FLOAT);
FLOAT.prototype.key = FLOAT.key = 'FLOAT';
FLOAT.prototype.toSql = function() {
  return NUMBER.prototype.toSql.call(this);
};

module.exports = {
  STRING: STRING,
  CHAR: CHAR,
  NUMBER: NUMBER,
  FLOAT: FLOAT,
  INTEGER: INTEGER,
  BIGINT: BIGINT
};

_.forIn(module.exports, function (DataType, key) {
  if (!DataType.key) DataType.key = key;
  if (!DataType.extend) {
    DataType.extend = function(oldType) {
      return new DataType(oldType.options);
    };
  }
});