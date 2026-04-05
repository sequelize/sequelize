import { BaseError } from './base-error';

/**
 * Thrown when an association is improperly constructed (see message for details)
 */
export class AssociationError extends BaseError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SequelizeAssociationError';
  }
}
