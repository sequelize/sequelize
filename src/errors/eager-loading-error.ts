import BaseError from './base-error';

/**
 * Thrown when an include statement is improperly constructed (see message for details)
 */
class EagerLoadingError extends BaseError {
  constructor(message: string) {
    super(message);
    this.name = 'SequelizeEagerLoadingError';
  }
}

export default EagerLoadingError;
