'use strict';

var BaseTypes = require('../../data-types')
  , util = require('util')
  , _ = require('lodash');

var UUID = function() {
  if (!(this instanceof UUID)) return new UUID();
  BaseTypes.UUID.apply(this, arguments);
};
util.inherits(UUID, BaseTypes.UUID);

UUID.prototype.toSql = function() {
  return 'CHAR(36) BINARY';
};

module.exports = {
  UUID: UUID
};

_.forIn(module.exports, function (DataType, key) {
  if (!DataType.key) DataType.key = key;
  if (!DataType.extend) {
    DataType.extend = function(oldType) {
      return new DataType(oldType.options);
    };
  }
});