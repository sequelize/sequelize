import BaseError from './base-error';

/**
 * Thrown when bulk operation fails, it represent per record level error.
 * Used with AggregateError
 *
 * @param {Error}  error   Error for a given record/instance
 * @param {object} record  DAO instance that error belongs to
 */
class BulkRecordError extends BaseError {
  error: Error;
  record: object;

  constructor(error: Error, record: object) {
    super(error.message);
    this.name = 'SequelizeBulkRecordError';
    this.error = error;
    this.record = record;
  }
}

export default BulkRecordError;
