'use strict';

const Promise = require('bluebird').getNewLibraryCopy();

Promise.config({asyncHooks: true});
module.exports = Promise;
module.exports.Promise = Promise;
module.exports.default = Promise;
