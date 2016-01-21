'use strict';

var _ = require('lodash');

module.exports = function (BaseTypes) {
  var warn = BaseTypes.ABSTRACT.warn.bind(undefined, 'https://msdn.microsoft.com/en-us/library/ms187752%28v=sql.110%29.aspx');

  BaseTypes.DATE.types.mssql = [42];
  BaseTypes.STRING.types.mssql = [231, 173];
  BaseTypes.CHAR.types.mssql = [175];
  BaseTypes.TEXT.types.mssql = false;
  BaseTypes.INTEGER.types.mssql = [38];
  BaseTypes.BIGINT.types.mssql = false;
  BaseTypes.FLOAT.types.mssql = [109];
  BaseTypes.TIME.types.mssql = [41];
  BaseTypes.DATEONLY.types.mssql = [40];
  BaseTypes.BOOLEAN.types.mssql = [104];
  BaseTypes.BLOB.types.mssql = [165];
  BaseTypes.DECIMAL.types.mssql = [106];
  BaseTypes.UUID.types.mssql = false;
  BaseTypes.ENUM.types.mssql = false;
  BaseTypes.REAL.types.mssql = [109];
  BaseTypes.DOUBLE.types.mssql = [109];
  // BaseTypes.GEOMETRY.types.mssql = [240]; // not yet supported
  BaseTypes.GEOMETRY.types.mssql = false;

  var BLOB = BaseTypes.BLOB.inherits();

  BLOB.prototype.toSql = function() {
    if (this._length) {
      if (this._length.toLowerCase() === 'tiny') { // tiny = 2^8
        warn('MSSQL does not support BLOB with the `length` = `tiny` option. `VARBINARY(256)` will be used instead.');
        return 'VARBINARY(256)';
      }
      warn('MSSQL does not support BLOB with the `length` option. `VARBINARY(MAX)` will be used instead.');
    }
    return 'VARBINARY(MAX)';
  };

  BLOB.prototype.$hexify = function (hex) {
    return '0x' + hex;
  };

  var STRING = BaseTypes.STRING.inherits();

  STRING.prototype.toSql = function() {
    if (!this._binary) {
      return 'NVARCHAR(' + this._length + ')';
    } else{
      return 'BINARY(' + this._length + ')';
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
        warn('MSSQL does not support TEXT with the `length` = `tiny` option. `NVARCHAR(256)` will be used instead.');
        return 'NVARCHAR(256)';
      }
      warn('MSSQL does not support TEXT with the `length` option. `NVARCHAR(MAX)` will be used instead.');
    }
    return 'NVARCHAR(MAX)';
  };

  var BOOLEAN = BaseTypes.BOOLEAN.inherits();

  BOOLEAN.prototype.toSql = function() {
    return 'BIT';
  };

  var UUID = BaseTypes.UUID.inherits();

  UUID.prototype.toSql = function() {
    return 'CHAR(36)';
  };

  var NOW = BaseTypes.NOW.inherits();

  NOW.prototype.toSql = function() {
    return 'GETDATE()';
  };

  var DATE = BaseTypes.DATE.inherits();

  DATE.prototype.toSql = function() {
    return 'DATETIME2';
  };

  DATE.prototype.$stringify = function (date, options) {
    date = this.$applyTimezone(date, options);

    // mssql not allow +timezone datetime format
    return date.format('YYYY-MM-DD HH:mm:ss.SSS');
  };

  var INTEGER = BaseTypes.INTEGER.inherits(function() {
    if (!(this instanceof INTEGER)) return new INTEGER();
    BaseTypes.INTEGER.apply(this, arguments);

    // MSSQL does not support any options for integer
    if (this._length || this.options.length || this._unsigned || this._zerofill) {
      warn('MSSQL does not support INTEGER with options. Plain `INTEGER` will be used instead.');
      this._length = undefined;
      this.options.length = undefined;
      this._unsigned = undefined;
      this._zerofill = undefined;
    }
  });

  var BIGINT = BaseTypes.BIGINT.inherits(function() {
    if (!(this instanceof BIGINT)) return new BIGINT();
    BaseTypes.BIGINT.apply(this, arguments);

    // MSSQL does not support any options for bigint
    if (this._length || this.options.length || this._unsigned || this._zerofill) {
      warn('MSSQL does not support BIGINT with options. Plain `BIGINT` will be used instead.');
      this._length = undefined;
      this.options.length = undefined;
      this._unsigned = undefined;
      this._zerofill = undefined;
    }
  });

  var REAL = BaseTypes.REAL.inherits(function() {
    if (!(this instanceof REAL)) return new REAL();
    BaseTypes.REAL.apply(this, arguments);

    // MSSQL does not support any options for real
    if (this._length || this.options.length || this._unsigned || this._zerofill) {
      warn('MSSQL does not support REAL with options. Plain `REAL` will be used instead.');
      this._length = undefined;
      this.options.length = undefined;
      this._unsigned = undefined;
      this._zerofill = undefined;
    }
  });

  var FLOAT = BaseTypes.FLOAT.inherits(function() {
    if (!(this instanceof FLOAT)) return new FLOAT();
    BaseTypes.FLOAT.apply(this, arguments);

    // MSSQL does only support lengths as option.
    // Values between 1-24 result in 7 digits precision (4 bytes storage size)
    // Values between 25-53 result in 15 digits precision (8 bytes storage size)
    // If decimals are provided remove these and print a warning
    if (this._decimals) {
      warn('MSSQL does not support Float with decimals. Plain `FLOAT` will be used instead.');
      this._length = undefined;
      this.options.length = undefined;
    }
    if (this._unsigned) {
      warn('MSSQL does not support Float unsigned. `UNSIGNED` was removed.');
      this._unsigned = undefined;
    }
    if (this._zerofill) {
      warn('MSSQL does not support Float zerofill. `ZEROFILL` was removed.');
      this._zerofill = undefined;
    }
  });

  var ENUM = BaseTypes.ENUM.inherits();
  ENUM.prototype.toSql = function() {
    return 'VARCHAR(255)';
  };

  var exports = {
    BLOB: BLOB,
    BOOLEAN: BOOLEAN,
    ENUM: ENUM,
    STRING: STRING,
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
