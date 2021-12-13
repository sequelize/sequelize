import DatabaseError, { DatabaseErrorSubclassOptions } from '../database-error';

interface UnknownConstraintErrorOptions {
  constraint: string;
  fields: Record<string, string | number>;
  table: string;
}

/**
 * Thrown when constraint name is not found in the database
 */
class UnknownConstraintError
  extends DatabaseError
  implements UnknownConstraintErrorOptions
{
  constraint: string;
  fields: Record<string, string | number>;
  table: string;

  constructor(
    options: UnknownConstraintErrorOptions & DatabaseErrorSubclassOptions
  ) {
    options = options || {};
    options.parent = options.parent || { sql: '', name: '', message: '' };

    super(options.parent, { stack: options.stack });
    this.name = 'SequelizeUnknownConstraintError';

    this.message = options.message || 'The specified constraint does not exist';
    this.constraint = options.constraint;
    this.fields = options.fields;
    this.table = options.table;
  }
}

export default UnknownConstraintError;
