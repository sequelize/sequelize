'use strict';

const BaseError = require('./base-error');

/**
 * A base class for all database related errors.
 */
class DatabaseError extends BaseError {
  constructor(parent) {
    super(parent.message);
    this.name = 'SequelizeDatabaseError';
    /**
     * @type {Error}
     */
    this.parent = parent;
    /**
     * @type {Error}
     */
    this.original = parent;
    /**
     * The SQL that triggered the error
     * @type {string}
     */
    this.sql = parent.sql;
  }
}

module.exports = DatabaseError;
