import DatabaseError, { SQLError } from './../database-error';

interface ExclusionConstraintErrorOptions {
  parent: SQLError;
  message: string;
  constraint: string;
  fields: string[];
  table: string;
}

/**
 * Thrown when an exclusion constraint is violated in the database
 */
class ExclusionConstraintError extends DatabaseError {
  constraint: string;
  fields: string[];
  table: string;

  constructor(options: ExclusionConstraintErrorOptions) {
    options = options || {};
    options.parent = options.parent || { sql: '' };

    super(options.parent);
    this.name = 'SequelizeExclusionConstraintError';
    this.message = options.message || options.parent.message || '';
    this.constraint = options.constraint;
    this.fields = options.fields;
    this.table = options.table;
  }
}

export default ExclusionConstraintError;
