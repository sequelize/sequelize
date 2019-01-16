'use strict';

const BaseError = require('./base-error');

/**
 * Thrown when a some problem occurred with Instance methods (see message for details)
 */
class InstanceError extends BaseError {
  constructor(message) {
    super(message);
    this.name = 'SequelizeInstanceError';
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = InstanceError;
