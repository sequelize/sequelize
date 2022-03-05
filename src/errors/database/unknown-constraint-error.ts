import type { DatabaseErrorSubclassOptions } from '../database-error';
import DatabaseError from '../database-error';

interface UnknownConstraintErrorOptions {
  constraint?: string;
  fields?: Record<string, string | number>;
  table?: string;
}

/**
 * Thrown when constraint name is not found in the database
 */
class UnknownConstraintError extends DatabaseError implements UnknownConstraintErrorOptions {
  constraint: string | undefined;
  fields: Record<string, string | number> | undefined;
  table: string | undefined;

  constructor(
    options: UnknownConstraintErrorOptions & DatabaseErrorSubclassOptions,
  ) {
    options = options || {};
    options.parent = options.parent || { sql: '', name: '', message: '' };

    super(options.parent, { stack: options.stack });
    this.name = 'SequelizeUnknownConstraintError';
    this.constraint = options.constraint;
    this.fields = options.fields;
    this.table = options.table;
  }
}

export default UnknownConstraintError;
