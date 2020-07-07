import BaseError from './base-error';

/**
 * Thrown when a record was not found, Usually used with rejectOnEmpty mode (see message for details)
 */
class EmptyResultError extends BaseError {
  constructor(message: string) {
    super(message);
    this.name = 'SequelizeEmptyResultError';
  }
}

export default EmptyResultError;
