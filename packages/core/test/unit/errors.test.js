'use strict';

const expect = require('chai').expect;
const errors = require('@sequelize/core/_non-semver-use-at-your-own-risk_/errors/index.js');

const { AggregateError } = errors;

describe('errors', () => {
  it('should maintain stack trace with message', () => {
    const errorsWithMessage = [
      'BaseError',
      'ValidationError',
      'InstanceError',
      'EmptyResultError',
      'EagerLoadingError',
      'AssociationError',
      'QueryError',
    ];

    for (const errorName of errorsWithMessage) {
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
      const fullErrorName = `Sequelize${errorName}`;
      expect(stackParts[0]).to.equal(`${fullErrorName}: this is a message`);
      expect(stackParts[1]).to.match(/^ {4}at throwError \(.*errors.test.js:\d+:\d+\)$/);
    }
  });

  describe('AggregateError', () => {
    it('get .message works', () => {
      expect(
        String(
          new AggregateError([
            new Error('foo'),
            new Error('bar\nbaz'),
            new AggregateError([new Error('this\nis\na\ntest'), new Error('qux')]),
          ]),
        ),
      ).to.equal(
        `AggregateError of:
  Error: foo
  Error: bar
    baz
  AggregateError of:
    Error: this
      is
      a
      test
    Error: qux
`,
      );
    });
  });
});
