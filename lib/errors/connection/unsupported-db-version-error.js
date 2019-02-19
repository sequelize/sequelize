'use strict';

const ConnectionError = require('./../connection-error');

/**
 * Thrown when Sequelize connects to a database running an unsupported version
 */
class UnsupportedDBVersionError extends ConnectionError {
  constructor(parent) {
    super(parent);
    this.name = 'SequelizeUnsupportedDBVersionError';
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = UnsupportedDBVersionError;
