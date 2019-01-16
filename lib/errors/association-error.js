'use strict';

const BaseError = require('./base-error');

/**
 * Thrown when an association is improperly constructed (see message for details)
 */
class AssociationError extends BaseError {
  constructor(message) {
    super(message);
    this.name = 'SequelizeAssociationError';
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AssociationError;
