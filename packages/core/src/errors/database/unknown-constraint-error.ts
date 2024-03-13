import { useErrorCause } from '../../utils/deprecations.js';
import type { DatabaseErrorSubclassOptions } from '../database-error';
import { DatabaseError } from '../database-error';

interface UnknownConstraintErrorOptions {
  constraint?: string;
  fields?: Record<string, string | number>;
  table?: string;
}

/**
 * Thrown when constraint name is not found in the database
 */
export class UnknownConstraintError extends DatabaseError {
  constraint: string | undefined;
  fields: Record<string, string | number> | undefined;
  table: string | undefined;

  constructor(options: UnknownConstraintErrorOptions & DatabaseErrorSubclassOptions = {}) {
    if ('parent' in options) {
      useErrorCause();
    }

    const parent = options.cause ?? options.parent ?? { sql: '', name: '', message: '' };

    super(parent);
    this.name = 'SequelizeUnknownConstraintError';
    this.constraint = options.constraint;
    this.fields = options.fields;
    this.table = options.table;
  }
}
