'use strict';

const stores = {};
module.exports = dialect => {
  stores[dialect] = stores[dialect] || {};

  return {
    clear() {
      stores[dialect] = {};
    },
    refresh(dataType) {
      for (const type of dataType.types[dialect]) {
        stores[dialect][type] = dataType.parse;
      }
    },
    get(type) {
      return stores[dialect][type];
    }
  };
};
