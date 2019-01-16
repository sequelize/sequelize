'use strict';

const ConnectionError = require('./../connection-error');

/**
 * Thrown when a connection to a database has a hostname that was not reachable
 */
class HostNotReachableError extends ConnectionError {
  constructor(parent) {
    super(parent);
    this.name = 'SequelizeHostNotReachableError';
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = HostNotReachableError;
