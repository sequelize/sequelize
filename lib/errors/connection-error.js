'use strict';

const BaseError = require('./base-error');

/**
 * A base class for all connection related errors.
 */
class ConnectionError extends BaseError {
  constructor(parent) {
    super(parent ? parent.message : '');
    this.name = 'SequelizeConnectionError';
    /**
     * The connection specific error which triggered this one
     *
     * @type {Error}
     */
    this.parent = parent;
    this.original = parent;
  }
}

module.exports = ConnectionError;
