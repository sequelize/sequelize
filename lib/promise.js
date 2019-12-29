'use strict';

const Promise = require('bluebird').getNewLibraryCopy();

module.exports = Promise;
module.exports.Promise = Promise;
module.exports.default = Promise;
