'use strict';

const BaseError = require('./base-error');

/**
 * Thrown when attempting to update a stale model instance
 */
class OptimisticLockError extends BaseError {
  constructor(options = {}) {
    options.message = options.message || `Attempting to update a stale model instance: ${options.modelName}`;
    super(options.message);
    this.name = 'SequelizeOptimisticLockError';
    /**
     * The name of the model on which the update was attempted
     * @type {string}
     */
    this.modelName = options.modelName;
    /**
     * The values of the attempted update
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

module.exports = OptimisticLockError;
