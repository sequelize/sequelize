import { BaseError } from './base-error';

/**
 * Thrown when a record was not found, Usually used with rejectOnEmpty mode (see message for details)
 */
export class EmptyResultError extends BaseError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SequelizeEmptyResultError';
  }
}
