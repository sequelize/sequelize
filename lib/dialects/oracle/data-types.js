'use strict';

var _ = require('lodash');

module.exports = function (BaseTypes) {
  //var warn = BaseTypes.ABSTRACT.warn.bind(undefined, 'http://docs.oracle.com/cd/B28359_01/server.111/b28318/datatype.htm');

  BaseTypes.DATE.types.mysql = ['DATETIME'];
  BaseTypes.UUID.types.mysql = ['CHAR(36)'];
  BaseTypes.ENUM.types.mysql = ['VARCHAR2(255)'];


  var DATE = BaseTypes.DATE.inherits();

  DATE.prototype.toSql = function() {
    return 'TIMESTAMP WITH LOCAL TIME ZONE';
  };

  DATE.prototype.$stringify = function (date, options) {
    date = this.$applyTimezone(date, options);

    return date.format('YYYY-MM-DD HH:mm:ss.SSS Z');
  };


  var exports = {
    DATE: DATE
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

