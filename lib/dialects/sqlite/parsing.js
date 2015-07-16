'use strict';

var _ = require('lodash');

module.exports.parsers = {};

module.exports.refresh = function (dataTypes) {
  _.each(dataTypes, function (dataType, key) {
    if (dataType.parse && dataType.types.sqlite) {
      dataType.types.sqlite.forEach(function (type) {
        module.exports.parsers[type] = dataType.parse;
      });
    }
  });
};
