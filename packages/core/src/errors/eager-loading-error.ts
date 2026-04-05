import { BaseError } from './base-error';

/**
 * Thrown when an include statement is improperly constructed (see message for details)
 */
export class EagerLoadingError extends BaseError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SequelizeEagerLoadingError';
  }
}
