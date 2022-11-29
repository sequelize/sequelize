import DatabaseError, { DatabaseErrorSubclassOptions } from '../database-error';
import { removeUndefined } from '../../utils/object.js';

interface ExclusionConstraintErrorOptions {
  constraint?: string;
  fields?: Record<string, string | number>;
  table?: string;
}

/**
 * Thrown when an exclusion constraint is violated in the database
 */
class ExclusionConstraintError extends DatabaseError {
  constraint: string | undefined;
  fields: Record<string, string | number> | undefined;
  table: string | undefined;

  constructor(
    options: DatabaseErrorSubclassOptions & ExclusionConstraintErrorOptions
  ) {
    options = options || {};
    options.parent = options.parent || { sql: '', name: '', message: '' };

    super(options.parent, removeUndefined({ stack: options.stack }));
    this.name = 'SequelizeExclusionConstraintError';

    this.message = options.message || options.parent.message || '';
    this.constraint = options.constraint;
    this.fields = options.fields;
    this.table = options.table;
  }
}

export default ExclusionConstraintError;
