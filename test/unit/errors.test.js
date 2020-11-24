'use strict';

const errors = require('../../lib/errors');
const expect = require('chai').expect;

describe('errors', () => {
  it('should maintain stack trace with message', () => {
    const errorsWithMessage = [
      'BaseError', 'ValidationError', 'UnknownConstraintError', 'InstanceError', 
      'EmptyResultError', 'EagerLoadingError', 'AssociationError', 'QueryError'
    ];

    errorsWithMessage.forEach(errorName => {
      function throwError() {
        throw new errors[errorName]('this is a message');
      }
      let err;
      try {
        throwError();
      } catch (error) {
        err = error;
      }
      expect(err).to.exist;
      const stackParts = err.stack.split('\n');
      const fullErrorName = 'Sequelize' + errorName;
      expect(stackParts[0]).to.equal(fullErrorName + ': this is a message');
      expect(stackParts[1]).to.match(/^    at throwError \(.*errors.test.js:\d+:\d+\)$/);
    });    
  });

  it('should maintain stack trace without message', () => {
    const errorsWithoutMessage = [
      'ConnectionError', 'ConnectionRefusedError', 'ConnectionTimedOutError',
      'AccessDeniedError', 'HostNotFoundError', 'HostNotReachableError', 'InvalidConnectionError'
    ];

    errorsWithoutMessage.forEach(errorName => {
      function throwError() {
        throw new errors[errorName](null);
      }
      let err;
      try {
        throwError();
      } catch (error) {
        err = error;
      }
      expect(err).to.exist;
      const stackParts = err.stack.split('\n');

      const fullErrorName = 'Sequelize' + errorName;
      expect(stackParts[0]).to.equal(fullErrorName);
      expect(stackParts[1]).to.match(/^    at throwError \(.*errors.test.js:\d+:\d+\)$/);
    });
  });
});
