'use strict';

const moment = require('moment');

module.exports = BaseTypes => {
  const warn = BaseTypes.ABSTRACT.warn.bind(undefined, 'https://www.ibm.com/support/knowledgecenter/en/ssw_ibm_i_73/db2/rbafzch2data.htm');

  /**
   * Removes unsupported Db2 for i options, i.e., UNSIGNED and ZEROFILL, for the integer data types.
   *
   * @param {Object} dataType The base integer data type.
   * @private
   */
  function removeUnsupportedIntegerOptions(dataType) {
    if (dataType._length || dataType.options.length || dataType._zerofill || dataType._unsigned) {
      warn(`IBM i Db2 does not support '${dataType.key}' with LENGTH, UNSIGNED or ZEROFILL. Plain '${dataType.key}' will be used instead.`);
      dataType._length = undefined;
      dataType.options.length = undefined;
      dataType._unsigned = undefined;
      dataType._zerofill = undefined;
    }
  }

  /**
   * @see https://www.ibm.com/support/knowledgecenter/en/ssw_ibm_i_73/db2/rbafzch2data.htm
   */

  BaseTypes.DATE.types.ibmi = [93];
  BaseTypes.STRING.types.ibmi = [12];
  BaseTypes.CHAR.types.ibmi = [1];
  BaseTypes.TEXT.types.ibmi = [12];
  BaseTypes.TINYINT.types.ibmi = false;
  BaseTypes.SMALLINT.types.ibmi = [5];
  BaseTypes.MEDIUMINT.types.ibmi = false;
  BaseTypes.INTEGER.types.ibmi = [4];
  BaseTypes.BIGINT.types.ibmi = [-5];
  BaseTypes.FLOAT.types.ibmi = [8]; // TODO: See what this maps to in ODBC
  BaseTypes.TIME.types.ibmi = [92];
  BaseTypes.DATEONLY.types.ibmi = [91];
  BaseTypes.BOOLEAN.types.ibmi = [5];
  BaseTypes.BLOB.types.ibmi = [-4];
  BaseTypes.DECIMAL.types.ibmi = [3];
  BaseTypes.UUID.types.ibmi = [1];
  BaseTypes.ENUM.types.ibmi = false;
  BaseTypes.REAL.types.ibmi = [7];
  BaseTypes.DOUBLE.types.ibmi = [8];
  BaseTypes.GEOMETRY.types.ibmi = false;
  BaseTypes.JSON.types.ibmi = false;

  class ENUM extends BaseTypes.ENUM {
    toSql() {
      return 'VARCHAR(255)';
    }
  }

  class DATE extends BaseTypes.DATE {
    toSql() {
      return 'TIMESTAMP';
    }
    static parse(date) {
      if (!date.includes('+')) {
        // For backwards compat. Dates inserted by sequelize < 2.0dev12 will not have a timestamp set
        const mome = moment.utc(date);
        return mome.toDate();
      }
      const mome = moment.utc(date);
      return mome.toDate();
    }
    _stringify(date, options) {
      date = this._applyTimezone(date, options);
      return date.format('YYYY-MM-DD HH:mm:ss.SSS');
    }
  }

  class UUID extends BaseTypes.UUID {
    toSql() {
      return 'CHAR(36)';
    }
  }

  class DATEONLY extends BaseTypes.DATEONLY {
    static parse(date) {
      return date;
    }
  }

  class BOOLEAN extends BaseTypes.BOOLEAN {
    toSql() {
      return 'SMALLINT';
    }
    _stringify(value) {
      if (value) {
        return 1;
      }
      return 0;
    }
  }

  class STRING extends BaseTypes.STRING {
    toSql() {
      if (this._binary) {
        return `CLOB(${this._length})`;
      }
      return super.toSql(this);
    }
    _stringify(value, options) {
      if (Buffer.isBuffer(value)) {
        options.field.type.escape = false;
        return `CLOB('${value.toString().replace(/'/g, "''")}')`;
      }
      return value;
    }

  }

  class TEXT extends BaseTypes.TEXT {
    toSql() {
      return `VARCHAR${this._length ? `(${this._length})` : '(1024)'}`;
    }
  }

  class CHAR extends BaseTypes.CHAR {
    toSql() {
      if (this._binary) {
        return `CLOB(${this._length})`;
      }
      return super.toSql();
    }
  }

  class NUMBER extends BaseTypes.NUMBER {
    toSql() {
      let result = this.key;
      if (this._length) {
        result += `(${this._length}`;
        if (typeof this._decimals === 'number') {
          result += `,${this._decimals}`;
        }
        result += ')';
      }
      return result;
    }
  }

  class SMALLINT extends BaseTypes.SMALLINT {
    constructor(length) {
      super(length);
      removeUnsupportedIntegerOptions(this);
    }
  }

  class INTEGER extends BaseTypes.INTEGER {
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
    // _stringify(value) {
    //   return value;
    // }
  }

  class FLOAT extends BaseTypes.FLOAT {
    constructor(length, decimals) {
      super(length, decimals);
      if (this._decimals) {
        warn('Db2 for i does not support FLOAT with decimal scale. FLOAT will be used instead. If you want to specify scale, use DECIMAL or NUMERIC data types.');
        this._length = undefined;
        this._decimals = undefined;
      }
    }
  }

  class DOUBLE extends BaseTypes.DOUBLE {
  }

  class REAL extends BaseTypes.REAL {
    constructor(length) {
      super(length);
      removeUnsupportedIntegerOptions(this);
    }
  }

  class BLOB extends BaseTypes.BLOB {
    toSql() {
      if (this._length) {
        if (this._length.toLowerCase() === 'tiny') { // tiny = 255 bytes
          return 'BLOB(255)';
        }
        if (this._length.toLowerCase() === 'medium') { // medium = 16M
          return 'BLOB(16M)';
        }
        if (this._length.toLowerCase() === 'long') { // long = 2GB
          return 'BLOB(2G)';
        }
        return `BLOB(${ this._length })`;
      }
      return 'BLOB(1M)';
    }
    _stringify(value) {
      if (Buffer.isBuffer(value)) {
        return `BLOB('${ value.toString().replace(/'/g, "''") }')`;
      }
      if (Array.isArray(value)) {
        value = Buffer.from(value);
      } else {
        value = Buffer.from(value.toString());
      }
      return `BLOB('${value}')`;
    }
  }

  function parseFloating(value) {
    if (typeof value !== 'string') {
      return value;
    }
    if (value === 'NaN') {
      return NaN;
    }
    if (value === 'Infinity') {
      return Infinity;
    }
    if (value === '-Infinity') {
      return -Infinity;
    }
  }
  for (const floating of [FLOAT, DOUBLE, REAL]) {
    floating.parse = parseFloating;
  }


  for (const num of [FLOAT, DOUBLE, REAL, SMALLINT, INTEGER]) {
    num.prototype.toSql = NUMBER.prototype.toSql;
  }

  return {
    BOOLEAN,
    DATE,
    DATEONLY,
    STRING,
    CHAR,
    NUMBER,
    FLOAT,
    ENUM,
    REAL,
    SMALLINT,
    INTEGER,
    BIGINT,
    TEXT,
    UUID,
    BLOB
  };
};
