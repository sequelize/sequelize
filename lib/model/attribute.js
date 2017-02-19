'use strict';

const _ = require('lodash');

class Attribute {
  constructor(options) {
    if(!_.isPlainObject(options)){
      options = {
        type: options
      };
    }
    _.assign(this, options);
  }
}

module.exports = Attribute;
module.exports.Attribute = Attribute;
module.exports.default = Attribute;
