import DatabaseError, { SQLError } from './../database-error';

interface UnknownConstraintErrorOptions {
  parent: SQLError;
  message: string;
  constraint: string;
  fields: string[];
  table: string;
}

/**
 * Thrown when constraint name is not found in the database
 */
class UnknownConstraintError extends DatabaseError {
  constraint: string;
  fields: string[];
  table: string;

  constructor(options: UnknownConstraintErrorOptions) {
    options = options || {};
    options.parent = options.parent || { sql: '' };

    super(options.parent);
    this.name = 'SequelizeUnknownConstraintError';

    this.message = options.message || 'The specified constraint does not exist';
    this.constraint = options.constraint;
    this.fields = options.fields;
    this.table = options.table;
  }
}

export default UnknownConstraintError;
