'use strict';

var wkx = require('wkx')
  , _ = require('lodash');

module.exports = function (BaseTypes) {
  BaseTypes.ABSTRACT.prototype.dialectTypes = 'https://dev.mysql.com/doc/refman/5.7/en/data-types.html';

  BaseTypes.DATE.types.mysql = ['DATETIME'];
  BaseTypes.STRING.types.mysql = ['VAR_STRING'];
  BaseTypes.CHAR.types.mysql = ['STRING'];
  BaseTypes.TEXT.types.mysql = ['BLOB'];
  BaseTypes.INTEGER.types.mysql = ['LONG'];
  BaseTypes.BIGINT.types.mysql = ['LONGLONG'];
  BaseTypes.FLOAT.types.mysql = ['FLOAT'];
  BaseTypes.TIME.types.mysql = ['TIME'];
  BaseTypes.DATEONLY.types.mysql = ['DATE'];
  BaseTypes.BOOLEAN.types.mysql = ['TINY'];
  BaseTypes.BLOB.types.mysql = ['TINYBLOB', 'BLOB', 'LONGBLOB'];
  BaseTypes.DECIMAL.types.mysql = ['NEWDECIMAL'];
  BaseTypes.UUID.types.mysql = false;
  BaseTypes.ENUM.types.mysql = false;
  BaseTypes.REAL.types.mysql = ['DOUBLE'];
  BaseTypes.DOUBLE.types.mysql = ['DOUBLE'];

  var DATE = BaseTypes.DATE.inherits();

  DATE.prototype.toSql = function () {
    return 'DATETIME' + (this._length ? '(' + this._length + ')' : '');
  };

  DATE.prototype.$stringify = function (date, options) {
    // Fractional DATETIMEs only supported on MySQL 5.6.4+
    if (this._length) {
      return BaseTypes.DATE.prototype.$stringify(date, options);
    }

    date = BaseTypes.DATE.prototype.$applyTimezone(date, options);
    return date.format('YYYY-MM-DD HH:mm:ss');
  };

  var UUID = BaseTypes.UUID.inherits();

  UUID.prototype.toSql = function() {
    return 'CHAR(36) BINARY';
  };

  var SUPPORTED_GEOMETRY_TYPES = ['POINT', 'LINESTRING', 'POLYGON'];
  var GEOMETRY = BaseTypes.GEOMETRY.inherits(function() {
    if (!(this instanceof GEOMETRY)) return new GEOMETRY();
    BaseTypes.GEOMETRY.apply(this, arguments);

    if (_.isEmpty(this.type)) {
      this.sqlType = this.key;
    } else if (_.includes(SUPPORTED_GEOMETRY_TYPES, this.type)) {
      this.sqlType = this.type;
    } else {
      throw new Error('Supported geometry types are: ' + SUPPORTED_GEOMETRY_TYPES.join(', '));
    }
  });

  GEOMETRY.parse = GEOMETRY.prototype.parse = function(value) {
    value = value.buffer();

    //MySQL doesn't support POINT EMPTY, https://dev.mysql.com/worklog/task/?id=2381
    if (value === null) {
      return null;
    }

    // For some reason, discard the first 4 bytes
    value = value.slice(4);

    return wkx.Geometry.parse(value).toGeoJSON();
  };

  GEOMETRY.prototype.toSql = function() {
    return this.sqlType;
  };

  var ENUM = BaseTypes.ENUM.inherits();

  ENUM.prototype.toSql = function (options) {
    return 'ENUM(' + _.map(this.values, function(value) {
      return options.escape(value);
    }).join(', ') + ')';
  };

  BaseTypes.GEOMETRY.types.mysql = ['GEOMETRY'];

  var exports = {
    ENUM: ENUM,
    DATE: DATE,
    UUID: UUID,
    GEOMETRY: GEOMETRY
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
