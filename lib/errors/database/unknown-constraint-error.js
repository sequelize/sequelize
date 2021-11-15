'use strict';

const DatabaseError = require('./../database-error');

/**
 * Thrown when constraint name is not found in the database
 */
class UnknownConstraintError extends DatabaseError {
  constructor(options) {
    options = options || {};
    options.parent = options.parent || { sql: '' };

    super(options.parent, { stack: options.stack });
    this.name = 'SequelizeUnknownConstraintError';

    this.message = options.message || 'The specified constraint does not exist';
    this.constraint = options.constraint;
    this.fields = options.fields;
    this.table = options.table;
  }
}

module.exports = UnknownConstraintError;
