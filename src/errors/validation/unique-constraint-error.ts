import ValidationError, { ValidationErrorItem } from './../validation-error';

interface SQLError extends Error {
  sql: string;
}

interface UniqueConstraintErrorOptions {
  parent: SQLError;
  message: string;
  errors: ValidationErrorItem[];
  fields: string[];
}

/**
 * Thrown when a unique constraint is violated in the database
 */
class UniqueConstraintError extends ValidationError {
  fields: string[];
  parent: SQLError;
  original: SQLError;
  sql: string;

  constructor(options: UniqueConstraintErrorOptions) {
    options = options || {};
    options.parent = options.parent || { sql: '' };
    options.message = options.message || options.parent.message || 'Validation Error';
    options.errors = options.errors || {};
    super(options.message, options.errors);

    this.name = 'SequelizeUniqueConstraintError';
    this.fields = options.fields;
    this.parent = options.parent;
    this.original = options.parent;
    this.sql = options.parent.sql;
  }
}

export default UniqueConstraintError;
