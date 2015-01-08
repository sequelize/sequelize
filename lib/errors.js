'use strict';

/**
 * Sequelize provides a host of custom error classes, to allow you to do easier debugging. All of these errors are exposed on the sequelize object and the sequelize constructor.
 * All sequelize errors inherit from the base JS error object.
 *
 * @fileOverview The Error Objects produced by Sequelize.
 * @class Errors
 */

var util = require('util');
var error = module.exports = {};

/**
 * The Base Error all Sequelize Errors inherit from.
 *
 * @constructor
 * @alias Error
 */
error.BaseError = function() {
  var tmp = Error.apply(this, arguments);
  tmp.name = this.name = 'SequelizeBaseError';

  Error.captureStackTrace && Error.captureStackTrace(this, this.constructor);
  this.message = tmp.message;
};
util.inherits(error.BaseError, Error);


/**
 * Validation Error. Thrown when the sequelize validation has failed. The error contains an `errors` property,
 * which is an array with 1 or more ValidationErrorItems, one for each validation that failed.
 *
 * @param {string} message Error message
 * @param {Array} [errors] Array of ValidationErrorItem objects describing the validation errors
 *
 * @extends BaseError
 * @constructor
 */
error.ValidationError = function(message, errors) {
  error.BaseError.apply(this, arguments);
  this.name = 'SequelizeValidationError';
  this.errors = errors || [];
};
util.inherits(error.ValidationError, error.BaseError);

/**
 * Gets all validation error items for the path / field specified.
 *
 * @param {string} path The path to be checked for error items
 * @returns {Array} Validation error items for the specified path
 */
error.ValidationError.prototype.get = function(path) {
  return this.errors.reduce(function(reduced, error) {
    if (error.path === path) {
      reduced.push(error);
    }
    return reduced;
  }, []);
};

/**
 * An array of ValidationErrorItems
 * @property errors
 * @name errors
 */
error.ValidationError.prototype.errors;

/**
 * A base class for all database related errors.
 * @extends BaseError
 * @constructor
 */
error.DatabaseError = function (parent) {
  error.BaseError.apply(this, [parent.message]);
  this.name = 'SequelizeDatabaseError';

  this.parent = parent;
  this.original = parent;
  this.sql = parent.sql;
};
util.inherits(error.DatabaseError, error.BaseError);

/**
 * The database specific error which triggered this one
 * @property parent
 * @name parent
 */
error.DatabaseError.prototype.parent;
/**
 * The SQL that triggered the error
 * @property sql
 * @name sql
 */
error.DatabaseError.prototype.sql;

/**
 * Thrown when a database query times out because of a deadlock
 * @extends DatabaseError
 * @constructor
 */
error.TimeoutError = function (parent) {
  error.DatabaseError.call(this, parent);
  this.name = 'SequelizeTimeoutError';
};
util.inherits(error.TimeoutError, error.BaseError);

 /**
 * Thrown when a unique constraint is violated in the database
 * @extends DatabaseError
 * @constructor
 */
error.UniqueConstraintError = function (options) {
  options = options || {};
  options.parent = options.parent || { sql: '' };
  options.message = options.message || 'Validation error';
  options.errors = options.errors || {};

  error.ValidationError.call(this, options.message, options.errors);
  this.name = 'SequelizeUniqueConstraintError';
  this.message = options.message;
  this.errors = options.errors;
  this.fields = options.fields;
};
util.inherits(error.UniqueConstraintError, error.ValidationError);

/**
 * Thrown when a foreign key constraint is violated in the database
 * @extends DatabaseError
 * @constructor
 */
error.ForeignKeyConstraintError = function (options) {
  options = options || {};
  options.parent = options.parent || { sql: '' };

  error.DatabaseError.call(this, options.parent);
  this.name = 'SequelizeForeignKeyConstraintError';

  this.message = options.message;
  this.fields = options.fields;
  this.table = options.table;
  this.value = options.value;
  this.index = options.index;
};
util.inherits(error.ForeignKeyConstraintError, error.DatabaseError);

/**
 * The message from the DB.
 * @property message
 * @name message
 */
error.DatabaseError.prototype.message;
/**
 * The fields of the unique constraint
 * @property fields
 * @name fields
 */
error.DatabaseError.prototype.fields;
/**
 * The value(s) which triggered the error
 * @property value
 * @name value
 */
error.DatabaseError.prototype.value;
/**
 * The name of the index that triggered the error
 * @property index
 * @name index
 */
error.DatabaseError.prototype.index;

/**
 * Validation Error Item
 * Instances of this class are included in the `ValidationError.errors` property.
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

/**
 * A base class for all connection related errors.
 * @extends BaseError
 * @constructor
 */
error.ConnectionError = function (parent) {
  error.BaseError.apply(this, [parent ? parent.message : '']);
  this.name = 'SequelizeConnectionError';

  this.parent = parent;
  this.original = parent;
};
util.inherits(error.ConnectionError, error.BaseError);

/**
 * The connection specific error which triggered this one
 * @property parent
 * @name parent
 */
error.ConnectionError.prototype.parent;

/**
 * Thrown when a connection to a database is refused
 * @extends ConnectionError
 * @constructor
 */
error.ConnectionRefusedError = function (parent) {
  error.ConnectionError.call(this, parent);
  this.name = 'SequelizeConnectionRefusedError';
};
util.inherits(error.ConnectionRefusedError, error.ConnectionError);

/**
 * Thrown when a connection to a database is refused due to insufficient privileges
 * @extends ConnectionError
 * @constructor
 */
error.AccessDeniedError = function (parent) {
  error.ConnectionError.call(this, parent);
  this.name = 'SequelizeAccessDeniedError';
};
util.inherits(error.AccessDeniedError, error.ConnectionError);

/**
 * Thrown when a connection to a database has a hostname that was not found
 * @extends ConnectionError
 * @constructor
 */
error.HostNotFoundError = function (parent) {
  error.ConnectionError.call(this, parent);
  this.name = 'SequelizeHostNotFoundError';
};
util.inherits(error.HostNotFoundError, error.ConnectionError);

/**
 * Thrown when a connection to a database has a hostname that was not reachable
 * @extends ConnectionError
 * @constructor
 */
error.HostNotReachableError = function (parent) {
  error.ConnectionError.call(this, parent);
  this.name = 'SequelizeHostNotReachableError';
};
util.inherits(error.HostNotReachableError, error.ConnectionError);

/**
 * Thrown when a connection to a database has invalid values for any of the connection parameters
 * @extends ConnectionError
 * @constructor
 */
error.InvalidConnectionError = function (parent) {
  error.ConnectionError.call(this, parent);
  this.name = 'SequelizeInvalidConnectionError';
};
util.inherits(error.InvalidConnectionError, error.ConnectionError);

/**
 * Thrown when a connection to a database times out
 * @extends ConnectionError
 * @constructor
 */
error.ConnectionTimedOutError = function (parent) {
  error.ConnectionError.call(this, parent);
  this.name = 'SequelizeConnectionTimedOutError';
};
util.inherits(error.ConnectionTimedOutError, error.ConnectionError);
