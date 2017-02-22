'use strict';

const _ = require('lodash');
const inherits = require('../../utils/inherits');
const moment = require('moment');
const momentTz = require('moment-timezone');

module.exports = BaseTypes => {
  const warn = BaseTypes.ABSTRACT.warn.bind(undefined, 'http://docs.oracle.com/cd/A87860_01/doc/server.817/a76965/c10datyp.htm');

  BaseTypes.DATE.types.oracle = ['TIMESTAMP','TIMESTAMP WITH LOCAL TIME ZONE'];
  BaseTypes.STRING.types.oracle = ['VARCHAR2', 'NVARCHAR2'];
  BaseTypes.CHAR.types.oracle = ['CHAR', 'RAW'];
  BaseTypes.TEXT.types.oracle = false;
  BaseTypes.INTEGER.types.oracle = ['INTEGER'];
  BaseTypes.BIGINT.types.oracle = false;
  BaseTypes.FLOAT.types.oracle = false;
  BaseTypes.TIME.types.oracle = ['TIMESTAMP WITH LOCAL TIME ZONE'];
  BaseTypes.DATEONLY.types.oracle = ['DATE','DATEONLY'];
  BaseTypes.BOOLEAN.types.oracle = ['NUMBER'];
  BaseTypes.BLOB.types.oracle = ['BLOB'];
  BaseTypes.DECIMAL.types.oracle = ['DECIMAL'];
  BaseTypes.UUID.types.oracle = false;
  BaseTypes.ENUM.types.oracle = false;
  BaseTypes.REAL.types.oracle = false;
  BaseTypes.NUMERIC.types.oracle = false;
  BaseTypes.DOUBLE.types.oracle = false;
  // BaseTypes.GEOMETRY.types.oracle = [240]; // not yet supported
  BaseTypes.GEOMETRY.types.oracle = false;


  function BLOB(length) {
    if (!(this instanceof BLOB)) return new BLOB(length);
    BaseTypes.BLOB.apply(this, arguments);
  }
  inherits(BLOB, BaseTypes.BLOB);

  BLOB.prototype.toSql = function toSql() {
    if (this._length) {
      if (this._length.toLowerCase() === 'tiny') { // tiny = 2^8
        warn('ORACLE does not support BLOB with the `length` = `tiny` option. `RAW(256)` will be used instead.');
        return 'RAW(256)';
      }
      warn('ORACLE does not support BLOB with the `length` option. `RAW(2000)` will be used instead.');
      if (isNaN(this.length) || this.length > 2000) {
        return 'RAW(2000)';
      } else {
        return `RAW(${this._length})`;
      }
    }
    return 'BLOB';
  };

  BLOB.prototype._hexify = function _hexify(hex) {
    return 'hextoraw(\'' + hex + '\')';
  };

  function CHAR(length) {
    if (!(this instanceof CHAR)) return new CHAR(length);
    BaseTypes.CHAR.apply(this, arguments);
  }
  inherits(CHAR, BaseTypes.CHAR);

  CHAR.prototype.toSql = function toSql() {
    if (this._binary) {
      return 'RAW(' + this._length + ')';
    }
    return BaseTypes.CHAR.prototype.toSql.call(this);
  };

  function STRING(length, binary) {
    if (!(this instanceof STRING)) return new STRING(length, binary);
    BaseTypes.STRING.apply(this, arguments);
  }
  inherits(STRING, BaseTypes.STRING);

  STRING.prototype.toSql = function toSql() {
    if (!this._binary) {
      return 'NVARCHAR2(' + this._length + ')';
    } else{
      return 'RAW(' + this._length + ')';
    }
  };

  STRING.prototype.escape = false;

  STRING.prototype._stringify = function _stringify(value, options) {
    if (this._binary) {
      return BLOB.prototype._stringify(value);
    } else {
      return options.escape(value);
    }
  };

  function TEXT(length) {
    if (!(this instanceof TEXT)) return new TEXT(length);
    BaseTypes.TEXT.apply(this, arguments);
  }
  inherits(TEXT, BaseTypes.TEXT);

  TEXT.prototype.toSql = function toSql() {
    //TEXT is not support by Oracle, passing through NVARCHAR
    if (this._length) {
      if (this._length.toLowerCase() === 'tiny') { // tiny = 2^8
        warn('ORACLE does not support TEXT with the `length` = `tiny` option. `NVARCHAR(256)` will be used instead.');
        return 'NVARCHAR2(256)';
      }
      warn('ORACLE does not support TEXT with the `length` option. `NVARCHAR(2000)` will be used instead.');
    }
    return 'NVARCHAR2(2000)';
  };

  function BOOLEAN() {
    if (!(this instanceof BOOLEAN)) return new BOOLEAN();
    BaseTypes.BOOLEAN.apply(this, arguments);
  }
  inherits(BOOLEAN, BaseTypes.BOOLEAN);


  BOOLEAN.prototype.toSql = function toSql() {
    return 'NUMBER(1)';
  };

  BOOLEAN.prototype._stringify = function _stringify(value, options) {
    return !!value ? 1 : 0;
  };

  function UUID() {
    if (!(this instanceof UUID)) return new UUID();
    BaseTypes.UUID.apply(this, arguments);
  }
  inherits(UUID, BaseTypes.UUID);

  UUID.prototype.toSql = function toSql() {
    return 'NVARCHAR2(36)'; 
  };

  /*UUID.prototype._stringify = function _stringify(value, options) {
    return "HEXTORAW('" + value + "')";
  };*/

  function NOW() {
    if (!(this instanceof NOW)) return new NOW();
    BaseTypes.NOW.apply(this, arguments);
  }
  inherits(NOW, BaseTypes.NOW);


  NOW.prototype.toSql = function toSql() {
    return 'SELECT TO_CHAR(SYSDATE, \'YYYY-MM-DD HH24:MI:SS\') "NOW" FROM DUAL;';
  };

  NOW.prototype._stringify = function _stringify(value, options) {
    return 'SELECT TO_CHAR(SYSDATE, \'YYYY-MM-DD HH24:MI:SS\') "NOW" FROM DUAL;';
  };

  function TIME(length) {
    if (!(this instanceof TIME)) return new TIME(length);
    BaseTypes.TIME.apply(this, arguments);
  }
  inherits(TIME, BaseTypes.TIME);

  TIME.prototype.escape = false;

  TIME.prototype.toSql = function toSql() {
    return 'TIMESTAMP WITH LOCAL TIME ZONE';
  };

  TIME.prototype._applyTimezone = function _applyTimezone(date, options) {
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
  };
  
  TIME.prototype._stringify = function _stringify(date, options) {
    const format = 'HH24:MI:SS.FFTZH:TZM';

    //Oracle has no TIME object, we have to deal it as a real date and insert only the time we need
    let momentDate = moment(date);
    momentDate = this._applyTimezone(momentDate, options);
    let formatedDate = momentDate.format('HH:mm:ss.SSS Z');

    return `TO_TIMESTAMP_TZ('${formatedDate}','${format}')`;
  };

  function DATE(length) {
    if (!(this instanceof DATE)) return new DATE(length);
    BaseTypes.DATE.apply(this, arguments);
  }
  inherits(DATE, BaseTypes.DATE);

  DATE.prototype.escape = false;

  DATE.prototype.toSql = function toSql() {
    return 'TIMESTAMP WITH LOCAL TIME ZONE';
  };

  DATE.prototype._stringify = function _stringify(date, options) {
    const format = 'YYYY-MM-DD HH24:MI:SS.FFTZH:TZM';

    date = this._applyTimezone(date, options);

    let formatedDate = date.format('YYYY-MM-DD HH:mm:ss.SSS Z');

    return `TO_TIMESTAMP_TZ('${formatedDate}','${format}')`;
  };

  function DECIMAL(precision, scale) {
    if (!(this instanceof DECIMAL)) return new DECIMAL(precision, scale);
    BaseTypes.DECIMAL.apply(this, arguments);
  }
  inherits(DECIMAL, BaseTypes.DECIMAL);

  DECIMAL.prototype.key = DECIMAL.key = 'DECIMAL';

  DECIMAL.prototype.toSql = function toSql() {
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
  };

  function INTEGER(length) {
    if (!(this instanceof BaseTypes.INTEGER)) return new INTEGER(length);
    BaseTypes.INTEGER.apply(this, arguments);

    if (this._zerofill) {
      warn('ORACLE does not support INTEGER with options. Plain `INTEGER` will be used instead.');
      this._zerofill = undefined;
    }
    return BaseTypes.INTEGER.prototype.toSql.call(this);
  }
  inherits(INTEGER, BaseTypes.INTEGER);

  INTEGER.prototype.toSql = function toSql() {
    if (this._unsigned) {
      if (this._length) {
        return 'INTEGER(' + this._length + ')';
      }
      return 'INTEGER';
    }
    return 'INTEGER';
  };


  function BIGINT(length) {
    warn('Oracle does not support BIGINT. Plain `NUMBER(19)` will be used instead.');
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
  inherits(BIGINT, BaseTypes.BIGINT);

  BIGINT.prototype.toSql = function toSql() {
    return 'NUMBER(19)';
  };

  function REAL(length, decimals) {
    if (!(this instanceof REAL)) return new REAL(length, decimals);
    BaseTypes.REAL.apply(this, arguments);
  }
  inherits(REAL, BaseTypes.REAL);

  REAL.prototype.toSql = function() {
    return 'REAL';
  };


  function FLOAT(length, decimals) {
    if (!(this instanceof FLOAT)) return new FLOAT(length, decimals);
    BaseTypes.FLOAT.apply(this, arguments);
  }
  inherits(FLOAT, BaseTypes.FLOAT);

  FLOAT.prototype.toSql = function toSql() {
    if (this._length) {
      return 'FLOAT(' + this._length + ')';  
    }
    return 'FLOAT';
  };

  function DOUBLE(length, decimals) {
    if (!(this instanceof DOUBLE)) return new BaseTypes.DOUBLE(length, decimals);
    BaseTypes.DOUBLE.apply(this, arguments);

    if (this._length || this._unsigned || this._zerofill) {
      this._length = undefined;
      this.options.length = undefined;
      this._unsigned = undefined;
      this._zerofill = undefined;
    }
  }

  DOUBLE.prototype.key = DOUBLE.key = 'DOUBLE PRECISION';

  DOUBLE.prototype.toSql = function toSql() {
    return 'NUMBER(15,5)';
  };

  function ENUM() {
    if (!(this instanceof ENUM)) {
      const obj = Object.create(ENUM.prototype);
      ENUM.apply(obj, arguments);
      return obj;
    }
    BaseTypes.ENUM.apply(this, arguments);
  }
  inherits(ENUM, BaseTypes.ENUM);

  ENUM.prototype.toSql = function toSql() {
    return 'NVARCHAR2(255)';
  };

  function DATEONLY() {
    if (!(this instanceof DATEONLY)) return new DATEONLY();
    BaseTypes.DATEONLY.apply(this, arguments);
  }
  inherits(DATEONLY, BaseTypes.DATEONLY);

  DATEONLY.parse = function (value) {
    return moment(value).format('YYYY-MM-DD');
  };

  const exports = {
    BLOB,
    BOOLEAN,
    'DOUBLE PRECISION': DOUBLE,
    DOUBLE,
    ENUM,
    STRING,
    BIGINT,
    CHAR,
    UUID,
    DATEONLY,
    DATE,
    NOW,
    INTEGER,
    REAL,
    TIME,
    DECIMAL,
    FLOAT,
    TEXT
  };

  _.forIn(exports, (DataType, key) => {
    if (!DataType.key) DataType.key = key;
    if (!DataType.extend) {
      DataType.extend = function(oldType) {
        return new DataType(oldType.options);
      };
    }
  });

  return exports;
};
