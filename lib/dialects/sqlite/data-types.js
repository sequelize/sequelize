'use strict';

var _ = require('lodash');

module.exports = function (BaseTypes) {
  var warn = BaseTypes.ABSTRACT.warn.bind(undefined, 'https://www.sqlite.org/datatype3.html');

  BaseTypes.DATE.types.sqlite = ['DATETIME'];
  BaseTypes.STRING.types.sqlite = ['VARCHAR', 'VARCHAR BINARY'];
  BaseTypes.CHAR.types.sqlite = ['CHAR', 'CHAR BINARY'];
  BaseTypes.TEXT.types.sqlite = ['TEXT'];
  BaseTypes.INTEGER.types.sqlite = ['INTEGER'];
  BaseTypes.BIGINT.types.sqlite = ['BIGINT'];
  BaseTypes.FLOAT.types.sqlite = ['FLOAT'];
  BaseTypes.TIME.types.sqlite = ['TIME'];
  BaseTypes.DATEONLY.types.sqlite = ['DATE'];
  BaseTypes.BOOLEAN.types.sqlite = ['TINYINT'];
  BaseTypes.BLOB.types.sqlite = ['TINYBLOB', 'BLOB', 'LONGBLOB'];
  BaseTypes.DECIMAL.types.sqlite = ['DECIMAL'];
  BaseTypes.UUID.types.sqlite = ['UUID'];
  BaseTypes.ENUM.types.sqlite = false;
  BaseTypes.REAL.types.sqlite = ['REAL'];
  BaseTypes.DOUBLE.types.sqlite = ['DOUBLE PRECISION'];
  BaseTypes.GEOMETRY.types.sqlite = false;

  var DATE = BaseTypes.DATE.inherits();
  DATE.parse = function (date, options) {
    if (date.indexOf('+') === -1) {
      // For backwards compat. Dates inserted by sequelize < 2.0dev12 will not have a timestamp set
      return new Date(date + options.timezone);
    } else {
      return new Date(date); // We already have a timezone stored in the string
    }
  };

  var STRING = BaseTypes.STRING.inherits();
  STRING.prototype.toSql = function() {
    if (this._binary) {
      return 'VARCHAR BINARY(' + this._length + ')';
    } else {
      return BaseTypes.STRING.prototype.toSql.call(this);
    }
  };

  var TEXT = BaseTypes.TEXT.inherits();
  TEXT.prototype.toSql = function() {
    if (this._length) {
      warn('SQLite does not support TEXT with options. Plain `TEXT` will be used instead.');
      this._length = undefined;
    }
    return 'TEXT';
  };

  var CHAR = BaseTypes.CHAR.inherits();
  CHAR.prototype.toSql = function() {
    if (this._binary) {
      return 'CHAR BINARY(' + this._length + ')';
    } else {
      return BaseTypes.CHAR.prototype.toSql.call(this);
    }
  };

  var NUMBER = BaseTypes.NUMBER.inherits();
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

  var INTEGER = BaseTypes.INTEGER.inherits(function(length) {
    var options = typeof length === 'object' && length || {
      length: length
    };
    if (!(this instanceof INTEGER)) return new INTEGER(options);
    BaseTypes.INTEGER.call(this, options);
  });
  INTEGER.prototype.key = INTEGER.key = 'INTEGER';
  INTEGER.prototype.toSql = function() {
    return NUMBER.prototype.toSql.call(this);
  };

  var BIGINT = BaseTypes.BIGINT.inherits(function(length) {
    var options = typeof length === 'object' && length || {
      length: length
    };
    if (!(this instanceof BIGINT)) return new BIGINT(options);
    BaseTypes.BIGINT.call(this, options);
  });
  BIGINT.prototype.key = BIGINT.key = 'BIGINT';
  BIGINT.prototype.toSql = function() {
    return NUMBER.prototype.toSql.call(this);
  };

  var FLOAT = BaseTypes.FLOAT.inherits(function(length, decimals) {
    var options = typeof length === 'object' && length || {
      length: length,
      decimals: decimals
    };
    if (!(this instanceof FLOAT)) return new FLOAT(options);
    BaseTypes.FLOAT.call(this, options);
  });
  FLOAT.prototype.key = FLOAT.key = 'FLOAT';
  FLOAT.prototype.toSql = function() {
    return NUMBER.prototype.toSql.call(this);
  };

  var DOUBLE = BaseTypes.DOUBLE.inherits(function(length, decimals) {
    var options = typeof length === 'object' && length || {
      length: length,
      decimals: decimals
    };
    if (!(this instanceof DOUBLE)) return new DOUBLE(options);
    BaseTypes.DOUBLE.call(this, options);
  });
  DOUBLE.prototype.key = DOUBLE.key = 'DOUBLE PRECISION';
  DOUBLE.prototype.toSql = function() {
    return NUMBER.prototype.toSql.call(this);
  };

  var REAL = BaseTypes.REAL.inherits(function(length, decimals) {
    var options = typeof length === 'object' && length || {
      length: length,
      decimals: decimals
    };
    if (!(this instanceof REAL)) return new REAL(options);
    BaseTypes.REAL.call(this, options);
  });
  REAL.prototype.key = REAL.key = 'REAL';
  REAL.prototype.toSql = function() {
    return NUMBER.prototype.toSql.call(this);
  };

  var ENUM = BaseTypes.ENUM.inherits();

  ENUM.prototype.toSql = function () {
    return 'TEXT';
  };

  var exports = {
    DATE: DATE,
    STRING: STRING,
    CHAR: CHAR,
    NUMBER: NUMBER,
    FLOAT: FLOAT,
    REAL: REAL,
    'DOUBLE PRECISION': DOUBLE,
    INTEGER: INTEGER,
    BIGINT: BIGINT,
    TEXT: TEXT,
    ENUM: ENUM
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
