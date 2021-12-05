import BaseError from './base-error';
import type { Model } from '../../types/lib/model';

/**
 * Thrown when bulk operation fails, it represent per record level error.
 * Used with AggregateError
 *
 * @param error Error for a given record/instance
 * @param record DAO instance that error belongs to
 */
class BulkRecordError extends BaseError {
  errors: Error;
  record: Model;

  constructor(error: Error, record: Model) {
    super(error.message);
    this.name = 'SequelizeBulkRecordError';
    this.errors = error;
    this.record = record;
  }
}

export default BulkRecordError;
