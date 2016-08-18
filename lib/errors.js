'use strict';

/**
 * Sequelize provides a host of custom error classes, to allow you to do easier debugging. All of these errors are exposed on the sequelize object and the sequelize constructor.
 * All sequelize errors inherit from the base JS error object.
 *
 * @fileOverview The Error Objects produced by Sequelize.
 * @class Errors
 */

/**
 * The Base Error all Sequelize Errors inherit from.
 *
 * @constructor
 * @alias Error
 */
class BaseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SequelizeBaseError';
    this.message = message;
    Error.captureStackTrace(this, this.constructor);
  }
}
exports.BaseError = BaseError;

/**
 * Scope Error. Thrown when the sequelize cannot query the specified scope.
 *
 * @param {string} message Error message
 *
 * @extends BaseError
 * @constructor
 */
class SequelizeScopeError extends BaseError {
  constructor(parent) {
    super(parent);
    this.name = 'SequelizeScopeError';
  }
}
exports.SequelizeScopeError = SequelizeScopeError;

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
class ValidationError extends BaseError {
  constructor(message, errors) {
    super(message);
    this.name = 'SequelizeValidationError';
    this.message = 'Validation Error';
    /**
     * An array of ValidationErrorItems
     * @member errors
     */
    this.errors = errors || [];

    // Use provided error message if available...
    if (message) {
      this.message = message;

    // ... otherwise create a concatenated message out of existing errors.
    } else if (this.errors.length > 0 && this.errors[0].message) {
      this.message = this.errors.map(err => err.type + ': ' + err.message).join(',\n');
    }
  }

  /**
   * Gets all validation error items for the path / field specified.
   *
   * @param {string} path The path to be checked for error items
   * @returns {Array} Validation error items for the specified path
   */
  get(path) {
    return this.errors.reduce((reduced, error) => {
      if (error.path === path) {
        reduced.push(error);
      }
      return reduced;
    }, []);
  }
}
exports.ValidationError = ValidationError;

/**
 * A base class for all database related errors.
 * @extends BaseError
 * @constructor
 */
class DatabaseError extends BaseError {
  constructor(parent) {
    super(parent.message);
    this.name = 'SequelizeDatabaseError';
    /**
     * The database specific error which triggered this one
     * @member parent
     */
    this.parent = parent;
    this.original = parent;
    /**
     * The SQL that triggered the error
     * @member sql
     */
    this.sql = parent.sql;
    /**
     * The message from the DB.
     * @member message
     * @name message
     */
    /**
     * The fields of the unique constraint
     * @member fields
     * @name fields
     */
    /**
     * The value(s) which triggered the error
     * @member value
     * @name value
     */
    /**
     * The name of the index that triggered the error
     * @member index
     * @name index
     */
  }
}
exports.DatabaseError = DatabaseError;

/**
 * Thrown when a database query times out because of a deadlock
 * @extends DatabaseError
 * @constructor
 */
class TimeoutError extends DatabaseError {
  constructor(parent) {
    super(parent);
    this.name = 'SequelizeTimeoutError';
  }
}
exports.TimeoutError = TimeoutError;

 /**
 * Thrown when a unique constraint is violated in the database
 * @extends DatabaseError
 * @constructor
 */
class UniqueConstraintError extends ValidationError {
  constructor(options) {
    options = options || {};
    options.parent = options.parent || { sql: '' };
    options.message = options.message || options.parent.message || 'Validation Error';
    options.errors = options.errors || {};
    super(options.message, options.errors);

    this.name = 'SequelizeUniqueConstraintError';
    this.message = options.message;
    this.errors = options.errors;
    this.fields = options.fields;
    this.parent = options.parent;
    this.original = options.parent;
    this.sql = options.parent.sql;
  }
}
exports.UniqueConstraintError = UniqueConstraintError;

/**
 * Thrown when a foreign key constraint is violated in the database
 * @extends DatabaseError
 * @constructor
 */
class ForeignKeyConstraintError extends DatabaseError {
  constructor(options) {
    options = options || {};
    options.parent = options.parent || { sql: '' };

    super(options.parent);
    this.name = 'SequelizeForeignKeyConstraintError';

    this.message = options.message || options.parent.message || 'Database Error';
    this.fields = options.fields;
    this.table = options.table;
    this.value = options.value;
    this.index = options.index;
  }
}
exports.ForeignKeyConstraintError = ForeignKeyConstraintError;

