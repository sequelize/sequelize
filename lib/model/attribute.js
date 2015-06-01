'use strict';

var Attribute = function(options) {
    if (options.type === undefined) options = {type: options};
    this.type = options.type;
};

module.exports = Attribute;
