import type { ErrorOptions } from './base-error';
import { BaseError } from './base-error';

/**
 * Scope Error. Thrown when the sequelize cannot query the specified scope.
 */
export class SequelizeScopeError extends BaseError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'SequelizeScopeError';
  }
}
