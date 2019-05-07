'use strict';

module.exports = BaseTypes => {
  const warn = BaseTypes.ABSTRACT.warn.bind(undefined, 'https://www.ibm.com/support/knowledgecenter/en/ssw_ibm_i_73/db2/rbafzch2data.htm');

  /**
   * Removes unsupported IBM i Db2 options, i.e., UNSIGNED and ZEROFILL, for the integer data types.
   *
   * @param {Object} dataType The base integer data type.
   * @private
   */
  function removeUnsupportedIntegerOptions(dataType) {
    if (dataType._zerofill || dataType._unsigned) {
      warn(`IBM i Db2 does not support '${dataType.key}' with UNSIGNED or ZEROFILL. Plain '${dataType.key}' will be used instead.`);
      dataType._unsigned = undefined;
      dataType._zerofill = undefined;
    }
  }

  /**
   * @see https://www.ibm.com/support/knowledgecenter/en/ssw_ibm_i_73/db2/rbafzch2data.htm
   */

  BaseTypes.DATE.types.ibmi = ['TIMESTAMP'];
  BaseTypes.STRING.types.ibmi = ['VARCHAR'];
  BaseTypes.CHAR.types.ibmi = ['CHAR'];
  // BaseTypes.TEXT.types.ibmi = ['VARCHAR'];
  BaseTypes.TEXT.types.ibmi = false;
  BaseTypes.TINYINT.types.ibmi = ['SMALLINT'];
  BaseTypes.SMALLINT.types.ibmi = ['SMALLINT'];
  BaseTypes.MEDIUMINT.types.ibmi = ['INTEGER'];
  BaseTypes.INTEGER.types.ibmi = ['INTEGER'];
  BaseTypes.BIGINT.types.ibmi = ['BIGINT'];
  BaseTypes.FLOAT.types.ibmi = ['DECFLOAT'];
  BaseTypes.TIME.types.ibmi = ['TIME'];
  BaseTypes.DATEONLY.types.ibmi = ['DATE'];
  BaseTypes.BOOLEAN.types.ibmi = ['SMALLINT'];
  BaseTypes.BLOB.types.ibmi = ['VARBINARY', 'BLOB'];
  BaseTypes.DECIMAL.types.ibmi = ['DECIMAL'];
  BaseTypes.UUID.types.ibmi = ['VARCHAR'];
  BaseTypes.ENUM.types.ibmi = false;
  BaseTypes.REAL.types.ibmi = ['REAL'];
  BaseTypes.DOUBLE.types.ibmi = ['DOUBLE'];
  BaseTypes.GEOMETRY.types.ibmi = false;
  BaseTypes.JSON.types.ibmi = ['VARCHAR'];

  class JSONTYPE extends BaseTypes.JSON {
    static parse(data) {
      return JSON.parse(data);
    }
  }

  class DATE extends BaseTypes.DATE {
    toSql() {
      return 'TIMESTAMP';
    }
    static parse(date, options) {
      if (!date.includes('+')) {
        // For backwards compat. Dates inserted by sequelize < 2.0dev12 will not have a timestamp set
        return new Date(date);
      }
      return new Date(date); // We already have a timezone stored in the string
    }
    _stringify(date, options) {
      date = this._applyTimezone(date, options);
      return date.format('YYYY-MM-DD HH:mm:ss.SSS');
    }
  }

  class DATEONLY extends BaseTypes.DATEONLY {
    static parse(date) {
      return date;
    }
  }

  class STRING extends BaseTypes.STRING {
    toSql() {
      if (this._binary) {
        return `VARBINARY(${this._length})`;
      }
      return super.toSql(this);
    }
  }

  class TEXT extends BaseTypes.TEXT {
    toSql() {
      if (this._length) {
        warn('SQLite does not support TEXT with options. Plain `TEXT` will be used instead.');
        this._length = undefined;
      }
      return 'TEXT';
    }
  }

  class CITEXT extends BaseTypes.CITEXT {
    toSql() {
      return 'TEXT COLLATE NOCASE';
    }
  }

  class CHAR extends BaseTypes.CHAR {
    toSql() {
      if (this._binary) {
        return `CHAR BINARY(${this._length})`;
      }
      return super.toSql();
    }
  }

  class NUMBER extends BaseTypes.NUMBER {
    toSql() {
      let result = this.key;
      if (this._unsigned) {
        result += ' UNSIGNED';
      }
      if (this._zerofill) {
        result += ' ZEROFILL';
      }
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

  class MEDIUMINT extends BaseTypes.MEDIUMINT {
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
  }

  class FLOAT extends BaseTypes.FLOAT {
  }

  class DOUBLE extends BaseTypes.DOUBLE {
  }

  class REAL extends BaseTypes.REAL { }

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


  for (const num of [FLOAT, DOUBLE, REAL, TINYINT, SMALLINT, MEDIUMINT, INTEGER, BIGINT]) {
    num.prototype.toSql = NUMBER.prototype.toSql;
  }

  class ENUM extends BaseTypes.ENUM {
    toSql() {
      return 'TEXT';
    }
  }

  return {
    DATE,
    DATEONLY,
    STRING,
    CHAR,
    NUMBER,
    FLOAT,
    REAL,
    'DOUBLE': DOUBLE,
    TINYINT,
    SMALLINT,
    MEDIUMINT,
    INTEGER,
    BIGINT,
    TEXT,
    ENUM,
    JSON: JSONTYPE,
    CITEXT
  };
};
