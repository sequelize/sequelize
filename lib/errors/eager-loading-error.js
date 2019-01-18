'use strict';

const BaseError = require('./base-error');

/**
 * Thrown when an include statement is improperly constructed (see message for details)
 */
class EagerLoadingError extends BaseError {
  constructor(message) {
    super(message);
    this.name = 'SequelizeEagerLoadingError';
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = EagerLoadingError;
