'use strict';

class ParserStore extends Map {
  constructor(dialectName) {
    super();
    this.dialectName = dialectName;
  }

  refresh(dataType) {
    for (const type of dataType.types[this.dialectName]) {
      this.set(type, dataType.parse);
    }
  }
}

module.exports.ParserStore = ParserStore;
