'use strict';

const stores = new Map();

module.exports = dialect => {
  if (!stores.has(dialect)) {
    stores.set(dialect, new Map());
  }

  return {
    clear() {
      stores.get(dialect).clear();
    },
    refresh(dataType) {
      for (const type of dataType.types[dialect]) {
        stores.get(dialect).set(type, dataType.parse);
      }
    },
    get(type) {
      return stores.get(dialect).get(type);
    }
  };
};
