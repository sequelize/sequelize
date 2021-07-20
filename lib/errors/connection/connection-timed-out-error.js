'use strict';

const ConnectionError = require('./../connection-error');

/**
 * Thrown when a connection to a database times out
 */
class ConnectionTimedOutError extends ConnectionError {
  constructor(parent) {
    super(parent);
    this.name = 'SequelizeConnectionTimedOutError';
  }
}

module.exports = ConnectionTimedOutError;
