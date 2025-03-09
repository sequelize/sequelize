import {
  AccessDeniedError,
  AggregateError,
  AssociationError,
  BaseError,
  ConnectionError,
  ConnectionRefusedError,
  ConnectionTimedOutError,
  DatabaseError,
  EagerLoadingError,
  EmptyResultError,
  HostNotFoundError,
  HostNotReachableError,
  InstanceError,
  InvalidConnectionError,
  OptimisticLockError,
  QueryError,
  Sequelize,
  ValidationError,
  ValidationErrorItem,
  ValidationErrorItemOrigin,
} from '@sequelize/core';
import type { DatabaseErrorParent } from '@sequelize/core/_non-semver-use-at-your-own-risk_/errors/database-error.js';
import { expect } from 'chai';
import { allowDeprecationsInSuite } from '../support';

describe('Sequelize Errors', () => {
  it('should maintain stack trace with message', () => {
    const errorsWithMessage = [
      BaseError,
      ValidationError,
      InstanceError,
      EmptyResultError,
      EagerLoadingError,
      AssociationError,
      QueryError,
    ];

    for (const errorName of errorsWithMessage) {
      function throwError() {
        throw new errorName('this is a message');
      }

      let err: Error;
      try {
        throwError();
      } catch (error) {
        err = error as Error;
      }

      expect(err!.stack).to.exist;
      const stackParts = err!.stack!.split('\n');
      const fullErrorName = `Sequelize${errorName.name}`;
      expect(stackParts[0]).to.equal(`${fullErrorName}: this is a message`);
      expect(stackParts[1]).to.match(/^ {4}at throwError \(.*errors.test.ts:\d+:\d+\)$/);
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

  describe('API Surface', () => {
    allowDeprecationsInSuite(['SEQUELIZE0007']);

    it('Should have the Error constructors exposed', () => {
      expect(Sequelize).to.have.property('BaseError');
      expect(Sequelize).to.have.property('ValidationError');
      expect(Sequelize).to.have.property('OptimisticLockError');
    });

    it('Sequelize Errors instances should be instances of Error', () => {
      const error = new BaseError();
      const errorMessage = 'error message';
      const validationError = new ValidationError(errorMessage, [
        new ValidationErrorItem('<field name> cannot be null', 'notNull violation', '<field name>'),
        new ValidationErrorItem(
          '<field name> cannot be an array or an object',
          'Validation error',
          '<field name>',
        ),
      ]);
      const optimisticLockError = new OptimisticLockError();

      expect(error).to.be.instanceOf(BaseError);
      expect(error).to.be.instanceOf(Error);
      expect(error).to.have.property('name', 'SequelizeBaseError');

      expect(validationError).to.be.instanceOf(ValidationError);
      expect(validationError).to.be.instanceOf(Error);
      expect(validationError).to.have.property('name', 'SequelizeValidationError');
      expect(validationError.message).to.equal(errorMessage);

      expect(optimisticLockError).to.be.instanceOf(OptimisticLockError);
      expect(optimisticLockError).to.be.instanceOf(Error);
      expect(optimisticLockError).to.have.property('name', 'SequelizeOptimisticLockError');
    });

    it('SequelizeValidationError should find errors by path', () => {
      const errorItems = [
        new ValidationErrorItem('invalid', 'Validation error', 'first_name'),
        new ValidationErrorItem('invalid', 'Validation error', 'last_name'),
      ];
      const validationError = new ValidationError('Validation error', errorItems);
      expect(validationError).to.have.property('get');
      expect(validationError.get).to.be.a('function');

      const matches = validationError.get('first_name');
      expect(matches).to.be.instanceOf(Array);
      expect(matches).to.have.lengthOf(1);
      expect(matches[0]).to.have.property('message', 'invalid');
    });

    it('SequelizeValidationError should override message property when message parameter is specified', () => {
      const errorItems = [
        new ValidationErrorItem('invalid', 'Validation error', 'first_name'),
        new ValidationErrorItem('invalid', 'Validation error', 'last_name'),
      ];
      const customErrorMessage = 'Custom validation error message';
      const validationError = new ValidationError(customErrorMessage, errorItems);

      expect(validationError).to.have.property('name', 'SequelizeValidationError');
      expect(validationError.message).to.equal(customErrorMessage);
    });

    it('SequelizeValidationError should concatenate an error messages from given errors if no explicit message is defined', () => {
      const errorItems = [
        new ValidationErrorItem('<field name> cannot be null', 'notNull violation', '<field name>'),
        new ValidationErrorItem(
          '<field name> cannot be an array or an object',
          'Validation error',
          '<field name>',
        ),
      ];
      const validationError = new ValidationError('', errorItems);

      expect(validationError).to.have.property('name', 'SequelizeValidationError');
      expect(validationError.message).to.match(
        /notNull violation: <field name> cannot be null,\nValidation error: <field name> cannot be an array or an object/,
      );
    });

    it('SequelizeValidationErrorItem does not require instance & validator constructor parameters', () => {
      const error = new ValidationErrorItem('error!', 'Validation error', 'myfield');

      expect(error).to.be.instanceOf(ValidationErrorItem);
    });

    it('SequelizeValidationErrorItem.getValidatorKey() should return a string', () => {
      const error = new ValidationErrorItem(
        'error!',
        'FUNCTION',
        'foo',
        'bar',
        undefined,
        'klen',
        'len',
        [4],
      );

      expect(error).to.have.property('getValidatorKey');
      expect(error.getValidatorKey).to.be.a('function');

      expect(error.getValidatorKey()).to.equal('function.klen');
      expect(error.getValidatorKey(false)).to.equal('klen');
      // @ts-expect-error -- should cast to boolean
      expect(error.getValidatorKey(0)).to.equal('klen');
      // @ts-expect-error -- should cast to boolean
      expect(error.getValidatorKey(1, ':')).to.equal('function:klen');
      expect(error.getValidatorKey(true, '-:-')).to.equal('function-:-klen');

      const empty = new ValidationErrorItem('error!', 'FUNCTION', 'foo', 'bar');

      expect(empty.getValidatorKey()).to.equal('');
      expect(empty.getValidatorKey(false)).to.equal('');
      // @ts-expect-error -- should cast to boolean
      expect(empty.getValidatorKey(0)).to.equal('');
      // @ts-expect-error -- should cast to boolean
      expect(empty.getValidatorKey(1, ':')).to.equal('');
      expect(empty.getValidatorKey(true, '-:-')).to.equal('');
    });

    it('SequelizeValidationErrorItem.getValidatorKey() should throw if namespace separator is invalid (only if NS is used & available)', () => {
      const error = new ValidationErrorItem(
        'error!',
        'FUNCTION',
        'foo',
        'bar',
        undefined,
        'klen',
        'len',
        [4],
      );

      // @ts-expect-error -- testing invalid input
      expect(() => error.getValidatorKey(false, {})).to.not.throw();
      // @ts-expect-error -- testing invalid input
      expect(() => error.getValidatorKey(false, [])).to.not.throw();
      // @ts-expect-error -- testing invalid input
      expect(() => error.getValidatorKey(false, null)).to.not.throw();
      // @ts-expect-error -- testing invalid input
      expect(() => error.getValidatorKey(false, '')).to.not.throw();
      // @ts-expect-error -- testing invalid input
      expect(() => error.getValidatorKey(false, false)).to.not.throw();
      // @ts-expect-error -- testing invalid input
      expect(() => error.getValidatorKey(false, true)).to.not.throw();
      expect(() => error.getValidatorKey(false)).to.not.throw();
      expect(() => error.getValidatorKey(true)).to.not.throw(); // undefined will trigger use of function parameter default

      // @ts-expect-error -- testing invalid input
      expect(() => error.getValidatorKey(true, {})).to.throw(Error);
      // @ts-expect-error -- testing invalid input
      expect(() => error.getValidatorKey(true, [])).to.throw(Error);
      // @ts-expect-error -- testing invalid input
      expect(() => error.getValidatorKey(true, null)).to.throw(Error);
      expect(() => error.getValidatorKey(true, '')).to.throw(Error);
      // @ts-expect-error -- testing invalid input
      expect(() => error.getValidatorKey(true, false)).to.throw(Error);
      // @ts-expect-error -- testing invalid input
      expect(() => error.getValidatorKey(true, true)).to.throw(Error);
    });

    it('SequelizeValidationErrorItem should map deprecated "type" values to new "origin" values', () => {
      const data: Record<string, string> = {
        'notNull violation': 'CORE',
        'unique violation': 'DB',
        'Validation error': 'FUNCTION',
      };

      for (const k of Object.keys(data)) {
        // @ts-expect-error -- testing deprecated options
        const error = new ValidationErrorItem('error!', k, 'foo', null);

        expect(error).to.have.property('origin', data[k]);
        expect(error).to.have.property('type', k);
      }
    });

    it('SequelizeValidationErrorItemOrigin is valid', () => {
      const ORIGINS = ValidationErrorItemOrigin;

      expect(ORIGINS).to.have.property('CORE', 'CORE');
      expect(ORIGINS).to.have.property('DB', 'DB');
      expect(ORIGINS).to.have.property('FUNCTION', 'FUNCTION');
    });

    it('SequelizeValidationErrorItem.Origins is valid', () => {
      const ORIGINS = ValidationErrorItem.Origins;

      expect(ORIGINS).to.have.property('CORE', 'CORE');
      expect(ORIGINS).to.have.property('DB', 'DB');
      expect(ORIGINS).to.have.property('FUNCTION', 'FUNCTION');
    });

    it('SequelizeDatabaseError should keep original message', () => {
      const orig = new Error('original database error message') as DatabaseErrorParent;
      const databaseError = new DatabaseError(orig);

      expect(databaseError).to.have.property('parent');
      expect(databaseError).to.have.property('original');
      expect(databaseError.name).to.equal('SequelizeDatabaseError');
      expect(databaseError.message).to.include('original database error message');
    });

    it('SequelizeDatabaseError should keep the original sql and the parameters', () => {
      const orig = new Error('original database error message') as DatabaseErrorParent;
      // @ts-expect-error -- this option is set by the database
      orig.sql = 'SELECT * FROM table WHERE id = $1';
      // @ts-expect-error -- this option is set by the database
      orig.parameters = ['1'];
      const databaseError = new DatabaseError(orig);

      expect(databaseError).to.have.property('sql');
      expect(databaseError).to.have.property('parameters');
      expect(databaseError.sql).to.equal(orig.sql);
      expect(databaseError.parameters).to.equal(orig.parameters);
    });

    it('ConnectionError should keep original message', () => {
      const orig = new Error('original connection error message');
      const connectionError = new ConnectionError(orig);

      expect(connectionError).to.have.property('parent');
      expect(connectionError).to.have.property('original');
      expect(connectionError.name).to.equal('SequelizeConnectionError');
      expect(connectionError.message).to.include('original connection error message');
    });

    it('ConnectionRefusedError should keep original message', () => {
      const orig = new Error('original connection error message');
      const connectionError = new ConnectionRefusedError(orig);

      expect(connectionError).to.have.property('parent');
      expect(connectionError).to.have.property('original');
      expect(connectionError.name).to.equal('SequelizeConnectionRefusedError');
      expect(connectionError.message).to.include('original connection error message');
    });

    it('AccessDeniedError should keep original message', () => {
      const orig = new Error('original connection error message');
      const connectionError = new AccessDeniedError(orig);

      expect(connectionError).to.have.property('parent');
      expect(connectionError).to.have.property('original');
      expect(connectionError.name).to.equal('SequelizeAccessDeniedError');
      expect(connectionError.message).to.include('original connection error message');
    });

    it('HostNotFoundError should keep original message', () => {
      const orig = new Error('original connection error message');
      const connectionError = new HostNotFoundError(orig);

      expect(connectionError).to.have.property('parent');
      expect(connectionError).to.have.property('original');
      expect(connectionError.name).to.equal('SequelizeHostNotFoundError');
      expect(connectionError.message).to.include('original connection error message');
    });

    it('HostNotReachableError should keep original message', () => {
      const orig = new Error('original connection error message');
      const connectionError = new HostNotReachableError(orig);

      expect(connectionError).to.have.property('parent');
      expect(connectionError).to.have.property('original');
      expect(connectionError.name).to.equal('SequelizeHostNotReachableError');
      expect(connectionError.message).to.include('original connection error message');
    });

    it('InvalidConnectionError should keep original message', () => {
      const orig = new Error('original connection error message');
      const connectionError = new InvalidConnectionError(orig);

      expect(connectionError).to.have.property('parent');
      expect(connectionError).to.have.property('original');
      expect(connectionError.name).to.equal('SequelizeInvalidConnectionError');
      expect(connectionError.message).to.include('original connection error message');
    });

    it('ConnectionTimedOutError should keep original message', () => {
      const orig = new Error('original connection error message');
      const connectionError = new ConnectionTimedOutError(orig);

      expect(connectionError).to.have.property('parent');
      expect(connectionError).to.have.property('original');
      expect(connectionError.name).to.equal('SequelizeConnectionTimedOutError');
      expect(connectionError.message).to.include('original connection error message');
    });
  });
});
