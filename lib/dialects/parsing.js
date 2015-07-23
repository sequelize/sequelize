'use strict';

var _ = require('lodash');

module.exports.parsers = {
  sqlite: {},
  mssql: {}
};

module.exports.refresh = function (dataTypes, dialect) {
  _.each(dataTypes, function (dataType, key) {
    if (dataType.parse && dataType.types.sqlite) {
      dataType.types[dialect].forEach(function (type) {
        module.exports.parsers[dialect][type] = dataType.parse;
      });
    }
  });
};
