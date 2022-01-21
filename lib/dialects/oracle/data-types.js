'use strict';

const _ = require('lodash');
const moment = require('moment');
const momentTz = require('moment-timezone');

module.exports = BaseTypes => {
  const warn = BaseTypes.ABSTRACT.warn.bind(
    undefined,
    'https://docs.oracle.com/database/122/SQLRF/Data-Types.htm#SQLRF30020'
  );

  BaseTypes.DATE.types.oracle = ['TIMESTAMP', 'TIMESTAMP WITH LOCAL TIME ZONE'];
  BaseTypes.STRING.types.oracle = ['VARCHAR2', 'NVARCHAR2'];
  BaseTypes.CHAR.types.oracle = ['CHAR', 'RAW'];
  BaseTypes.TEXT.types.oracle = ['CLOB'];
  BaseTypes.TINYINT.types.oracle = false;
  BaseTypes.SMALLINT.types.oracle = false;
  BaseTypes.MEDIUMINT.types.oracle = false;
  BaseTypes.INTEGER.types.oracle = ['INTEGER'];
  BaseTypes.BIGINT.types.oracle = false;
  BaseTypes.FLOAT.types.oracle = false;
  BaseTypes.TIME.types.oracle = ['DATE'];
  BaseTypes.DATEONLY.types.oracle = ['DATE', 'DATEONLY'];
  BaseTypes.BOOLEAN.types.oracle = ['NUMBER'];
  BaseTypes.BLOB.types.oracle = ['BLOB'];
  BaseTypes.DECIMAL.types.oracle = ['DECIMAL'];
  BaseTypes.UUID.types.oracle = false;
  BaseTypes.ENUM.types.oracle = false;
  BaseTypes.REAL.types.oracle = false;
  BaseTypes.NUMERIC.types.oracle = false;
  BaseTypes.DOUBLE.types.oracle = false;
  BaseTypes.GEOMETRY.types.oracle = false;
  class STRING extends BaseTypes.STRING {
    toSql() {
      if (this.length > 4000 || (this._binary && this._length > 2000)) {
        warn(
          'Oracle 12 supports length up to 32764; be sure that your administrator has extended the MAX_STRING_SIZE parameter. Check https://docs.oracle.com/database/121/REFRN/GUID-D424D23B-0933-425F-BC69-9C0E6724693C.htm#REFRN10321'
        );
      }
      if (!this._binary) {
        return 'NVARCHAR2(' + this._length + ')';
      } else {
        return 'RAW(' + this._length + ')';
      }
    }

    _stringify(value, options) {
      if (this._binary) {
        return BaseTypes.CLOB.prototype._stringify(value);
      } else {
        return options.escape(value);
      }
    }
  }

  STRING.prototype.escape = false;

  class BOOLEAN extends BaseTypes.BOOLEAN {
    toSql() {
      return 'CHAR(1)';
    }

    _stringify(value) {
      return value ? 1 : 0;
    }

    _sanitize(value) {
      if (typeof value === 'string') {
        // Only take action on valid boolean strings.
        return value === '1' || value === 'true' ? true :  false;
      }
      return Boolean(value);
    }
  }

  class UUID extends BaseTypes.UUID {
    toSql() {
      return 'VARCHAR2(36)';
    }
  }

  class NOW extends BaseTypes.NOW {
    toSql() {
      return 'SYSDATE';
    }

    _stringify() {
      return 'SYSDATE';
    }
  }

  class ENUM extends BaseTypes.ENUM {
    toSql() {
      return 'VARCHAR2(512)';
    }
  }

  class TEXT extends BaseTypes.TEXT {
    toSql() {
      return 'CLOB';
    }
  }

  class DATE extends BaseTypes.DATE {
    toSql() {
      return 'TIMESTAMP WITH LOCAL TIME ZONE';
    }
    _stringify(date, options) {
      const format = 'YYYY-MM-DD HH24:MI:SS.FFTZH:TZM';

      date = this._applyTimezone(date, options);

      const formatedDate = date.format('YYYY-MM-DD HH:mm:ss.SSS Z');

      return `TO_TIMESTAMP_TZ('${formatedDate}','${format}')`;
    }

    _applyTimezone(date, options) {
      if (options.timezone) {
        if (momentTz.tz.zone(options.timezone)) {
          date = momentTz(date).tz(options.timezone);
        } else {
          date = moment(date).utcOffset(options.timezone);
        }
      } else {
        date = momentTz(date);
      }
      return date;
    }

    static parse(value, options) {
      if (value === null) {
        return value;
      }
      if (options && moment.tz.zone(options.timezone)) {
        value = moment.tz(value.toString(), options.timezone).toDate();
      }
      return value;
    }
  }

  DATE.prototype.escape = false;

  class DECIMAL extends BaseTypes.DECIMAL {
    constructor() {
      super();
      this.key = 'DECIMAL';
    }
    toSql() {
      let result = '';
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

      return 'NUMBER' + result;
    }
  }

  class TINYINT extends BaseTypes.TINYINT {
    toSql() {
      return 'NUMBER(3)';
    }
  }

  class SMALLINT extends BaseTypes.SMALLINT {
    toSql() {
      return 'NUMBER(5)';
    }
  }

  class MEDIUMINT extends BaseTypes.MEDIUMINT {
    toSql() {
      return 'NUMBER(8)';
    }
  }

  class BIGINT extends BaseTypes.BIGINT {
    constructor(length) {
      super(length);
      if (!(this instanceof BIGINT)) return new BIGINT(length);
      BaseTypes.BIGINT.apply(this, arguments);

      // ORACLE does not support any options for bigint
      if (this._length || this.options.length || this._unsigned || this._zerofill) {
        this._length = undefined;
        this.options.length = undefined;
        this._unsigned = undefined;
        this._zerofill = undefined;
      }
    }

    toSql() {
      return 'NUMBER(19)';
    }
  }

  class FLOAT extends BaseTypes.FLOAT {
    toSql() {
      return 'BINARY_FLOAT';
    }
  }

  class BLOB extends BaseTypes.BLOB {
    // Generic hexify returns X'${hex}' but Oracle expects '${hex}' for BLOB datatype 
    _hexify(hex) {
      return `'${hex}'`;
    }
    
    toSql() {
      return 'BLOB';
    }
  }

  class DOUBLE extends BaseTypes.DOUBLE {
    constructor(length, decimals) {
      super(length, decimals);
      if (!(this instanceof DOUBLE)) return new BaseTypes.DOUBLE(length, decimals);
      BaseTypes.DOUBLE.apply(this, arguments);

      if (this._length || this._unsigned || this._zerofill) {
        this._length = undefined;
        this.options.length = undefined;
        this._unsigned = undefined;
        this._zerofill = undefined;
      }

      this.key = 'DOUBLE PRECISION';
    }
    toSql() {
      return 'BINARY_DOUBLE';
    }
  }
  class DATEONLY extends BaseTypes.DATEONLY {
    parse(value) {
      return moment(value).format('YYYY-MM-DD');
    }

    _sanitize(value, options) {
      return moment(value).format('YYYY-MM-DD');
    }
    
    _stringify(date) {
      // If date is not null only then we format the date
      if (date) {
        const format = 'YYYY/MM/DD';
        return `TO_DATE('${date}','${format}')`;
      }
      return date
    }
  }

  DATEONLY.prototype.escape = false;

  const exports = {
    BOOLEAN,
    'DOUBLE PRECISION': DOUBLE,
    DOUBLE,
    STRING,
    TINYINT,
    SMALLINT,
    MEDIUMINT,
    BIGINT,
    FLOAT,
    UUID,
    DATEONLY,
    DATE,
    NOW,
    BLOB,
    ENUM,
    TEXT,
    DECIMAL
  };

  _.forIn(exports, (DataType, key) => {
    if (!DataType.key) DataType.key = key;
    if (!DataType.extend) {
      DataType.extend = function (oldType) {
        return new DataType(oldType.options);
      };
    }
  });

  return exports;
};
