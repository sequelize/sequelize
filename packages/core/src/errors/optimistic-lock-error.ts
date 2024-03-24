import { BaseError } from './base-error';

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
export class OptimisticLockError extends BaseError {
  modelName: string | undefined;
  values: Record<string, unknown> | undefined;
  where: Record<string, unknown> | undefined;

  constructor(options?: OptimisticLockErrorOptions, errorOptions?: ErrorOptions) {
    const message =
      options?.message || `Attempting to update a stale model instance: ${options?.modelName}`;

    super(message, errorOptions);
    this.name = 'SequelizeOptimisticLockError';
    this.modelName = options?.modelName;
    this.values = options?.values;
    this.where = options?.where;
  }
}
