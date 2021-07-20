'use strict';

const ConnectionError = require('./../connection-error');

/**
 * Thrown when a connection to a database is refused due to insufficient privileges
 */
class AccessDeniedError extends ConnectionError {
  constructor(parent) {
    super(parent);
    this.name = 'SequelizeAccessDeniedError';
  }
}

module.exports = AccessDeniedError;
