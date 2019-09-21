'use strict';

module.exports = BaseTypes => {
  const warn = BaseTypes.ABSTRACT.warn.bind(undefined, 'https://www.sqlite.org/datatype3.html');

  /**
   * Removes unsupported SQLite options, i.e., UNSIGNED and ZEROFILL, for the integer data types.
   *
   * @param {Object} dataType The base integer data type.
   * @private
   */
  function removeUnsupportedIntegerOptions(dataType) {
    if (dataType._zerofill || dataType._unsigned) {
      warn(`SQLite does not support '${dataType.key}' with UNSIGNED or ZEROFILL. Plain '${dataType.key}' will be used instead.`);
      dataType._unsigned = undefined;
      dataType._zerofill = undefined;
    }
  }

  /**
   * @see https://sqlite.org/datatype3.html
   */

  BaseTypes.DATE.types.sqlite = ['DATETIME'];
  BaseTypes.STRING.types.sqlite = ['VARCHAR', 'VARCHAR BINARY'];
  BaseTypes.CHAR.types.sqlite = ['CHAR', 'CHAR BINARY'];
  BaseTypes.TEXT.types.sqlite = ['TEXT'];
  BaseTypes.TINYINT.types.sqlite = ['TINYINT'];
  BaseTypes.SMALLINT.types.sqlite = ['SMALLINT'];
  BaseTypes.MEDIUMINT.types.sqlite = ['MEDIUMINT'];
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
  BaseTypes.JSON.types.sqlite = ['JSON', 'JSONB'];

  class JSONTYPE extends BaseTypes.JSON {
    static parse(data) {
      return JSON.parse(data);
    }
  }

  class DATE extends BaseTypes.DATE {
    static parse(date, options) {
      if (!date.includes('+')) {
        // For backwards compat. Dates inserted by sequelize < 2.0dev12 will not have a timestamp set
        return new Date(date + options.timezone);
      }
      return new Date(date); // We already have a timezone stored in the string
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
        return `VARCHAR BINARY(${this._length})`;
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
    'DOUBLE PRECISION': DOUBLE,
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
