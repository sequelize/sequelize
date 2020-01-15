'use strict';

const ValidationError = require('./../validation-error');

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

module.exports = UniqueConstraintError;
