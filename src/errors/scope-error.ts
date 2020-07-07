import BaseError from './base-error';

/**
 * Scope Error. Thrown when the sequelize cannot query the specified scope.
 */
class ScopeError extends BaseError {
  constructor(message: string) {
    super(message);
    this.name = 'SequelizeScopeError';
  }
}

export default ScopeError;
