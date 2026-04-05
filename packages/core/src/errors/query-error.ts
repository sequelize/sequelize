import { BaseError } from './base-error';

/**
 * Thrown when a query is passed invalid options (see message for details)
 */
export class QueryError extends BaseError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SequelizeQueryError';
  }
}
