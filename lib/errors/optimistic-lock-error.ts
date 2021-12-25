import BaseError from './base-error';

interface OptimisticLockErrorOptions {
  message?: string;

  /** The name of the model on which the update was attempted */
  modelName?: string;

  /** The values of the attempted update */
  values?: Record<string, unknown>;
  where?: Record<string, unknown>;
}

/**
 * Thrown when attempting to update a stale model instance
 */
class OptimisticLockError extends BaseError {
  modelName?: string;
  values?: Record<string, unknown>;
  where?: Record<string, unknown>;

  constructor(options: OptimisticLockErrorOptions) {
    options = options || {};
    options.message =
      options.message ||
      `Attempting to update a stale model instance: ${options.modelName}`;

    super(options.message);
    this.name = 'SequelizeOptimisticLockError';
    this.modelName = options.modelName;
    this.values = options.values;
    this.where = options.where;
  }
}

export default OptimisticLockError;
