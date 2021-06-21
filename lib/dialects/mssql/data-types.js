'use strict';

const moment = require('moment');

module.exports = BaseTypes => {
  const warn = BaseTypes.ABSTRACT.warn.bind(undefined, 'https://msdn.microsoft.com/en-us/library/ms187752%28v=sql.110%29.aspx');

  /**
   * Removes unsupported MSSQL options, i.e., LENGTH, UNSIGNED and ZEROFILL, for the integer data types.
   *
   * @param {object} dataType The base integer data type.
   * @private
   */
  function removeUnsupportedIntegerOptions(dataType) {
    if (dataType._length || dataType.options.length || dataType._unsigned || dataType._zerofill) {
      warn(`MSSQL does not support '${dataType.key}' with options. Plain '${dataType.key}' will be used instead.`);
      dataType._length = undefined;
      dataType.options.length = undefined;
      dataType._unsigned = undefined;
      dataType._zerofill = undefined;
    }
  }

  /**
   * types: [hex, ...]
   *
   * @see hex here https://github.com/tediousjs/tedious/blob/master/src/data-type.ts
   */

  BaseTypes.DATE.types.mssql = [43];
  BaseTypes.STRING.types.mssql = [231, 173];
  BaseTypes.CHAR.types.mssql = [175];
  BaseTypes.TEXT.types.mssql = false;
  // https://msdn.microsoft.com/en-us/library/ms187745(v=sql.110).aspx
  BaseTypes.TINYINT.types.mssql = [30];
  BaseTypes.SMALLINT.types.mssql = [34];
  BaseTypes.MEDIUMINT.types.mssql = false;
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

  class BLOB extends BaseTypes.BLOB {
    toSql() {
      if (this._length) {
        if (this._length.toLowerCase() === 'tiny') { // tiny = 2^8
          warn('MSSQL does not support BLOB with the `length` = `tiny` option. `VARBINARY(256)` will be used instead.');
          return 'VARBINARY(256)';
        }
        warn('MSSQL does not support BLOB with the `length` option. `VARBINARY(MAX)` will be used instead.');
      }
      return 'VARBINARY(MAX)';
    }
    _hexify(hex) {
      return `0x${hex}`;
    }
  }


  class STRING extends BaseTypes.STRING {
    toSql() {
      if (!this._binary) {
        return `NVARCHAR(${this._length})`;
      }
      return `BINARY(${this._length})`;
    }
    _stringify(value, options) {
      if (this._binary) {
        return BLOB.prototype._stringify(value);
      }
      return options.escape(value);
    }
    _bindParam(value, options) {
      return options.bindParam(this._binary ? Buffer.from(value) : value);
    }
  }

  STRING.prototype.escape = false;

  class TEXT extends BaseTypes.TEXT {
    toSql() {
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
    }
  }

  class BOOLEAN extends BaseTypes.BOOLEAN {
    toSql() {
      return 'BIT';
    }
  }

  class UUID extends BaseTypes.UUID {
    toSql() {
      return 'CHAR(36)';
    }
  }

  class NOW extends BaseTypes.NOW {
    toSql() {
      return 'GETDATE()';
    }
  }

  class DATE extends BaseTypes.DATE {
    toSql() {
      return 'DATETIMEOFFSET';
    }
  }

  class DATEONLY extends BaseTypes.DATEONLY {
    static parse(value) {
      return moment(value).format('YYYY-MM-DD');
    }
  }

  class INTEGER extends BaseTypes.INTEGER {
    constructor(length) {
      super(length);
      removeUnsupportedIntegerOptions(this);
    }
  }
  class TINYINT extends BaseTypes.TINYINT {
    constructor(length) {
      super(length);
      removeUnsupportedIntegerOptions(this);
    }
  }
  class SMALLINT extends BaseTypes.SMALLINT {
    constructor(length) {
      super(length);
      removeUnsupportedIntegerOptions(this);
    }
  }
  class BIGINT extends BaseTypes.BIGINT {
    constructor(length) {
      super(length);
      removeUnsupportedIntegerOptions(this);
    }
  }
  class REAL extends BaseTypes.REAL {
    constructor(length, decimals) {
      super(length, decimals);
      // MSSQL does not support any options for real
      if (this._length || this.options.length || this._unsigned || this._zerofill) {
        warn('MSSQL does not support REAL with options. Plain `REAL` will be used instead.');
        this._length = undefined;
        this.options.length = undefined;
        this._unsigned = undefined;
        this._zerofill = undefined;
      }
    }
  }
  class FLOAT extends BaseTypes.FLOAT {
    constructor(length, decimals) {
      super(length, decimals);
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
    }
  }
  class ENUM extends BaseTypes.ENUM {
    toSql() {
      return 'VARCHAR(255)';
    }
  }

  return {
    BLOB,
    BOOLEAN,
    ENUM,
    STRING,
    UUID,
    DATE,
    DATEONLY,
    NOW,
    TINYINT,
    SMALLINT,
    INTEGER,
    BIGINT,
    REAL,
    FLOAT,
    TEXT
  };
};
