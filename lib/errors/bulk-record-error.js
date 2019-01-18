'use strict';

const BaseError = require('./base-error');

/**
 * Thrown when bulk operation fails, it represent per record level error.
 * Used with Promise.AggregateError
 *
 * @param {Error}  error   Error for a given record/instance
 * @param {Object} record  DAO instance that error belongs to
 */
class BulkRecordError extends BaseError {
  constructor(error, record) {
    super(error.message);
    this.name = 'SequelizeBulkRecordError';
    this.errors = error;
    this.record = record;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = BulkRecordError;
