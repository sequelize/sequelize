'use strict';

var AbstractDialect = function() {

};

AbstractDialect.prototype.supports = {
  'RETURNING': false,
  'DEFAULT': true,
  'DEFAULT VALUES': false,
  'VALUES ()': false,
  'LIMIT ON UPDATE': false,
  schemas: false,
  index: {
    collate: true,
    length: false,
    parser: false,
    concurrently: false,
    type: false,
    using: true,
  },
  joinTableDependent: true
};

module.exports = AbstractDialect;
