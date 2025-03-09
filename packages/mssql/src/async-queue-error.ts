import { BaseError } from '@sequelize/core';

/**
 * Thrown when a connection to a database is closed while an operation is in progress
 */
export class AsyncQueueError extends BaseError {
  constructor(message: string) {
    super(message);
    this.name = 'SequelizeAsyncQueueError';
  }
}