/**
 * Thrown when an exclusion constraint is violated in the database
 * @extends DatabaseError
 * @constructor
 */
class ExclusionConstraintError extends DatabaseError {
  constructor(options) {
    options = options || {};
    options.parent = options.parent || { sql: '' };

    super(options.parent);
    this.name = 'SequelizeExclusionConstraintError';

    this.message = options.message || options.parent.message;
    this.constraint = options.constraint;
    this.fields = options.fields;
    this.table = options.table;
  }
}
exports.ExclusionConstraintError = ExclusionConstraintError;

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
class ValidationErrorItem {
  constructor(message, type, path, value) {
    this.message = message || '';
    this.type = type || null;
    this.path = path || null;
    this.value = value || null;
  }
}
exports.ValidationErrorItem = ValidationErrorItem;

/**
 * A base class for all connection related errors.
 * @extends BaseError
 * @constructor
 */
class ConnectionError extends BaseError {
  constructor(parent) {
    super(parent ? parent.message : '');
    this.name = 'SequelizeConnectionError';
    /**
     * The connection specific error which triggered this one
     * @member parent
     */
    this.parent = parent;
    this.original = parent;
  }
}
exports.ConnectionError = ConnectionError;

/**
 * Thrown when a connection to a database is refused
 * @extends ConnectionError
 * @constructor
 */
class ConnectionRefusedError extends ConnectionError {
  constructor(parent) {
    super(parent);
    this.name = 'SequelizeConnectionRefusedError';
  }
}
exports.ConnectionRefusedError = ConnectionRefusedError;

/**
 * Thrown when a connection to a database is refused due to insufficient privileges
 * @extends ConnectionError
 * @constructor
 */
class AccessDeniedError extends ConnectionError {
  constructor(parent) {
    super(parent);
    this.name = 'SequelizeAccessDeniedError';
  }
}
exports.AccessDeniedError = AccessDeniedError;

/**
 * Thrown when a connection to a database has a hostname that was not found
 * @extends ConnectionError
 * @constructor
 */
class HostNotFoundError extends ConnectionError {
  constructor(parent) {
    super(parent);
    this.name = 'SequelizeHostNotFoundError';
  }
}
exports.HostNotFoundError = HostNotFoundError;

/**
 * Thrown when a connection to a database has a hostname that was not reachable
 * @extends ConnectionError
 * @constructor
 */
class HostNotReachableError extends ConnectionError {
  constructor(parent) {
    super(parent);
    this.name = 'SequelizeHostNotReachableError';
  }
}
exports.HostNotReachableError = HostNotReachableError;

/**
 * Thrown when a connection to a database has invalid values for any of the connection parameters
 * @extends ConnectionError
 * @constructor
 */
class InvalidConnectionError extends ConnectionError {
  constructor(parent) {
    super(parent);
    this.name = 'SequelizeInvalidConnectionError';
  }
}
exports.InvalidConnectionError = InvalidConnectionError;

/**
 * Thrown when a connection to a database times out
 * @extends ConnectionError
 * @constructor
 */
class ConnectionTimedOutError extends ConnectionError {
  constructor(parent) {
    super(parent);
    this.name = 'SequelizeConnectionTimedOutError';
  }
}
exports.ConnectionTimedOutError = ConnectionTimedOutError;

/**
 * Thrown when a some problem occurred with Instance methods (see message for details)
 * @extends BaseError
 * @constructor
 */
class InstanceError extends BaseError {
  constructor(message) {
    super(message);
    this.name = 'SequelizeInstanceError';
    this.message = message;
  }
}
exports.InstanceError = InstanceError;

/**
 * Thrown when a record was not found, Usually used with rejectOnEmpty mode (see message for details)
 * @extends BaseError
 * @constructor
 */
class EmptyResultError extends BaseError {
  constructor(message) {
    super(message);
    this.name = 'SequelizeEmptyResultError';
    this.message = message;
  }
}
exports.EmptyResultError = EmptyResultError;
