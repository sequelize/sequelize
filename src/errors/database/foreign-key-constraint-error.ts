import DatabaseError, { SQLError } from './../database-error';

interface ForeignKeyConstraintErrorOptions {
  parent: SQLError;
  message: string;
  fields: string[];
  table: string;
  value: string;
  index: string;
  reltype: string;
}

/**
 * Thrown when a foreign key constraint is violated in the database
 */
class ForeignKeyConstraintError extends DatabaseError {
  message: string;
  fields: string[];
  table: string;
  value: string;
  index: string;
  reltype: string;

  constructor(options: ForeignKeyConstraintErrorOptions) {
    options = options || {};
    options.parent = options.parent || { sql: '' };

    super(options.parent);
    this.name = 'SequelizeForeignKeyConstraintError';

    this.message = options.message || options.parent.message || 'Database Error';
    this.fields = options.fields;
    this.table = options.table;
    this.value = options.value;
    this.index = options.index;
    this.reltype = options.reltype;
  }
}

export default ForeignKeyConstraintError;
