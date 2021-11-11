'use strict';

const BaseError = require('./base-error');

/**
 * A base class for all database related errors.
 */
class DatabaseError extends BaseError {
  constructor(parent, options) {
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
     *
     * @type {string}
     */
    this.sql = parent.sql;
    /**
     * The parameters for the sql that triggered the error
     *
     * @type {Array<any>}
     */
    this.parameters = parent.parameters;
    /**
     * The stacktrace can be overridden if the original stacktrace isn't very good
     *
     * @type {string}
     */
    if (options && options.stack) {
      this.stack = options.stack;
    }
  }
}

module.exports = DatabaseError;
