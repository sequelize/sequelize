'use strict';

const _ = require('lodash');

/**
 * Sequelize provides a host of custom error classes, to allow you to do easier debugging. All of these errors are exposed on the sequelize object and the sequelize constructor.
 * All sequelize errors inherit from the base JS error object.
 *
 * This means that errors can be accessed using `Sequelize.ValidationError` or `sequelize.ValidationError`
 * The Base Error all Sequelize Errors inherit from.
 */
class BaseError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SequelizeBaseError';
    Error.captureStackTrace(this, this.constructor);
  }
}
exports.BaseError = BaseError;

/**
 * Scope Error. Thrown when the sequelize cannot query the specified scope.
 */
class SequelizeScopeError extends BaseError {
  constructor(parent) {
    super(parent);
    this.name = 'SequelizeScopeError';
    Error.captureStackTrace(this, this.constructor);
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
 * @property errors {ValidationErrorItems[]}
 */
class ValidationError extends BaseError {
  constructor(message, errors) {
    super(message);
    this.name = 'SequelizeValidationError';
    this.message = 'Validation Error';
    /**
     *
     * @type {ValidationErrorItem[]}
     */
    this.errors = errors || [];

    // Use provided error message if available...
    if (message) {
      this.message = message;

      // ... otherwise create a concatenated message out of existing errors.
    } else if (this.errors.length > 0 && this.errors[0].message) {
      this.message = this.errors.map(err => (err.type || err.origin) + ': ' + err.message).join(',\n');
    }
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Gets all validation error items for the path / field specified.
   *
   * @param {string} path The path to be checked for error items
   * @returns {ValidationErrorItem[]} Validation error items for the specified path
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
 * Thrown when attempting to update a stale model instance
 */
class OptimisticLockError extends BaseError {
  constructor(options) {
    options = options || {};
    options.message = options.message || 'Attempting to update a stale model instance: ' + options.modelName;
    super(options);
    this.name = 'SequelizeOptimisticLockError';
    /**
     * The name of the model on which the update was attempted
     * @type {string}
     */
    this.modelName = options.modelName;
    /**
     * The values of the attempted update
     * @type {object}
     */
    this.values = options.values;
    /**
     *
     * @type {object}
     */
    this.where = options.where;
    Error.captureStackTrace(this, this.constructor);
  }
}
exports.OptimisticLockError = OptimisticLockError;

/**
 * A base class for all database related errors.
 */
class DatabaseError extends BaseError {
  constructor(parent) {
    super(parent.message);
    this.name = 'SequelizeDatabaseError';
    /**
     * @type {Error}
     */
    this.parent = parent;
    /**
     * @type {Error}
     */
    this.original = parent;
    /**
     * The SQL that triggered the error
     * @type {string}
     */
    this.sql = parent.sql;
    Error.captureStackTrace(this, this.constructor);
  }
}
exports.DatabaseError = DatabaseError;

/**
 * Thrown when a database query times out because of a deadlock
 */
class TimeoutError extends DatabaseError {
  constructor(parent) {
    super(parent);
    this.name = 'SequelizeTimeoutError';
    Error.captureStackTrace(this, this.constructor);
  }
}
exports.TimeoutError = TimeoutError;

/**
 * Thrown when a unique constraint is violated in the database
 */
class UniqueConstraintError extends ValidationError {
  constructor(options) {
    options = options || {};
    options.parent = options.parent || { sql: '' };
    options.message = options.message || options.parent.message || 'Validation Error';
    options.errors = options.errors || {};
    super(options.message, options.errors);

    this.name = 'SequelizeUniqueConstraintError';
    this.errors = options.errors;
    this.fields = options.fields;
    this.parent = options.parent;
    this.original = options.parent;
    this.sql = options.parent.sql;
    Error.captureStackTrace(this, this.constructor);
  }
}
exports.UniqueConstraintError = UniqueConstraintError;

/**
 * Thrown when a foreign key constraint is violated in the database
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
    this.reltype = options.reltype;
    Error.captureStackTrace(this, this.constructor);
  }
}
exports.ForeignKeyConstraintError = ForeignKeyConstraintError;

/**
 * Thrown when an exclusion constraint is violated in the database
 */
class ExclusionConstraintError extends DatabaseError {
  constructor(options) {
    options = options || {};
    options.parent = options.parent || { sql: '' };

    super(options.parent);
    this.name = 'SequelizeExclusionConstraintError';

    this.message = options.message || options.parent.message || '';
    this.constraint = options.constraint;
    this.fields = options.fields;
    this.table = options.table;
    Error.captureStackTrace(this, this.constructor);
  }
}
exports.ExclusionConstraintError = ExclusionConstraintError;

/**
 * Thrown when constraint name is not found in the database
 */
class UnknownConstraintError extends DatabaseError {
  constructor(message) {
    const parent = { message };
    super(parent);
    this.name = 'SequelizeUnknownConstraintError';
    this.message = message || 'The specified constraint does not exist';
    Error.captureStackTrace(this, this.constructor);
  }
}
exports.UnknownConstraintError = UnknownConstraintError;

/**
 * Validation Error Item
 * Instances of this class are included in the `ValidationError.errors` property.
 *
 * @param {String} message An error message
 * @param {String} type The type/origin of the validation error
 * @param {String} path The field that triggered the validation error
 * @param {String} value The value that generated the error
 * @param {Object} [inst] the DAO instance that caused the validation error
 * @param {Object} [validatorKey] a validation "key", used for identification
 * @param {String} [fnName] property name of the BUILT-IN validator function that caused the validation error (e.g. "in" or "len"), if applicable
 * @param {String} [fnArgs] parameters used with the BUILT-IN validator function, if applicable
 */
class ValidationErrorItem {
  constructor(message, type, path, value, inst, validatorKey, fnName, fnArgs) {
    /**
     * An error message
     *
     * @type {String} message
     */
    this.message = message || '';

    /**
     * The type/origin of the validation error
     *
     * @type {String}
     */
    this.type = null;

    /**
     * The field that triggered the validation error
     *
     * @type {String}
     */
    this.path = path || null;

    /**
     * The value that generated the error
     *
     * @type {String}
     */
    this.value = value !== undefined ? value : null;

    this.origin = null;

    /**
     * The DAO instance that caused the validation error
     *
     * @type {Model}
     */
    this.instance = inst || null;

    /**
     * A validation "key", used for identification
     *
     * @type {String}
     */
    this.validatorKey = validatorKey || null;

    /**
     * Property name of the BUILT-IN validator function that caused the validation error (e.g. "in" or "len"), if applicable
     *
     * @type {String}
     */
    this.validatorName = fnName || null;

    /**
     * Parameters used with the BUILT-IN validator function, if applicable
     *
     * @type {String}
     */
    this.validatorArgs = fnArgs || [];

    if (type) {
      if (ValidationErrorItem.Origins[ type ]) {
        this.origin = type;
      } else {
        const lowercaseType = _.toLower(type + '').trim();
        const realType  = ValidationErrorItem.TypeStringMap[ lowercaseType ];

        if (realType && ValidationErrorItem.Origins[ realType ]) {
          this.origin = realType;
          this.type = type;
        }
      }
    }

    // This doesn't need captureStackTrace because it's not a subclass of Error
  }

  /**
   * return a lowercase, trimmed string "key" that identifies the validator.
   *
   * Note: the string will be empty if the instance has neither a valid `validatorKey` property nor a valid `validatorName` property
   *
   * @param   {Boolean} [useTypeAsNS=true]      controls whether the returned value is "namespace",
   *                                            this parameter is ignored if the validator's `type` is not one of ValidationErrorItem.Origins
   * @param   {String}  [NSSeparator='.']       a separator string for concatenating the namespace, must be not be empty,
   *                                            defaults to "." (fullstop). only used and validated if useTypeAsNS is TRUE.
   * @throws  {Error}                           thrown if NSSeparator is found to be invalid.
   * @return  {String}
   *
   * @private
   */
  getValidatorKey(useTypeAsNS, NSSeparator) {
    const useTANS = typeof useTypeAsNS === 'undefined' ?  true : !!useTypeAsNS;
    const NSSep = typeof NSSeparator === 'undefined' ? '.' : NSSeparator;

    const type = this.origin;
    const key = this.validatorKey || this.validatorName;
    const useNS = useTANS && type && ValidationErrorItem.Origins[ type ];

    if (useNS && (typeof NSSep !== 'string' || !NSSep.length)) {
      throw new Error('Invalid namespace separator given, must be a non-empty string');
    }

    if (!(typeof key === 'string' && key.length)) {
      return '';
    }

    return _.toLower(useNS ? [type, key].join(NSSep) : key).trim();
  }
}

exports.ValidationErrorItem = ValidationErrorItem;

/**
 * An enum that defines valid ValidationErrorItem `origin` values
 *
 * @type {Object}
 * @property CORE       {String}  specifies errors that originate from the sequelize "core"
 * @property DB         {String}  specifies validation errors that originate from the storage engine
 * @property FUNCTION   {String}  specifies validation errors that originate from validator functions (both built-in and custom) defined for a given attribute
 */
ValidationErrorItem.Origins = {
  CORE: 'CORE',
  DB: 'DB',
  FUNCTION: 'FUNCTION'
};

/**
 * An object that is used internally by the `ValidationErrorItem` class
 * that maps current `type` strings (as given to ValidationErrorItem.constructor()) to
 * our new `origin` values.
 *
 * @type {Object}
 */
ValidationErrorItem.TypeStringMap = {
  'notnull violation': 'CORE',
  'string violation': 'CORE',
  'unique violation': 'DB',
  'validation error': 'FUNCTION'
};

/**
 * A base class for all connection related errors.
 */
class ConnectionError extends BaseError {
  constructor(parent) {
    super(parent ? parent.message : '');
    this.name = 'SequelizeConnectionError';
    /**
     * The connection specific error which triggered this one
     * @type {Error}
     */
    this.parent = parent;
    this.original = parent;
    Error.captureStackTrace(this, this.constructor);
  }
}
exports.ConnectionError = ConnectionError;

/**
 * Thrown when a connection to a database is refused
 */
class ConnectionRefusedError extends ConnectionError {
  constructor(parent) {
    super(parent);
    this.name = 'SequelizeConnectionRefusedError';
    Error.captureStackTrace(this, this.constructor);
  }
}
exports.ConnectionRefusedError = ConnectionRefusedError;

/**
 * Thrown when a connection to a database is refused due to insufficient privileges
 */
class AccessDeniedError extends ConnectionError {
  constructor(parent) {
    super(parent);
    this.name = 'SequelizeAccessDeniedError';
    Error.captureStackTrace(this, this.constructor);
  }
}
exports.AccessDeniedError = AccessDeniedError;

/**
 * Thrown when a connection to a database has a hostname that was not found
 */
class HostNotFoundError extends ConnectionError {
  constructor(parent) {
    super(parent);
    this.name = 'SequelizeHostNotFoundError';
    Error.captureStackTrace(this, this.constructor);
  }
}
exports.HostNotFoundError = HostNotFoundError;

/**
 * Thrown when a connection to a database has a hostname that was not reachable
 */
class HostNotReachableError extends ConnectionError {
  constructor(parent) {
    super(parent);
    this.name = 'SequelizeHostNotReachableError';
    Error.captureStackTrace(this, this.constructor);
  }
}
exports.HostNotReachableError = HostNotReachableError;

/**
 * Thrown when a connection to a database has invalid values for any of the connection parameters
 */
class InvalidConnectionError extends ConnectionError {
  constructor(parent) {
    super(parent);
    this.name = 'SequelizeInvalidConnectionError';
    Error.captureStackTrace(this, this.constructor);
  }
}
exports.InvalidConnectionError = InvalidConnectionError;

/**
 * Thrown when a connection to a database times out
 */
class ConnectionTimedOutError extends ConnectionError {
  constructor(parent) {
    super(parent);
    this.name = 'SequelizeConnectionTimedOutError';
    Error.captureStackTrace(this, this.constructor);
  }
}
exports.ConnectionTimedOutError = ConnectionTimedOutError;

/**
 * Thrown when a some problem occurred with Instance methods (see message for details)
 */
class InstanceError extends BaseError {
  constructor(message) {
    super(message);
    this.name = 'SequelizeInstanceError';
    Error.captureStackTrace(this, this.constructor);
  }
}
exports.InstanceError = InstanceError;

/**
 * Thrown when a record was not found, Usually used with rejectOnEmpty mode (see message for details)
 */
class EmptyResultError extends BaseError {
  constructor(message) {
    super(message);
    this.name = 'SequelizeEmptyResultError';
    Error.captureStackTrace(this, this.constructor);
  }
}
exports.EmptyResultError = EmptyResultError;

/**
 * Thrown when an include statement is improperly constructed (see message for details)
 */
class EagerLoadingError extends BaseError {
  constructor(message) {
    super(message);
    this.name = 'SequelizeEagerLoadingError';
    Error.captureStackTrace(this, this.constructor);
  }
}
exports.EagerLoadingError = EagerLoadingError;

/**
 * Thrown when an association is improperly constructed (see message for details)
 */
class AssociationError extends BaseError {
  constructor(message) {
    super(message);
    this.name = 'SequelizeAssociationError';
    Error.captureStackTrace(this, this.constructor);
  }
}
exports.AssociationError = AssociationError;
/**
 * Thrown when a query is passed invalid options (see message for details)
 */
class QueryError extends BaseError {
  constructor(message) {
    super(message);
    this.name = 'SequelizeQueryError';
    Error.captureStackTrace(this, this.constructor);
  }
}
exports.QueryError = QueryError;

/**
 * Thrown when bulk operation fails, it represent per record level error.
 * Used with Promise.AggregateError
 *
 * @param {Error}  error   Error for a given record/instance
 * @param {Object} record  DAO instance that error belongs to
 */
class BulkRecordError extends BaseError {
  constructor(error, record) {
    super(error.message);
    this.name = 'SequelizeBulkRecordError';
    this.errors = error;
    this.record = record;
    Error.captureStackTrace(this, this.constructor);
  }
}
exports.BulkRecordError = BulkRecordError;
