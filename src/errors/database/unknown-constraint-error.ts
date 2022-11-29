import DatabaseError, { DatabaseErrorSubclassOptions } from '../database-error';
import { removeUndefined } from '../../utils/object.js';

interface UnknownConstraintErrorOptions {
  constraint?: string;
  fields?: Record<string, string | number>;
  table?: string;
}

/**
 * Thrown when constraint name is not found in the database
 */
class UnknownConstraintError extends DatabaseError {
  constraint: string | undefined;
  fields: Record<string, string | number> | undefined;
  table: string | undefined;

  constructor(
    options: DatabaseErrorSubclassOptions & UnknownConstraintErrorOptions
  ) {
    options = options || {};
    options.parent = options.parent || { sql: '', name: '', message: '' };

    super(options.parent, removeUndefined({ stack: options.stack }));
    this.name = 'SequelizeUnknownConstraintError';

    this.message = options.message || 'The specified constraint does not exist';
    this.constraint = options.constraint;
    this.fields = options.fields;
    this.table = options.table;
  }
}

export default UnknownConstraintError;
