'use strict';

var BaseTypes = require('../../data-types')
  , util = require('util')
  , _ = require('lodash');

BaseTypes.ABSTRACT.prototype.dialectTypes = 'https://dev.mysql.com/doc/refman/5.7/en/data-types.html';

var UUID = function() {
  if (!(this instanceof UUID)) return new UUID();
  BaseTypes.UUID.apply(this, arguments);
};
util.inherits(UUID, BaseTypes.UUID);

UUID.prototype.toSql = function() {
  return 'CHAR(36) BINARY';
};

var SUPPORTED_GEOMETRY_TYPES = ['POINT', 'LINESTRING', 'POLYGON'];
var GEOMETRY = function() {
  if (!(this instanceof GEOMETRY)) return new GEOMETRY();
  BaseTypes.GEOMETRY.apply(this, arguments);

  if (_.isEmpty(this.type)) {
    this.sqlType = this.key;
  } else if (_.includes(SUPPORTED_GEOMETRY_TYPES, this.type)) {
    this.sqlType = this.type;
  } else {
    throw new Error('Supported geometry types are: ' + SUPPORTED_GEOMETRY_TYPES.join(', '));
  }
};
util.inherits(GEOMETRY, BaseTypes.GEOMETRY);

GEOMETRY.prototype.toSql = function() {
  return this.sqlType;
};

module.exports = {
  UUID: UUID,
  GEOMETRY: GEOMETRY
};

_.forIn(module.exports, function (DataType, key) {
  if (!DataType.key) DataType.key = key;
  if (!DataType.extend) {
    DataType.extend = function(oldType) {
      return new DataType(oldType.options);
    };
  }
});
