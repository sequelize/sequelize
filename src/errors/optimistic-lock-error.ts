import BaseError from './base-error';

interface OptimisticLockErrorArguments {
  message?: string;
  modelName: string;
  values: object;
  where: object;
}

/**
 * Thrown when attempting to update a stale model instance
 */
class OptimisticLockError extends BaseError {
  modelName: string;
  values: object;
  where: object;

  constructor(options: OptimisticLockErrorArguments) {
    super(options.message || `Attempting to update a stale model instance: ${options.modelName}`);

    this.name = 'SequelizeOptimisticLockError';

    /**
     * The name of the model on which the update was attempted
     *
     * @type {string}
     */
    this.modelName = options.modelName;

    /**
     * The values of the attempted update
     *
     * @type {object}
     */
    this.values = options.values;

    /**
     *
     * @type {object}
     */
    this.where = options.where;
  }
}

export default OptimisticLockError;
