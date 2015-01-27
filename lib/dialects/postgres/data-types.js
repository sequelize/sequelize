'use strict';

var BaseTypes = require('../../data-types')
  , util = require('util')
  , _ = require('lodash');

var BOOLEAN = function() {
  if (!(this instanceof BOOLEAN)) return new BOOLEAN();
  BaseTypes.BOOLEAN.apply(this, arguments);
};
util.inherits(BOOLEAN, BaseTypes.BOOLEAN);

BOOLEAN.prototype.toSql = function() {
  return 'BOOLEAN';
};

var DATE = function() {
  if (!(this instanceof DATE)) return new DATE();
  BaseTypes.DATE.apply(this, arguments);
};
util.inherits(DATE, BaseTypes.DATE);

DATE.prototype.toSql = function() {
  return 'TIMESTAMP WITH TIME ZONE';
};

var INTEGER = function() {
  if (!(this instanceof INTEGER)) return new INTEGER();
  BaseTypes.INTEGER.apply(this, arguments);

  // POSTGRES does not support length on INTEGER
  delete this._length;
  delete this.options.length;
};
util.inherits(INTEGER, BaseTypes.INTEGER);

var BIGINT = function() {
  if (!(this instanceof BIGINT)) return new BIGINT();
  BaseTypes.BIGINT.apply(this, arguments);

  // POSTGRES does not support length on BIGINT
  delete this._length;
  delete this.options.length;
};
util.inherits(BIGINT, BaseTypes.BIGINT);

module.exports = {
  BOOLEAN: BOOLEAN,
  DATE: DATE,
  INTEGER: INTEGER,
  BIGINT: BIGINT
};

_.forIn(module.exports, function (DataType, key) {
  if (!DataType.key) DataType.key = key;
  if (!DataType.extend) {
    DataType.extend = function(oldType) {
      return new DataType(oldType.options);
    };
  }
});