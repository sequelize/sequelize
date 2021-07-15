'use strict';

const ConnectionError = require('./../connection-error');

/**
 * Thrown when a connection to a database has invalid values for any of the connection parameters
 */
class InvalidConnectionError extends ConnectionError {
  constructor(parent) {
    super(parent);
    this.name = 'SequelizeInvalidConnectionError';
  }
}

module.exports = InvalidConnectionError;
