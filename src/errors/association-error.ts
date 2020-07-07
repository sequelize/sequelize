import BaseError from './base-error';

/**
 * Thrown when an association is improperly constructed (see message for details)
 */
class AssociationError extends BaseError {
  constructor(message: string) {
    super(message);
    this.name = 'SequelizeAssociationError';
  }
}

export default AssociationError;
