import { useErrorCause } from '../../utils/deprecations.js';
import type { DatabaseErrorSubclassOptions } from '../database-error';
import { DatabaseError } from '../database-error';

interface ExclusionConstraintErrorOptions {
  constraint?: string;
  fields?: Record<string, string | number>;
  table?: string;
}

/**
 * Thrown when an exclusion constraint is violated in the database
 */
export class ExclusionConstraintError extends DatabaseError {
  constraint: string | undefined;
  fields: Record<string, string | number> | undefined;
  table: string | undefined;

  constructor(options: DatabaseErrorSubclassOptions & ExclusionConstraintErrorOptions = {}) {
    if ('parent' in options) {
      useErrorCause();
    }

    const parent = options.cause ?? options.parent ?? { sql: '', name: '', message: '' };

    super(parent);
    this.message = options.message || parent.message;
    this.name = 'SequelizeExclusionConstraintError';
    this.constraint = options.constraint;
    this.fields = options.fields;
    this.table = options.table;
  }
}
