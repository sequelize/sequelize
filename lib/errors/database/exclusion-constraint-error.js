'use strict';

const DatabaseError = require('./../database-error');

/**
 * Thrown when an exclusion constraint is violated in the database
 */
class ExclusionConstraintError extends DatabaseError {
  constructor(options = {}) {
    options.parent = options.parent || { sql: '' };

    super(options.parent);
    this.name = 'SequelizeExclusionConstraintError';

    this.message = options.message || options.parent.message || '';
    this.constraint = options.constraint;
    this.fields = options.fields;
    this.table = options.table;
  }
}

module.exports = ExclusionConstraintError;
