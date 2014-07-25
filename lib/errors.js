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
error.BaseError = function() {
  var tmp = Error.apply(this, arguments);
  tmp.name = this.name = 'SequelizeBaseError';

  Error.captureStackTrace && Error.captureStackTrace(this, this.constructor);
  this.message = tmp.message;
};
util.inherits(error.BaseError, Error);


/**
 * Validation Error
 *
 * @param {string} message Error message
 * @param {Array} [errors] Array of ValidationErrorItem objects describing the validation errors
 * @constructor
 */
error.ValidationError = function(message, errors) {
  error.BaseError.apply(this, arguments);
  this.name = 'SequelizeValidationError';
  this.errors = errors || [];
};
util.inherits(error.ValidationError, error.BaseError);

/**
 * Finds all validation error items for the path specified.
 *
 * @param {string} path The path to be checked for error items
 * @returns {Array} Validation error items for the specified path
 */
error.ValidationError.prototype.errorsForPath = function(path) {
  return this.errors.reduce(function(reduced, error) {
    if (error.path === path) {
      reduced.push(error);
    }
    return reduced;
  }, []);
};

/**
 * Validation Error Item
 * Instances of this class are included in the ValidationError errors property.
 *
 * @param {string} message An error message
 * @param {string} type The type of the validation error
 * @param {string} path The field that triggered the validation error
 * @param {string} value The value that generated the error
 * @constructor
 */
error.ValidationErrorItem = function(message, type, path, value) {
  this.message = message || '';
  this.type = type || null;
  this.path = path || null;
  this.value = value || null;
};
