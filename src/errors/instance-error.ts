import type { ErrorOptions } from './base-error';
import BaseError from './base-error';

/**
 * Thrown when a some problem occurred with Instance methods (see message for details)
 */
class InstanceError extends BaseError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SequelizeInstanceError';
  }
}

export default InstanceError;
