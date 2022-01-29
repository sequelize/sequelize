import DatabaseError, { DatabaseErrorSubclassOptions } from '../database-error';

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
class ForeignKeyConstraintError extends DatabaseError {
  table: string | undefined;
  fields: { [field: string]: string } | undefined;
  value: unknown;
  index: string | undefined;
  reltype: RelationshipType | undefined;

  constructor(
    options: ForeignKeyConstraintErrorOptions & DatabaseErrorSubclassOptions
  ) {
    options = options || {};
    options.parent = options.parent || { sql: '', name: '', message: '' };

    super(options.parent, { stack: options.stack });
    this.name = 'SequelizeForeignKeyConstraintError';

    this.message =
      options.message || options.parent.message || 'Database Error';
    this.fields = options.fields;
    this.table = options.table;
    this.value = options.value;
    this.index = options.index;
    this.reltype = options.reltype;
  }
}

export default ForeignKeyConstraintError;
