'use strict';

const BaseError = require('./base-error');

/**
 * A wrapper for multiple Errors
 *
 * @param {Error[]} [errors] Array of errors
 *
 * @property errors {Error[]}
 */
class AggregateError extends BaseError {
  constructor(errors) {
    super();
    this.errors = errors;
    this.name = 'AggregateError';
  }

  toString() {
    const message = `AggregateError of:\n${
      this.errors.map(error =>
        error === this
          ? '[Circular AggregateError]'
          : error instanceof AggregateError
            ? String(error).replace(/\n$/, '').replace(/^/mg, '  ')
            : String(error).replace(/^/mg, '    ').substring(2)
        
      ).join('\n')
    }\n`;
    return message;
  }
}

module.exports = AggregateError;
