'use strict';

/*jshint -W110 */

const _ = require('lodash');
const wkx = require('wkx');
const inherits = require('../../utils/inherits');

module.exports = BaseTypes => {
  const warn = BaseTypes.ABSTRACT.warn.bind(undefined, 'http://www.postgresql.org/docs/9.4/static/datatype.html');

  BaseTypes.UUID.types.postgres = {
    oids: [2950],
    array_oids: [2951]
  };

  BaseTypes.JSON.types.postgres = {
    oids: [114],
    array_oids: [199]
  };

  BaseTypes.JSONB.types.postgres = {
    oids: [3802],
    array_oids: [3807]
  };

  BaseTypes.TIME.types.postgres = {
    oids: [1083],
    array_oids: [1183]
  };

  function DATEONLY() {
    if (!(this instanceof DATEONLY)) return new DATEONLY();
    BaseTypes.DATEONLY.apply(this, arguments);
  }
  inherits(DATEONLY, BaseTypes.DATEONLY);

  DATEONLY.parse = function parse(value) {
    return value;
  };

  BaseTypes.DATEONLY.types.postgres = {
    oids: [1082],
    array_oids: [1182]
  };

  function DECIMAL(precision, scale) {
    if (!(this instanceof DECIMAL)) return new DECIMAL(precision, scale);
    BaseTypes.DECIMAL.apply(this, arguments);
  }
  inherits(DECIMAL, BaseTypes.DECIMAL);

  DECIMAL.parse = function parse(value) {
    return value;
  };

  // numeric
  BaseTypes.DECIMAL.types.postgres = {
    oids: [1700],
    array_oids: [1231]
  };

  function STRING(length, binary) {
    if (!(this instanceof STRING)) return new STRING(length, binary);
    BaseTypes.STRING.apply(this, arguments);
  }
  inherits(STRING, BaseTypes.STRING);

  STRING.prototype.toSql = function toSql() {
    if (this._binary) {
      return 'BYTEA';
    }
    return BaseTypes.STRING.prototype.toSql.call(this);
  };

  BaseTypes.STRING.types.postgres = {
    oids: [1043],
    array_oids: [1015]
  };

  function TEXT(length) {
    if (!(this instanceof TEXT)) return new TEXT(length);
    BaseTypes.TEXT.apply(this, arguments);
  }
  inherits(TEXT, BaseTypes.TEXT);

  TEXT.prototype.toSql = function toSql() {
    if (this._length) {
      warn('PostgreSQL does not support TEXT with options. Plain `TEXT` will be used instead.');
      this._length = undefined;
    }
    return 'TEXT';
  };

  BaseTypes.TEXT.types.postgres = {
    oids: [25],
    array_oids: [1009]
  };

  function CHAR(length, binary) {
    if (!(this instanceof CHAR)) return new CHAR(length, binary);
    BaseTypes.CHAR.apply(this, arguments);
  }
  inherits(CHAR, BaseTypes.CHAR);

  CHAR.prototype.toSql = function toSql() {
    if (this._binary) {
      return 'BYTEA';
    }
    return BaseTypes.CHAR.prototype.toSql.call(this);
  };

  BaseTypes.CHAR.types.postgres = {
    oids: [18, 1042],
    array_oids: [1002, 1014]
  };

  function BOOLEAN() {
    if (!(this instanceof BOOLEAN)) return new BOOLEAN();
    BaseTypes.BOOLEAN.apply(this, arguments);
  }
  inherits(BOOLEAN, BaseTypes.BOOLEAN);

  BOOLEAN.prototype.toSql = function toSql() {
    return 'BOOLEAN';
  };

  BaseTypes.BOOLEAN.types.postgres = {
    oids: [16],
    array_oids: [1000]
  };

  function DATE(length) {
    if (!(this instanceof DATE)) return new DATE(length);
    BaseTypes.DATE.apply(this, arguments);
  }
  inherits(DATE, BaseTypes.DATE);

  DATE.prototype.toSql = function toSql() {
    return 'TIMESTAMP WITH TIME ZONE';
  };

  BaseTypes.DATE.types.postgres = {
    oids: [1184],
    array_oids: [1185]
  };

  function INTEGER(length) {
    if (!(this instanceof INTEGER)) return new INTEGER(length);
    BaseTypes.INTEGER.apply(this, arguments);

    // POSTGRES does not support any parameters for integer
    if (this._length || this.options.length || this._unsigned || this._zerofill) {
      warn('PostgreSQL does not support INTEGER with options. Plain `INTEGER` will be used instead.');
      this._length = undefined;
      this.options.length = undefined;
      this._unsigned = undefined;
      this._zerofill = undefined;
    }
  }
  inherits(INTEGER, BaseTypes.INTEGER);

  INTEGER.parse = function parse(value) {
    return parseInt(value, 10);
  };

  // int4
  BaseTypes.INTEGER.types.postgres = {
    oids: [23],
    array_oids: [1007]
  };

  function BIGINT(length) {
    if (!(this instanceof BIGINT)) return new BIGINT(length);
    BaseTypes.BIGINT.apply(this, arguments);

    // POSTGRES does not support any parameters for bigint
    if (this._length || this.options.length || this._unsigned || this._zerofill) {
      warn('PostgreSQL does not support BIGINT with options. Plain `BIGINT` will be used instead.');
      this._length = undefined;
      this.options.length = undefined;
      this._unsigned = undefined;
      this._zerofill = undefined;
    }
  }
  inherits(BIGINT, BaseTypes.BIGINT);

  // int8
  BaseTypes.BIGINT.types.postgres = {
    oids: [20],
    array_oids: [1016]
  };

  function REAL(length, decimals) {
    if (!(this instanceof REAL)) return new REAL(length, decimals);
    BaseTypes.REAL.apply(this, arguments);

    // POSTGRES does not support any parameters for real
    if (this._length || this.options.length || this._unsigned || this._zerofill) {
      warn('PostgreSQL does not support REAL with options. Plain `REAL` will be used instead.');
      this._length = undefined;
      this.options.length = undefined;
      this._unsigned = undefined;
      this._zerofill = undefined;
    }
  }
  inherits(REAL, BaseTypes.REAL);

  // float4
  BaseTypes.REAL.types.postgres = {
    oids: [700],
    array_oids: [1021]
  };

  function DOUBLE(length, decimals) {
    if (!(this instanceof DOUBLE)) return new DOUBLE(length, decimals);
    BaseTypes.DOUBLE.apply(this, arguments);

    // POSTGRES does not support any parameters for double
    if (this._length || this.options.length || this._unsigned || this._zerofill) {
      warn('PostgreSQL does not support DOUBLE with options. Plain `DOUBLE` will be used instead.');
      this._length = undefined;
      this.options.length = undefined;
      this._unsigned = undefined;
      this._zerofill = undefined;
    }
  }
  inherits(DOUBLE, BaseTypes.DOUBLE);

  // float8
  BaseTypes.DOUBLE.types.postgres = {
    oids: [701],
    array_oids: [1022]
  };

  function FLOAT(length, decimals) {
    if (!(this instanceof FLOAT)) return new FLOAT(length, decimals);
    BaseTypes.FLOAT.apply(this, arguments);

    // POSTGRES does only support lengths as parameter.
    // Values between 1-24 result in REAL
    // Values between 25-53 result in DOUBLE PRECISION
    // If decimals are provided remove these and print a warning
    if (this._decimals) {
      warn('PostgreSQL does not support FLOAT with decimals. Plain `FLOAT` will be used instead.');
      this._length = undefined;
      this.options.length = undefined;
      this._decimals = undefined;
    }
    if (this._unsigned) {
      warn('PostgreSQL does not support FLOAT unsigned. `UNSIGNED` was removed.');
      this._unsigned = undefined;
    }
    if (this._zerofill) {
      warn('PostgreSQL does not support FLOAT zerofill. `ZEROFILL` was removed.');
      this._zerofill = undefined;
    }
  }
  inherits(FLOAT, BaseTypes.FLOAT);
  delete FLOAT.parse; // Float has no separate type in PG

  function BLOB(length) {
    if (!(this instanceof BLOB)) return new BLOB(length);
    BaseTypes.BLOB.apply(this, arguments);
  }
  inherits(BLOB, BaseTypes.BLOB);

  BLOB.prototype.toSql = function toSql() {
    if (this._length) {
      warn('PostgreSQL does not support BLOB (BYTEA) with options. Plain `BYTEA` will be used instead.');
      this._length = undefined;
    }
    return 'BYTEA';
  };

  BLOB.prototype._hexify = function _hexify(hex) {
    // bytea hex format http://www.postgresql.org/docs/current/static/datatype-binary.html
    return "E'\\\\x" + hex + "'";
  };

  BaseTypes.BLOB.types.postgres = {
    oids: [17],
    array_oids: [1001]
  };

  function GEOMETRY(type, srid) {
    if (!(this instanceof GEOMETRY)) return new GEOMETRY(type, srid);
    BaseTypes.GEOMETRY.apply(this, arguments);
  }
  inherits(GEOMETRY, BaseTypes.GEOMETRY);

  GEOMETRY.prototype.toSql = function toSql() {
    let result = this.key;

    if (this.type){
      result += '(' + this.type;

      if (this.srid){
        result += ',' + this.srid;
      }

      result += ')';
    }

    return result;
  };

  BaseTypes.GEOMETRY.types.postgres = {
    oids: [],
    array_oids: []
  };

  GEOMETRY.parse = GEOMETRY.prototype.parse = function parse(value) {
    const b = new Buffer(value, 'hex');
    return wkx.Geometry.parse(b).toGeoJSON();
  };

  GEOMETRY.prototype._stringify = function _stringify(value, options) {
    return 'ST_GeomFromGeoJSON(' + options.escape(JSON.stringify(value)) + ')';
  };

  function GEOGRAPHY(type, srid) {
    if (!(this instanceof GEOGRAPHY)) return new GEOGRAPHY(type, srid);
    BaseTypes.GEOGRAPHY.apply(this, arguments);
  }
  inherits(GEOGRAPHY, BaseTypes.GEOGRAPHY);

  GEOGRAPHY.prototype.toSql = function toSql() {
    let result = 'GEOGRAPHY';

    if (this.type){
      result += '(' + this.type;

      if (this.srid){
        result += ',' + this.srid;
      }

      result += ')';
    }

    return result;
  };

  BaseTypes.GEOGRAPHY.types.postgres = {
    oids: [],
    array_oids: []
  };

  GEOGRAPHY.parse = GEOGRAPHY.prototype.parse = function parse(value) {
    const b = new Buffer(value, 'hex');
    return wkx.Geometry.parse(b).toGeoJSON();
  };

  GEOGRAPHY.prototype._stringify = function _stringify(value, options) {
    return 'ST_GeomFromGeoJSON(' + options.escape(JSON.stringify(value)) + ')';
  };

  let hstore;
  function HSTORE() {
    if (!(this instanceof HSTORE)) return new HSTORE();
    BaseTypes.HSTORE.apply(this, arguments);

    if (!hstore) {
      // All datatype files are loaded at import - make sure we don't load the hstore parser before a hstore is instantiated
      hstore = require('./hstore');
    }
  }
  inherits(HSTORE, BaseTypes.HSTORE);

  HSTORE.parse = function parse(value) {
    if (!hstore) {
      // All datatype files are loaded at import - make sure we don't load the hstore parser before a hstore is instantiated
      hstore = require('./hstore');
    }
    return hstore.parse(value);
  };

  HSTORE.prototype.escape = false;
  HSTORE.prototype._stringify = function _stringify(value) {
    if (!hstore) {
      // All datatype files are loaded at import - make sure we don't load the hstore parser before a hstore is instantiated
      hstore = require('./hstore');
    }
    return "'" + hstore.stringify(value) + "'";
  };

  BaseTypes.HSTORE.types.postgres = {
    oids: [],
    array_oids: []
  };

  function RANGE(subtype) {
    if (!(this instanceof RANGE)) return new RANGE(subtype);
    BaseTypes.RANGE.apply(this, arguments);
  }
  inherits(RANGE, BaseTypes.RANGE);

  RANGE.oid_map = {
    3904: 23, // int4
    3905: 1007,
    3906: 1700, // Numeric
    3907: 1700,
    3908: 1114, // timestamp
    3909: 1114,
    3910: 1184, // timestamptz
    3911: 1184,
    3912: 1082, // date
    3913: 1082,
    3926: 20,    // int8
    3927: 20
  };

  const range = require('./range');
  RANGE.parse = function parse(value, oid, getTypeParser) {
    const parser = getTypeParser(RANGE.oid_map[oid]);

    return range.parse(value, parser);
  };

  RANGE.prototype.escape = false;
  RANGE.prototype._stringify = function _stringify(values, options) {
    if (!Array.isArray(values)) {
      return "'" + this.options.subtype.stringify(values, options) + "'::" +
        this.toCastType();
    }
    const valuesStringified = values.map(value => {
      if (this.options.subtype.stringify) {
        return this.options.subtype.stringify(value, options);
      } else {
        return options.escape(value);
      }
    });

    // Array.map does not preserve extra array properties
    valuesStringified.inclusive = values.inclusive;

    return  '\'' + range.stringify(valuesStringified) + '\'';
  };

  BaseTypes.RANGE.types.postgres = {
    oids: [3904, 3906, 3908, 3910, 3912, 3926],
    array_oids: [3905, 3907, 3909, 3911, 3913, 3927]
  };

  BaseTypes.ARRAY.prototype.escape = false;
  BaseTypes.ARRAY.prototype._stringify = function _stringify(values, options) {
    let str = 'ARRAY[' + values.map(value => {
      if (this.type && this.type.stringify) {
        value = this.type.stringify(value, options);

        if (this.type.escape === false) {
          return value;
        }
      }
      return options.escape(value);
    }, this).join(',') + ']';

    if (this.type) {
      str += '::' + this.toSql();
    }

    return str;
  };

  const exports = {
    DECIMAL,
    BLOB,
    STRING,
    CHAR,
    TEXT,
    INTEGER,
    BOOLEAN,
    DATE,
    DATEONLY,
    BIGINT,
    REAL,
    'DOUBLE PRECISION': DOUBLE,
    FLOAT,
    GEOMETRY,
    GEOGRAPHY,
    HSTORE,
    RANGE
  };

  _.forIn(exports, (DataType, key) => {
    if (!DataType.key) DataType.key = key;
    if (!DataType.extend) {
      DataType.extend = oldType => new DataType(oldType.options);
    }
  });

  return exports;
};
