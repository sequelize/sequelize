'use strict';

/*jshint -W110 */

var _ = require('lodash')
  , wkx = require('wkx');

module.exports = function (BaseTypes) {
  var warn = BaseTypes.ABSTRACT.warn.bind(undefined, 'http://www.postgresql.org/docs/9.4/static/datatype.html');

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

  BaseTypes.DATEONLY.types.postgres = {
    oids: [1082],
    array_oids: [1182]
  };

  BaseTypes.TIME.types.postgres = {
    oids: [1083],
    array_oids: [1183]
  };

  var DECIMAL = BaseTypes.DECIMAL.inherits();

  DECIMAL.parse = function (value) {
    return parseFloat(value);
  };

  // numeric
  BaseTypes.DECIMAL.types.postgres = {
    oids: [1700],
    array_oids: [1231]
  };

  var STRING = BaseTypes.STRING.inherits();
  STRING.prototype.toSql = function () {
    if (this._binary) {
      return 'BYTEA';
    }
    return BaseTypes.STRING.prototype.toSql.call(this);
  };

  BaseTypes.STRING.types.postgres = {
    oids: [1043],
    array_oids: [1015]
  };

  var TEXT = BaseTypes.TEXT.inherits();

  TEXT.prototype.toSql = function() {
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

  var CHAR = BaseTypes.CHAR.inherits();

  CHAR.prototype.toSql = function() {
    if (this._binary) {
      return 'BYTEA';
    }
    return BaseTypes.CHAR.prototype.toSql.call(this);
  };

  BaseTypes.CHAR.types.postgres = {
    oids: [18, 1042],
    array_oids: [1002, 1014]
  };

  var BOOLEAN = BaseTypes.BOOLEAN.inherits();

  BOOLEAN.prototype.toSql = function() {
    return 'BOOLEAN';
  };

  BaseTypes.BOOLEAN.types.postgres = {
    oids: [16],
    array_oids: [1000]
  };

  var DATE = BaseTypes.DATE.inherits();

  DATE.prototype.toSql = function() {
    return 'TIMESTAMP WITH TIME ZONE';
  };

  BaseTypes.DATE.types.postgres = {
    oids: [1184],
    array_oids: [1185]
  };

  var INTEGER = BaseTypes.INTEGER.inherits(function() {
    if (!(this instanceof INTEGER)) return new INTEGER();
    BaseTypes.INTEGER.apply(this, arguments);

    // POSTGRES does not support any parameters for integer
    if (this._length || this.options.length || this._unsigned || this._zerofill) {
      warn('PostgreSQL does not support INTEGER with options. Plain `INTEGER` will be used instead.');
      this._length = undefined;
      this.options.length = undefined;
      this._unsigned = undefined;
      this._zerofill = undefined;
    }
  });

  INTEGER.parse = function (value) {
    return parseInt(value, 10);
  };

  // int4
  BaseTypes.INTEGER.types.postgres = {
    oids: [23],
    array_oids: [1007]
  };

  var BIGINT = BaseTypes.BIGINT.inherits(function() {
    if (!(this instanceof BIGINT)) return new BIGINT();
    BaseTypes.BIGINT.apply(this, arguments);

    // POSTGRES does not support any parameters for bigint
    if (this._length || this.options.length || this._unsigned || this._zerofill) {
      warn('PostgreSQL does not support BIGINT with options. Plain `BIGINT` will be used instead.');
      this._length = undefined;
      this.options.length = undefined;
      this._unsigned = undefined;
      this._zerofill = undefined;
    }
  });

  // int8
  BaseTypes.BIGINT.types.postgres = {
    oids: [20],
    array_oids: [1016]
  };

  var REAL = BaseTypes.REAL.inherits(function() {
    if (!(this instanceof REAL)) return new REAL();
    BaseTypes.REAL.apply(this, arguments);

    // POSTGRES does not support any parameters for real
    if (this._length || this.options.length || this._unsigned || this._zerofill) {
      warn('PostgreSQL does not support REAL with options. Plain `REAL` will be used instead.');
      this._length = undefined;
      this.options.length = undefined;
      this._unsigned = undefined;
      this._zerofill = undefined;
    }
  });

  // float4
  BaseTypes.REAL.types.postgres = {
    oids: [700],
    array_oids: [1021]
  };

  var DOUBLE = BaseTypes.DOUBLE.inherits(function() {
    if (!(this instanceof DOUBLE)) return new DOUBLE();
    BaseTypes.DOUBLE.apply(this, arguments);

    // POSTGRES does not support any parameters for double
    if (this._length || this.options.length || this._unsigned || this._zerofill) {
      warn('PostgreSQL does not support DOUBLE with options. Plain `DOUBLE` will be used instead.');
      this._length = undefined;
      this.options.length = undefined;
      this._unsigned = undefined;
      this._zerofill = undefined;
    }
  });

  // float8
  BaseTypes.DOUBLE.types.postgres = {
    oids: [701],
    array_oids: [1022]
  };

  var FLOAT = BaseTypes.FLOAT.inherits(function() {
    if (!(this instanceof FLOAT)) return new FLOAT();
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
  });

  var BLOB = BaseTypes.BLOB.inherits();

  BLOB.prototype.toSql = function() {
    if (this._length) {
      warn('PostgreSQL does not support BLOB (BYTEA) with options. Plain `BYTEA` will be used instead.');
      this._length = undefined;
    }
    return 'BYTEA';
  };

  BLOB.prototype.$hexify = function (hex) {
    // bytea hex format http://www.postgresql.org/docs/current/static/datatype-binary.html
      return "E'\\\\x" + hex + "'";
  };

  BaseTypes.BLOB.types.postgres = {
    oids: [17],
    array_oids: [1001]
  };

  var GEOMETRY = BaseTypes.GEOMETRY.inherits();

  GEOMETRY.prototype.toSql = function() {
    var result = this.key;

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

  GEOMETRY.parse = GEOMETRY.prototype.parse = function(value) {
    var b = new Buffer(value, 'hex');
    return wkx.Geometry.parse(b).toGeoJSON();
  };

  GEOMETRY.prototype.$stringify = function (value) {
    return 'ST_GeomFromGeoJSON(\'' + JSON.stringify(value) + '\')';
  };

  var GEOGRAPHY = BaseTypes.GEOGRAPHY.inherits();

  GEOGRAPHY.prototype.toSql = function() {
    var result = 'GEOGRAPHY';

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

  GEOGRAPHY.parse = GEOGRAPHY.prototype.parse = function(value) {
    var b = new Buffer(value, 'hex');
    return wkx.Geometry.parse(b).toGeoJSON();
  };

  GEOGRAPHY.prototype.$stringify = function (value) {
    return 'ST_GeomFromGeoJSON(\'' + JSON.stringify(value) + '\')';
  };

  var hstore;
  var HSTORE = BaseTypes.HSTORE.inherits(function () {
    if (!(this instanceof HSTORE)) return new HSTORE();
    BaseTypes.HSTORE.apply(this, arguments);

    if (!hstore) {
      // All datatype files are loaded at import - make sure we don't load the hstore parser before a hstore is instantiated
      hstore = require('./hstore');
    }
  });

  HSTORE.parse = function (value) {
    if (!hstore) {
      // All datatype files are loaded at import - make sure we don't load the hstore parser before a hstore is instantiated
      hstore = require('./hstore');
    }
    return hstore.parse(value);
  };

  HSTORE.prototype.escape = false;
  HSTORE.prototype.$stringify = function (value) {
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

  var RANGE = BaseTypes.RANGE.inherits();

  RANGE.oid_map = {
    3904: 1007, // int4
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
    3927: 20,
  };

  var range = require('./range');
  RANGE.parse = function (value, oid, getTypeParser) {
    var parser = getTypeParser(RANGE.oid_map[oid]);

    return range.parse(value, parser);
  };

  RANGE.prototype.escape = false;
  RANGE.prototype.$stringify = function (values, options) {
    var valuesStringified = values.map(function (value) {
      if (this.options.subtype.stringify) {
        return this.options.subtype.stringify(value, options);
      } else {
        return options.escape(value);
      }
    }, this);

    // Array.map does not preserve extra array properties
    valuesStringified.inclusive = values.inclusive;

    return  '\'' + range.stringify(valuesStringified) + '\'';
  };

  BaseTypes.RANGE.types.postgres = {
    oids: [3904, 3906, 3908, 3910, 3912, 3926],
    array_oids: [3905, 3907, 3909, 3911, 3913, 3927]
  };

  BaseTypes.ARRAY.prototype.escape = false;
  BaseTypes.ARRAY.prototype.$stringify = function (values, options) {
    var str = 'ARRAY[' + values.map(function (value) {
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

  var exports = {
    DECIMAL: DECIMAL,
    BLOB: BLOB,
    STRING: STRING,
    CHAR: CHAR,
    TEXT: TEXT,
    INTEGER: INTEGER,
    BOOLEAN: BOOLEAN,
    DATE: DATE,
    BIGINT: BIGINT,
    REAL: REAL,
    'DOUBLE PRECISION': DOUBLE,
    FLOAT: FLOAT,
    GEOMETRY: GEOMETRY,
    GEOGRAPHY: GEOGRAPHY,
    HSTORE: HSTORE,
    RANGE: RANGE
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
