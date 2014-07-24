'use strict';

/**
 * @fileOverview The Error Objects produced by Sequelize.
 */

var error = module.exports = {};

/**
 * The Base Error all Sequelize Errors inherit from.
 *
 * @constructor
 */
error.BaseError = function() {
  var tmp = Error.apply(this, arguments);
  tmp.name = this.name = 'SequelizeBaseError';

  this.stack = tmp.stack;
  this.message = tmp.message;

  return this;
};
error.BaseError.prototype = Object.create(Error.prototype, {
  constructor: { value: error.BaseError }
});


/**
 * Validation Error
 *
 * @constructor
 */
error.ValidationError = function() {
  error.BaseError.apply(this, arguments);
  this.name = 'SequelizeValidationError';

  return this;
};
error.ValidationError.prototype = Object.create(error.BaseError.prototype, {
  constructor: { value: error.ValidationError }
});