'use strict';

const BaseError = require('./base-error');

/**
 * Thrown when a Composition fails to be created or transformed.
 *
 * @param {Error}  error   Error description
 * @param {*}      [item]  Invalid item
 */

class CompositionError extends BaseError {
  constructor(message, item) {
    super(message);
    this.name = 'SequelizeCompositionError';
    /**
     * Invalid item
     * @type {*}
     */
    this.item = item;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = CompositionError;
