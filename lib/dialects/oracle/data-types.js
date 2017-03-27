'use strict';

var _ = require('lodash');

module.exports = function (BaseTypes) {
  var warn = BaseTypes.ABSTRACT.warn.bind(undefined, 'http://docs.oracle.com/cd/A87860_01/doc/server.817/a76965/c10datyp.htm');

  BaseTypes.DATE.types.oracle = ['TIMESTAMP'];
  BaseTypes.STRING.types.oracle = ['VARCHAR2', 'NVARCHAR2'];
  BaseTypes.CHAR.types.oracle = ['CHAR','VARBINARY'];
  BaseTypes.TEXT.types.oracle = false;
  BaseTypes.INTEGER.types.oracle = ['INTEGER'];
  BaseTypes.BIGINT.types.oracle = false;
  BaseTypes.FLOAT.types.oracle = ['FLOAT'];
  BaseTypes.TIME.types.oracle = false;
  BaseTypes.DATEONLY.types.oracle = ['DATE'];
  BaseTypes.BOOLEAN.types.oracle = ['NUMBER'];
  BaseTypes.BLOB.types.oracle = ['BLOB'];
  BaseTypes.DECIMAL.types.oracle = ['DECIMAL'];
  BaseTypes.UUID.types.oracle = false;
  BaseTypes.ENUM.types.oracle = false;
  BaseTypes.REAL.types.oracle = ['FLOAT'];
  BaseTypes.NUMERIC.types.oracle = false;
  BaseTypes.DOUBLE.types.oracle = ['DOUBLE PRECISION'];
  // BaseTypes.GEOMETRY.types.oracle = [240]; // not yet supported
  BaseTypes.GEOMETRY.types.oracle = false;

  var BLOB = BaseTypes.BLOB.inherits();

  BLOB.prototype.toSql = function() {
    if (this._length) {
      if (this._length.toLowerCase() === 'tiny') { // tiny = 2^8
        warn('ORACLE does not support BLOB with the `length` = `tiny` option. `NVARCHAR2(256)` will be used instead.');
        return 'VARBINARY(256)';
      }
      warn('ORACLE does not support BLOB with the `length` option. `NVARCHAR2(MAX)` will be used instead.');
    }
    return 'VARBINARY(MAX)';
  };

  BLOB.prototype.$hexify = function (hex) {
    return '0x' + hex;
  };

  var CHAR = BaseTypes.CHAR.inherits();

  CHAR.prototype.toSql = function() {
    if (this._binary) {
      return 'VARBINARY(' + this._length + ')';
    }
    return BaseTypes.CHAR.prototype.toSql.call(this);
  };

  var STRING = BaseTypes.STRING.inherits();

  STRING.prototype.toSql = function() {
    if (!this._binary) {
      return 'NVARCHAR2(' + this._length + ')';
    } else{
      return 'VARBINARY(' + this._length + ')';
    }
  };

  STRING.prototype.escape = false;
  STRING.prototype.$stringify = function (value, options) {
    if (this._binary) {
      return BLOB.prototype.$stringify(value);
    } else {
      return options.escape(value);
    }
  };

  var TEXT = BaseTypes.TEXT.inherits();

  TEXT.prototype.toSql = function() {
    // TEXT is deprecated in mssql and it would normally be saved as a non-unicode string.
    // Using unicode is just future proof
    if (this._length) {
      if (this._length.toLowerCase() === 'tiny') { // tiny = 2^8
        warn('ORACLE does not support TEXT with the `length` = `tiny` option. `NVARCHAR(256)` will be used instead.');
        return 'NVARCHAR2(256)';
      }
      warn('ORACLE does not support TEXT with the `length` option. `NVARCHAR(MAX)` will be used instead.');
    }
    return 'NVARCHAR2(MAX)';
  };

  var BOOLEAN = BaseTypes.BOOLEAN.inherits();

  BOOLEAN.prototype.toSql = function() {
    return 'NUMBER(1)';
  };

  BOOLEAN.prototype.$stringify = function (value, options) {
    return !!value ? 1 : 0;
  };

  var UUID = BaseTypes.UUID.inherits();

  UUID.prototype.toSql = function() {
    return 'RAW(16)';
  };

  var NOW = BaseTypes.NOW.inherits();

//VOIR si il faut pas passer par un select from dual
  NOW.prototype.toSql = function() {
    return 'SYSDATE';
  };

  var DATE = BaseTypes.DATE.inherits();
  DATE.prototype.escape = false;

  DATE.prototype.toSql = function() {
    return 'TIMESTAMP';
  };

  DATE.prototype.$stringify = function (date, options) {
    var format = 'YYYY-MM-DD HH24:MI:SS.FF';

    date = this.$applyTimezone(date, options);

    // mssql not allow +timezone datetime format
    var formatedDate = date.format('YYYY-MM-DD HH:mm:ss.ss');

    return "TO_TIMESTAMP('" + formatedDate + "','" + format + "')";

  };

  var DECIMAL = BaseTypes.NUMBER.inherits();

  BaseTypes.NUMBER.prototype.toSql = function() {
  var result = this.key;
  if (this._length) {
    result += '(' + this._length;
    if (typeof this._decimals === 'number') {
      result += ',' + this._decimals;
    }
    result += ')';
  }

  if (!this._length && this._precision) {
    result += '(' + this._precision;
    if (typeof this._scale === 'number') {
      result += ',' + this._scale;
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

  var INTEGER = BaseTypes.INTEGER.inherits(function() {
    if (!(this instanceof INTEGER)) return new INTEGER();
    BaseTypes.INTEGER.apply(this, arguments);

    // MSSQL does not support any options for integer
    if (this._zerofill) {
      warn('ORACLE does not support INTEGER with options. Plain `INTEGER` will be used instead.');
      this._zerofill = undefined;
    }
    return BaseTypes.INTEGER.prototype.toSql.call(this);
  });

  BaseTypes.INTEGER.prototype.toSql = function() {
    if(this._unsigned) {
      if(this._length) {
        return 'UNSIGNED INT(' + this._length + ')';
      }
      return 'UNSIGNED INT';
    }
    return 'INTEGER';
  }

  var BIGINT = BaseTypes.BIGINT.inherits();

  BIGINT.prototype.toSql = function() {
    return 'NUMBER(19)';
  };

  var REAL = BaseTypes.REAL.inherits();

  REAL.prototype.toSql = function() {
    return 'REAL';
  };

  var FLOAT = BaseTypes.FLOAT.inherits();

  FLOAT.prototype.toSql = function() {
    if(this._length) {
      return 'FLOAT(' + this._length + ')';  
    }
    return 'FLOAT';
  };

  var DOUBLE = BaseTypes.DOUBLE.inherits();

  DOUBLE.prototype.toSql = function() {
    return 'DOUBLE PRECISION';
  };

  var ENUM = BaseTypes.ENUM.inherits();
  
  ENUM.prototype.toSql = function() {
    return 'VARCHAR2(255)';
  };

  var exports = {
    BLOB: BLOB,
    BOOLEAN: BOOLEAN,
    'DOUBLE PRECISION': DOUBLE,
    ENUM: ENUM,
    STRING: STRING,
    DECIMAL: DECIMAL,
    CHAR: CHAR,
    UUID: UUID,
    DATE: DATE,
    NOW: NOW,
    INTEGER: INTEGER,
    BIGINT: BIGINT,
    REAL: REAL,
    FLOAT: FLOAT,
    TEXT: TEXT
  };

  _.forIn(exports, function (DataType, key) {
    if (!DataType.key) DataType.key = key;
    if (!DataType.extend) {
      DataType.extend = function(oldType) {
        return new DataType(oldType.options);
      };
    }
  });

  return exports;
};
