'use strict';

const BaseError = require('../base-error');

/**
 * Thrown when a connection to a database is closed while an operation is in progress
 */
class ConnectionClosedError extends BaseError {
  constructor(message) {
    super(message);
    this.name = 'SequelizeConnectionClosedError';
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ConnectionClosedError;
