'use strict';

const BaseError = require('./base-error');

/**
 * Error that occurs w
 */
class ConcurrentQueryError extends BaseError {
  constructor(queries) {
    super(`Expected 0 running queries. ${queries.size} queries still running`);
    this.name = 'SequelizeConcurrentQueryError';
    this.queries = queries;
    console.log(queries);
  }
}

module.exports = ConcurrentQueryError;
