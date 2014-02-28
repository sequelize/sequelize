/**
 * @fileOverview The Error Objects produced by Sequelize.
 */

var util = require('util')
var error = module.exports = {}

/**
 * The Base Error all Sequelize Errors inherit from.
 *
 * @constructor
 */
error.BaseError = function() {
  Error.call(this)
};
util.inherits(error.BaseError, Error)


/**
 * Validation Error
 *
 * @constructor
 */
error.ValidationError = function() {
  error.BaseError.call(this)
};
util.inherits(error.ValidationError, error.BaseError)
