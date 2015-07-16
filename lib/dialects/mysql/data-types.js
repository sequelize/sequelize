'use strict';

var util = require('util')
  , _ = require('lodash');

module.exports = function (BaseTypes) {
  BaseTypes.ABSTRACT.prototype.dialectTypes = 'https://dev.mysql.com/doc/refman/5.7/en/data-types.html';

  BaseTypes.DATE.types.mysql = ['DATETIME'];
  BaseTypes.STRING.types.mysql = ['VAR_STRING'];
  BaseTypes.CHAR.types.mysql = ['STRING'];
  BaseTypes.TEXT.types.mysql = ['BLOB'];
  BaseTypes.INTEGER.types.mysql = ['LONG'];
  BaseTypes.BIGINT.types.mysql = ['BIGINT'];
  BaseTypes.FLOAT.types.mysql = ['FLOAT'];
  BaseTypes.TIME.types.mysql = ['TIME'];
  BaseTypes.DATEONLY.types.mysql = ['DATE'];
  BaseTypes.BOOLEAN.types.mysql = ['TINY'];
  BaseTypes.BLOB.types.mysql = ['TINYBLOB', 'BLOB', 'LONGBLOB'];
  BaseTypes.DECIMAL.types.mysql = ['DECIMAL'];
  BaseTypes.UUID.types.mysql = ['UUID'];
  BaseTypes.ENUM.types.mysql = ['TEXT']; // Questionable .. overwritten by text
  BaseTypes.REAL.types.mysql = ['DOUBLE'];
  BaseTypes.DOUBLE.types.mysql = ['DOUBLE'];

  var DATE = BaseTypes.DATE.inherits();

  DATE.prototype.$stringify = function (date, options) {
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
  util.inherits(GEOMETRY, BaseTypes.GEOMETRY);

  GEOMETRY.prototype.toSql = function() {
    return this.sqlType;
  };

  BaseTypes.GEOMETRY.types.mysql = ['GEOMETRY'];

  BaseTypes.DATE.types.mysql = ['DATETIME'];

  var exports = {
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
