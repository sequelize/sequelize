'use strict';

var BaseTypes = require('../../data-types')
  , util = require('util')
  , _ = require('lodash');

BaseTypes.ABSTRACT.prototype.dialectTypes = 'https://msdn.microsoft.com/en-us/library/ms187752%28v=sql.110%29.aspx';

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

BaseTypes.TEXT.prototype.toSql = function() {
  // TEXT is deprecated in mssql and it would normally be saved as a non-unicode string.
  // Using unicode is just future proof
  if (this._length) {
    if (this._length.toLowerCase() === 'tiny') { // tiny = 2^8
      this.warn('MSSQL does not support TEXT with the `length` = `tiny` option. `NVARCHAR(256)` will be used instead.');
      return 'NVARCHAR(256)';
    }
    this.warn('MSSQL does not support TEXT with the `length` option. `NVARCHAR(MAX)` will be used instead.');
  }
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

BaseTypes.BLOB.prototype.toSql = function() {
  if (this._length) {
    if (this._length.toLowerCase() === 'tiny') { // tiny = 2^8
      this.warn('MSSQL does not support BLOB with the `length` = `tiny` option. `VARBINARY(256)` will be used instead.');
      return 'VARBINARY(256)';
    }
    this.warn('MSSQL does not support BLOB with the `length` option. `VARBINARY(MAX)` will be used instead.');
  }
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

  // MSSQL does not support any options for integer
  if (this._length || this.options.length || this._unsigned || this._zerofill) {
    this.warn('MSSQL does not support INTEGER with options. Plain `INTEGER` will be used instead.');
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

  // MSSQL does not support any options for bigint
  if (this._length || this.options.length || this._unsigned || this._zerofill) {
    this.warn('MSSQL does not support BIGINT with options. Plain `BIGINT` will be used instead.');
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

  // MSSQL does not support any options for real
  if (this._length || this.options.length || this._unsigned || this._zerofill) {
    this.warn('MSSQL does not support REAL with options. Plain `REAL` will be used instead.');
    this._length = undefined;
    this.options.length = undefined;
    this._unsigned = undefined;
    this._zerofill = undefined;
  }
};
util.inherits(REAL, BaseTypes.REAL);

var FLOAT = function() {
  if (!(this instanceof FLOAT)) return new FLOAT();
  BaseTypes.FLOAT.apply(this, arguments);

  // MSSQL does only support lengths as option.
  // Values between 1-24 result in 7 digits precision (4 bytes storage size)
  // Values between 25-53 result in 15 digits precision (8 bytes storage size)
  // If decimals are provided remove these and print a warning
  if (this._decimals) {
    this.warn('MSSQL does not support Float with decimals. Plain `FLOAT` will be used instead.');
    this._length = undefined;
    this.options.length = undefined;
  }
  if (this._unsigned) {
    this.warn('MSSQL does not support Float unsigned. `UNSIGNED` was removed.');
    this._unsigned = undefined;
  }
  if (this._zerofill) {
    this.warn('MSSQL does not support Float zerofill. `ZEROFILL` was removed.');
    this._zerofill = undefined;
  }
};
util.inherits(FLOAT, BaseTypes.FLOAT);

BaseTypes.ENUM.prototype.toSql = function() {
  return 'VARCHAR(255)';
};

module.exports = {
  BOOLEAN: BOOLEAN,
  STRING: STRING,
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
