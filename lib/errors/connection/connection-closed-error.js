'use strict';

const ConnectionError = require('./../connection-error');

/**
 * Thrown when a connection to a database is closed while an operation is in progress
 */
class ConnectionClosedError extends ConnectionError {
  constructor(parentOrMessage) {
    super(parentOrMessage);
    this.name = 'SequelizeConnectionClosedError';
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = ConnectionClosedError;
