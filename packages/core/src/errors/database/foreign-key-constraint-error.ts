import { useErrorCause } from '../../utils/deprecations.js';
import type { DatabaseErrorSubclassOptions } from '../database-error';
import { DatabaseError } from '../database-error';

export enum RelationshipType {
  parent = 'parent',
  child = 'child',
}

interface ForeignKeyConstraintErrorOptions {
  table?: string;
  fields?: { [field: string]: string };
  value?: unknown;
  index?: string;
  reltype?: RelationshipType;
}

/**
 * Thrown when a foreign key constraint is violated in the database
 */
export class ForeignKeyConstraintError extends DatabaseError {
  table: string | undefined;
  fields: { [field: string]: string } | undefined;
  value: unknown;
  index: string | undefined;
  reltype: RelationshipType | undefined;

  constructor(options: ForeignKeyConstraintErrorOptions & DatabaseErrorSubclassOptions = {}) {
    if ('parent' in options) {
      useErrorCause();
    }

    const parent = options.cause ?? options.parent ?? { sql: '', name: '', message: '' };

    super(parent);
    this.name = 'SequelizeForeignKeyConstraintError';
    this.fields = options.fields;
    this.table = options.table;
    this.value = options.value;
    this.index = options.index;
    this.reltype = options.reltype;
  }
}
