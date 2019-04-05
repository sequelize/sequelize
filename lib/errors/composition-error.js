'use strict';

const BaseError = require('./base-error');

/**
 * Thrown when a Composition encounters invalid elements.
 *
 * @param {Error}  error   Error description
 * @param {Object} item    Invalid item
 *
 * @extends BaseError
 */

class CompositionError extends BaseError {
  constructor(message, item) {
    super(message);
    this.name = 'SequelizeCompositionError';
    this.item = item;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = CompositionError;
