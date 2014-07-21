'use strict';

/**
 * @fileOverview The Error Objects produced by Sequelize.
 */

var util = require('util');
var error = module.exports = {};

/**
 * The Base Error all Sequelize Errors inherit from.
 *
 * @constructor
 */
error.BaseError = function(message) {
  Error.apply(this, arguments);
  Error.captureStackTrace(this, this.constructor);
  this.message = message;
};
util.inherits(error.BaseError, Error);


/**
 * Validation Error
 *
 * @constructor
 */
error.ValidationError = function() {
  error.BaseError.apply(this, arguments);
};
util.inherits(error.ValidationError, error.BaseError);
