'use strict';

const BaseError = require('./base-error');

/**
 * Scope Error. Thrown when the sequelize cannot query the specified scope.
 */
class SequelizeScopeError extends BaseError {
  constructor(parent) {
    super(parent);
    this.name = 'SequelizeScopeError';
  }
}

module.exports = SequelizeScopeError;
