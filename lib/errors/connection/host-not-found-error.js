'use strict';

const ConnectionError = require('./../connection-error');

/**
 * Thrown when a connection to a database has a hostname that was not found
 */
class HostNotFoundError extends ConnectionError {
  constructor(parent) {
    super(parent);
    this.name = 'SequelizeHostNotFoundError';
  }
}

module.exports = HostNotFoundError;
