'use strict';

class Attribute {
  constructor(options) {
    if (options.type === undefined) options = {type: options};
    this.type = options.type;
  }
}

module.exports = Attribute;
module.exports.Attribute = Attribute;
module.exports.default = Attribute;
