'use strict';

var stores = {};
module.exports = function (dialect) {
  stores[dialect] = stores[dialect] || {};

  return {
    clear: function () {
      stores[dialect] = {};
    },
    refresh: function (dataType) {
      dataType.types[dialect].forEach(function (type) {
        stores[dialect][type] = dataType.parse;
      });
    },
    get: function (type) {
      return stores[dialect][type];
    }
  };
};
