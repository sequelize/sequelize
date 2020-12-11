import BaseError from './base-error';

export interface SQLError extends Error {
  sql: string;
  parameters?: unknown[];
}

/**
 * A base class for all database related errors.
 */
class DatabaseError extends BaseError {
  parent: SQLError;
  original: SQLError;

  /**
   * The SQL that triggered the error
   */
  sql: string;

  /**
   * The parameters for the sql that triggered the error
   */
  parameters?: unknown[];

  constructor(parent: SQLError) {
    super(parent.message);
    this.name = 'SequelizeDatabaseError';
    this.parent = parent;
    this.original = parent;
    this.sql = parent.sql;
    this.parameters = parent.parameters;
  }
}

export default DatabaseError;
