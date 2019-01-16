'use strict';

const BaseError = require('./base-error');

/**
 * Thrown when a record was not found, Usually used with rejectOnEmpty mode (see message for details)
 *
 * @extends BaseError
 */
class EmptyResultError extends BaseError {
  constructor(message) {
    super(message);
    this.name = 'SequelizeEmptyResultError';
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = EmptyResultError;