import BaseError, { ErrorOptions } from './base-error';

interface IDatabaseError extends Error {
  /**
   * The SQL that triggered the error
   */
  sql?: string;

  /**
   * The parameters for the sql that triggered the error
   */
  parameters?: object;
}

/**
 * A base class for all database related errors.
 */
class DatabaseError extends BaseError implements IDatabaseError {
  parent: Error;
  original: Error;
  sql?: string;
  parameters?: object;

  constructor(parent: IDatabaseError, options: ErrorOptions = {}) {
    super(parent.message);
    this.name = 'SequelizeDatabaseError';

    this.parent = parent;
    this.original = parent;

    this.sql = parent.sql;
    this.parameters = parent.parameters;

    if (options.stack) {
      this.stack = options.stack;
    }
  }
}

module.exports = DatabaseError;
