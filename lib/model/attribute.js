'use strict';

module.exports = (function() {
  var Attribute = function(options) {
    if (options.type === undefined) options = {type: options};
    this.type = options.type;
  };

  return Attribute;
})();
