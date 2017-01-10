'use strict';

const _ = require('lodash');
const inherits = require('../../utils/inherits');

module.exports = BaseTypes => {
  const warn = BaseTypes.ABSTRACT.warn.bind(undefined, 'http://docs.oracle.com/cd/A87860_01/doc/server.817/a76965/c10datyp.htm');

  BaseTypes.DATE.types.oracle = ['TIMESTAMP','TIMESTAMP WITH TIME ZONE'];
  BaseTypes.STRING.types.oracle = ['VARCHAR2', 'NVARCHAR2'];
  BaseTypes.CHAR.types.oracle = ['CHAR', 'VARBINARY'];
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


  function BLOB(length) {
    if (!(this instanceof BLOB)) return new BLOB(length);
    BaseTypes.BLOB.apply(this, arguments);
  }
  inherits(BLOB, BaseTypes.BLOB);

  BLOB.prototype.toSql = function toSql() {
    if (this._length) {
      if (this._length.toLowerCase() === 'tiny') { // tiny = 2^8
        warn('ORACLE does not support BLOB with the `length` = `tiny` option. `VARBINARY(256)` will be used instead.');
        return 'VARBINARY(256)';
      }
      warn('ORACLE does not support BLOB with the `length` option. `VARBINARY(2000)` will be used instead.');
      if(isNaN(this.length) || this.length > 2000) {
        return 'VARBINARY(2000)';
      } else {
        return `VARBINARY(${this._length})`;
      }
    }
    return 'BLOB';
  };

  BLOB.prototype._hexify = function _hexify(hex) {
    return '0x' + hex;
  };


  function CHAR(length) {
    if (!(this instanceof CHAR)) return new CHAR(length);
    BaseTypes.CHAR.apply(this, arguments);
  }
  inherits(CHAR, BaseTypes.CHAR);

  CHAR.prototype.toSql = function toSql() {
    if (this._binary) {
      return 'VARBINARY(' + this._length + ')';
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
      return 'VARBINARY(' + this._length + ')';
    }
  };

  STRING.prototype.escape = false;

  STRING.prototype._stringify = function _stringify(value, options) {
    if (this._binary) {
      return BLOB.prototype.$stringify(value);
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
    // TEXT is deprecated in mssql and it would normally be saved as a non-unicode string.
    // Using unicode is just future proof
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



//TO_DATE(SYSDATE, 'YYYY-MM-DD HH24:MI:SS')
  //VOIR si il faut pas passer par un select from dual
  NOW.prototype.toSql = function toSql() {
    return 'SELECT TO_CHAR(SYSDATE, \'YYYY-MM-DD HH24:MI:SS\') "NOW" FROM DUAL;';
  };

  NOW.prototype._stringify = function _stringify(value, options) {
    return 'SELECT TO_CHAR(SYSDATE, \'YYYY-MM-DD HH24:MI:SS\') "NOW" FROM DUAL;';
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

    return "TO_TIMESTAMP_TZ('" + formatedDate + "','" + format + "')";
  };

  function DECIMAL(length) {
    if (!(this instanceof BaseTypes.NUMBER)) return new DECIMAL(length);
    BaseTypes.NUMBER.apply(this, arguments);
  }
  inherits(DECIMAL, BaseTypes.NUMBER);

  DECIMAL.prototype.toSql = function toSql() {
    let result = this.key;
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

    return result;
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

  BaseTypes.INTEGER.prototype.toSql = function toSql() {
    if(this._unsigned) {
      if(this._length) {
        return 'INTEGER(' + this._length + ')';
      }
      return 'INTEGER';
    }
    return 'INTEGER';
  };


  function BIGINT(length) {
    if (!(this instanceof BIGINT)) return new BIGINT(length);
    BaseTypes.BIGINT.apply(this, arguments);

    // ORACLE does not support any options for bigint
    if (this._length || this.options.length || this._unsigned || this._zerofill) {
      warn('Oracle does not support BIGINT with options. Plain `NUMBER(19)` will be used instead.');
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
    if(this._length) {
      return 'FLOAT(' + this._length + ')';  
    }
    return 'FLOAT';
  };

  function DOUBLE(length, decimals) {
    if (!(this instanceof DOUBLE)) return new BaseTypes.DOUBLE(length, decimals);
    BaseTypes.NUMBER.apply(this, arguments);

    if (this._length || this._unsigned || this._zerofill) {
      this._length = undefined;
      this.options.length = undefined;
      this._unsigned = undefined;
      this._zerofill = undefined;
    }
  }

  DOUBLE.prototype.key = DOUBLE.key = 'DOUBLE PRECISION';

  DOUBLE.prototype.toSql = function() {
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

  const exports = {
    BLOB,
    BOOLEAN,
    'DOUBLE PRECISION': DOUBLE,
    DOUBLE,
    ENUM,
    STRING,
    DECIMAL,
    CHAR,
    UUID,
    DATE,
    NOW,
    INTEGER,
    BIGINT,
    REAL,
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
