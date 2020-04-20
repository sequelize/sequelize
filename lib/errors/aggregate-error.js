'use strict';

const BaseError = require('./base-error');

let level = 0;

/**
 * Validation Error. Thrown when the sequelize validation has failed. The error contains an `errors` property,
 * which is an array with 1 or more ValidationErrorItems, one for each validation that failed.
 *
 * @param {string} message Error message
 * @param {Array} [errors] Array of ValidationErrorItem objects describing the validation errors
 *
 * @property errors {ValidationErrorItems[]}
 */
class AggregateError extends BaseError {
  constructor(message) {
    super(message);
    this.name = 'AggregateError';
    Error.captureStackTrace(this, this.constructor);
  }

  toString() {
    let indent = Array(level * 4 + 1).join(' ');
    let ret = `\n${indent}AggregateError of:\n`;
    level++;
    indent = Array(level * 4 + 1).join(' ');
    for (let i = 0; i < this.length; ++i) {
      let str = this[i] === this ? '[Circular AggregateError]' : `${this[i] }`;
      const lines = str.split('\n');
      for (let j = 0; j < lines.length; ++j) {
        lines[j] = indent + lines[j];
      }
      str = lines.join('\n');
      ret += `${str }\n`;
    }
    level--;
    return ret;
  }
}

module.exports = AggregateError;

const methods = 'join pop push shift unshift slice filter forEach some every map indexOf lastIndexOf reduce reduceRight sort reverse'.split(' ');

for (let i = 0; i < methods.length; ++i) {
  if (typeof Array.prototype[methods[i]] === 'function') {
    AggregateError.prototype[methods[i]] = Array.prototype[methods[i]];
  }
}

Object.defineProperty(AggregateError.prototype, 'length', {
  value: 0,
  configurable: false,
  writable: true,
  enumerable: true
});
