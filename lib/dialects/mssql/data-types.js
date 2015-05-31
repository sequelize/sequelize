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
  if (!this._binary) {
    return 'NVARCHAR(' + this._length + ')';
  } else{
    return 'BINARY(' + this._length + ')';
  }
};

var TEXT = function() {
  if (!(this instanceof TEXT)) return new TEXT();
  BaseTypes.TEXT.apply(this, arguments);
};
util.inherits(TEXT, BaseTypes.TEXT);

TEXT.prototype.toSql = function() {
  // TEXT is deprecated in mssql and it would normally be saved as a non-unicode string.
  // Using unicode is just future proof
  return 'NVARCHAR(MAX)';
};

var BOOLEAN = function() {
  if (!(this instanceof BOOLEAN)) return new BOOLEAN();
  BaseTypes.BOOLEAN.apply(this, arguments);
};
util.inherits(BOOLEAN, BaseTypes.BOOLEAN);

BOOLEAN.prototype.toSql = function() {
  return 'BIT';
};

var BLOB = function() {
  if (!(this instanceof BLOB)) return new BLOB();
  BaseTypes.BLOB.apply(this, arguments);
};
util.inherits(BLOB, BaseTypes.BLOB);

BLOB.prototype.toSql = function() {
  return 'VARBINARY(MAX)';
};

var UUID = function() {
  if (!(this instanceof UUID)) return new UUID();
  BaseTypes.UUID.apply(this, arguments);
};
util.inherits(UUID, BaseTypes.UUID);

UUID.prototype.toSql = function() {
  return 'CHAR(36)';
};

var NOW = function() {
  if (!(this instanceof NOW)) return new NOW();
  BaseTypes.NOW.apply(this, arguments);
};
util.inherits(NOW, BaseTypes.NOW);

NOW.prototype.toSql = function() {
  return 'GETDATE()';
};

var DATE = function() {
  if (!(this instanceof DATE)) return new DATE();
  BaseTypes.DATE.apply(this, arguments);
};
util.inherits(DATE, BaseTypes.DATE);

DATE.prototype.toSql = function() {
  return 'DATETIME2';
};

var INTEGER = function() {
  if (!(this instanceof INTEGER)) return new INTEGER();
  BaseTypes.INTEGER.apply(this, arguments);

  // MSSQL does not support any parameters for integer
  this._length = undefined;
  this.options.length = undefined;
  this._unsigned = undefined;
  this._zerofill = undefined;
};
util.inherits(INTEGER, BaseTypes.INTEGER);

var BIGINT = function() {
  if (!(this instanceof BIGINT)) return new BIGINT();
  BaseTypes.BIGINT.apply(this, arguments);

  // MSSQL does not support any parameters for bigint
  this._length = undefined;
  this.options.length = undefined;
  this._unsigned = undefined;
  this._zerofill = undefined;
};
util.inherits(BIGINT, BaseTypes.BIGINT);

var REAL = function() {
  if (!(this instanceof REAL)) return new REAL();
  BaseTypes.REAL.apply(this, arguments);

  // MSSQL does not support any parameters for real
  this._length = undefined;
  this.options.length = undefined;
  this._unsigned = undefined;
  this._zerofill = undefined;
};
util.inherits(REAL, BaseTypes.REAL);

var FLOAT = function() {
  if (!(this instanceof FLOAT)) return new FLOAT();
  BaseTypes.FLOAT.apply(this, arguments);

  // MSSQL does only support lengths as parameter.
  // Values between 1-24 result in 7 digits precision (4 bytes storage size)
  // Values between 25-53 result in 15 digits precision (8 bytes storage size)
  if (this._decimals) {
    this._length = undefined;
    this.options.length = undefined;
  }
  this._unsigned = undefined;
  this._zerofill = undefined;
};
util.inherits(FLOAT, BaseTypes.FLOAT);

module.exports = {
  BOOLEAN: BOOLEAN,
  STRING: STRING,
  TEXT: TEXT,
  BLOB: BLOB,
  UUID: UUID,
  DATE: DATE,
  NOW: NOW,
  INTEGER: INTEGER,
  BIGINT: BIGINT,
  REAL: REAL,
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