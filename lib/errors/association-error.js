'use strict';

const BaseError = require('./base-error');

/**
 * Thrown when an association is improperly constructed (see message for details)
 */
class AssociationError extends BaseError {
  constructor(message) {
    super(message);
    this.name = 'SequelizeAssociationError';
  }
}

module.exports = AssociationError;
