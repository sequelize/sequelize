'use strict';

const errors = require('sequelize/lib/errors');
const expect = require('chai').expect;

describe('errors', () => {
  it('should maintain stack trace with message', () => {
    const errorsWithMessage = [
      'BaseError', 'ValidationError', 'InstanceError',
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
      const fullErrorName = `Sequelize${errorName}`;
      expect(stackParts[0]).to.equal(`${fullErrorName}: this is a message`);
      expect(stackParts[1]).to.match(/^ {4}at throwError \(.*errors.test.js:\d+:\d+\)$/);
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

      const fullErrorName = `Sequelize${errorName}: `;
      expect(stackParts[0]).to.equal(fullErrorName);
      expect(stackParts[1]).to.match(/^ {4}at throwError \(.*errors.test.js:\d+:\d+\)$/);
    });
  });

  describe('AggregateError', () => {
    it('get .message works', () => {
      const { AggregateError } = errors;
      expect(String(
        new AggregateError([
          new Error('foo'),
          new Error('bar\nbaz'),
          new AggregateError([
            new Error('this\nis\na\ntest'),
            new Error('qux')
          ])
        ])
      )).to.equal(
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
`);
    });
  });

  describe('captured stack', () => {
    const capturedStack = new Error().stack;
    const parent = Object.assign(new Error('syntax error at or near ")"'), { sql: 'SELECT 1 )' });

    it('includes the driver message for database errors', () => {
      const cases = [
        [new errors.DatabaseError(parent, { stack: capturedStack }), 'SequelizeDatabaseError'],
        [new errors.TimeoutError(parent, { stack: capturedStack }), 'SequelizeTimeoutError'],
        [new errors.ForeignKeyConstraintError({ parent, stack: capturedStack }), 'SequelizeForeignKeyConstraintError'],
        [new errors.UnknownConstraintError({ parent, stack: capturedStack }), 'SequelizeUnknownConstraintError'],
        [new errors.ExclusionConstraintError({ parent, stack: capturedStack }), 'SequelizeExclusionConstraintError'],
        [new errors.UniqueConstraintError({ parent, stack: capturedStack }), 'SequelizeUniqueConstraintError']
      ];

      for (const [err, name] of cases) {
        const lines = err.stack.split('\n');
        expect(lines[0], name).to.equal(`${name}: ${err.message}`);
        if (name !== 'SequelizeUnknownConstraintError') {
          expect(lines[0]).to.contain('syntax error at or near ")"');
        }
        expect(lines[1]).to.match(/^\s+at /);
      }
    });

    it('uses only the name when the message is empty', () => {
      const emptyParent = Object.assign(new Error(''), { sql: 'SELECT 1' });
      const err = new errors.DatabaseError(emptyParent, { stack: capturedStack });
      const lines = err.stack.split('\n');
      expect(lines[0]).to.equal('SequelizeDatabaseError');
      expect(lines[1]).to.match(/^\s+at /);
    });

    it('keeps .original, .parent and .sql', () => {
      const err = new errors.DatabaseError(parent, { stack: capturedStack });
      expect(err.original).to.equal(parent);
      expect(err.parent).to.equal(parent);
      expect(err.sql).to.equal('SELECT 1 )');
    });
  });
});
