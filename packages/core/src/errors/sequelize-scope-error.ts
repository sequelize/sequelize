import { BaseError } from './base-error';

/**
 * Scope Error. Thrown when Sequelize cannot query the specified scope.
 */
export class SequelizeScopeError extends BaseError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SequelizeScopeError';
  }
}
