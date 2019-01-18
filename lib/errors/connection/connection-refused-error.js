'use strict';

const ConnectionError = require('./../connection-error');

/**
 * Thrown when a connection to a database is refused
 */
class ConnectionRefusedError extends ConnectionError {
  constructor(parent) {
    super(parent);
    this.name = 'SequelizeConnectionRefusedError';
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ConnectionRefusedError;
