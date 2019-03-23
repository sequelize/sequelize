'use strict';

const ConnectionError = require('./../connection-error');

/**
 * Thrown when connection is not acquired due to timeout
 */
class ConnectionAcquireTimeoutError extends ConnectionError {
  constructor(parent) {
    super(parent);
    this.name = 'SequelizeConnectionAcquireTimeoutError';
  }
}

module.exports = ConnectionAcquireTimeoutError;
