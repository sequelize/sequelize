import BaseError from './base-error';

/**
 * Thrown when a some problem occurred with Instance methods (see message for details)
 */
class InstanceError extends BaseError {
  constructor(message: string) {
    super(message);
    this.name = 'SequelizeInstanceError';
  }
}

export default InstanceError;
