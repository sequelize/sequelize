'use strict';

const DatabaseError = require('./../database-error');

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

module.exports = ForeignKeyConstraintError;
