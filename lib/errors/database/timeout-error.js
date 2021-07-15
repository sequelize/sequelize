'use strict';

const DatabaseError = require('./../database-error');

/**
 * Thrown when a database query times out because of a deadlock
 */
class TimeoutError extends DatabaseError {
  constructor(parent) {
    super(parent);
    this.name = 'SequelizeTimeoutError';
  }
}

module.exports = TimeoutError;
