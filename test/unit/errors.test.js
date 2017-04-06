'use strict';

const errors = require('../../lib/errors');
const expect = require('chai').expect;

describe('errors', () => {
  it('should maintain stack trace', () => {
    function throwError() {
      throw new errors.ValidationError('this is a message');
    }
    let err;
    try {
      throwError();
    } catch (error) {
      err = error;
    }
    expect(err).to.exist;
    const stackParts = err.stack.split('\n');
    expect(stackParts[0]).to.equal('SequelizeValidationError: this is a message');
    expect(stackParts[1]).to.match(/^    at throwError \(.*errors.test.js:\d+:\d+\)$/);
  });
});
