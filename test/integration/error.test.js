'use strict';

const chai      = require('chai'),
  sinon     = require('sinon'),
  expect    = chai.expect,
  errors    = require('../../lib/errors'),
  Support   = require(__dirname + '/support'),
  Sequelize = Support.Sequelize;

describe(Support.getTestDialectTeaser('Sequelize Errors'), () => {
  describe('API Surface', () => {

    it('Should have the Error constructors exposed', () => {
      expect(Sequelize).to.have.property('Error');
      expect(Sequelize).to.have.property('ValidationError');
      expect(Sequelize).to.have.property('OptimisticLockError');
      const sequelize = new Sequelize('mysql://user:pass@example.com:9821/dbname');
      expect(sequelize).to.have.property('Error');
      expect(sequelize).to.have.property('ValidationError');
      expect(sequelize).to.have.property('OptimisticLockError');
    });

    it('Sequelize Errors instances should be instances of Error', () => {
      const error = new Sequelize.Error();
      const errorMessage = 'error message';
      const validationError = new Sequelize.ValidationError(errorMessage, [
        new errors.ValidationErrorItem('<field name> cannot be null', 'notNull Violation', '<field name>', null),
        new errors.ValidationErrorItem('<field name> cannot be an array or an object', 'string violation', '<field name>', null)
      ]);
      const optimisticLockError = new Sequelize.OptimisticLockError();

      const sequelize = new Sequelize('mysql://user:pass@example.com:9821/dbname');
      const instError = new sequelize.Error();
      const instValidationError = new sequelize.ValidationError();
      const instOptimisticLockError = new sequelize.OptimisticLockError();

      expect(error).to.be.instanceOf(Sequelize.Error);
      expect(error).to.be.instanceOf(Error);
      expect(error).to.have.property('name', 'SequelizeBaseError');

      expect(validationError).to.be.instanceOf(Sequelize.ValidationError);
      expect(validationError).to.be.instanceOf(Error);
      expect(validationError).to.have.property('name', 'SequelizeValidationError');
      expect(validationError.message).to.equal(errorMessage);

      expect(optimisticLockError).to.be.instanceOf(Sequelize.OptimisticLockError);
      expect(optimisticLockError).to.be.instanceOf(Error);
      expect(optimisticLockError).to.have.property('name', 'SequelizeOptimisticLockError');

      expect(instError).to.be.instanceOf(Sequelize.Error);
      expect(instError).to.be.instanceOf(Error);
      expect(instValidationError).to.be.instanceOf(Sequelize.ValidationError);
      expect(instValidationError).to.be.instanceOf(Error);
      expect(instOptimisticLockError).to.be.instanceOf(Sequelize.OptimisticLockError);
      expect(instOptimisticLockError).to.be.instanceOf(Error);
    });

    it('SequelizeValidationError should find errors by path', () => {
      const errorItems = [
        new Sequelize.ValidationErrorItem('invalid', 'type', 'first_name', null),
        new Sequelize.ValidationErrorItem('invalid', 'type', 'last_name', null)
      ];
      const validationError = new Sequelize.ValidationError('Validation error', errorItems);
      expect(validationError).to.have.property('get');
      expect(validationError.get).to.be.a('function');

      const matches = validationError.get('first_name');
      expect(matches).to.be.instanceOf(Array);
      expect(matches).to.have.lengthOf(1);
      expect(matches[0]).to.have.property('message', 'invalid');
    });

    it('SequelizeValidationError should override message property when message parameter is specified', () => {
      const errorItems = [
          new Sequelize.ValidationErrorItem('invalid', 'type', 'first_name', null),
          new Sequelize.ValidationErrorItem('invalid', 'type', 'last_name', null)
        ],
        customErrorMessage = 'Custom validation error message',
        validationError = new Sequelize.ValidationError(customErrorMessage, errorItems);

      expect(validationError).to.have.property('name', 'SequelizeValidationError');
      expect(validationError.message).to.equal(customErrorMessage);
    });

    it('SequelizeValidationError should concatenate an error messages from given errors if no explicit message is defined', () => {
      const errorItems = [
          new Sequelize.ValidationErrorItem('<field name> cannot be null', 'notNull Violation', '<field name>', null),
          new Sequelize.ValidationErrorItem('<field name> cannot be an array or an object', 'string violation', '<field name>', null)
        ],
        validationError = new Sequelize.ValidationError(null, errorItems);

      expect(validationError).to.have.property('name', 'SequelizeValidationError');
      expect(validationError.message).to.match(/notNull Violation: <field name> cannot be null,\nstring violation: <field name> cannot be an array or an object/);
    });

    it('SequelizeValidationErrorItem does not require instance & validator constructor parameters', () => {
      const error = new Sequelize.ValidationErrorItem('error!', null, 'myfield');

      expect(error).to.be.instanceOf(Sequelize.ValidationErrorItem);
    });

    it('SequelizeValidationErrorItem should have instance, key & validator properties when given to constructor', () => {
      const inst  = { foo: 'bar' };
      const vargs = [4];

      const error = new Sequelize.ValidationErrorItem('error!', 'FUNCTION', 'foo', 'bar', inst, 'klen', 'len', vargs);

      expect(error).to.have.property('instance');
      expect(error.instance).to.equal(inst);

      expect(error).to.have.property('validatorKey',  'klen');
      expect(error).to.have.property('validatorName', 'len');
      expect(error).to.have.property('validatorArgs', vargs);
    });

    it('SequelizeValidationErrorItem.getValidatorKey() should return a string', () => {
      const error = new Sequelize.ValidationErrorItem('error!', 'FUNCTION', 'foo', 'bar', null, 'klen', 'len', [4]);

      expect(error).to.have.property('getValidatorKey');
      expect(error.getValidatorKey).to.be.a('function');

      expect(error.getValidatorKey()).to.equal('function.klen');
      expect(error.getValidatorKey(false)).to.equal('klen');
      expect(error.getValidatorKey(0)).to.equal('klen');
      expect(error.getValidatorKey(1, ':')).to.equal('function:klen');
      expect(error.getValidatorKey(true, '-:-')).to.equal('function-:-klen');

      const empty = new Sequelize.ValidationErrorItem('error!', 'FUNCTION', 'foo', 'bar');

      expect(empty.getValidatorKey()).to.equal('');
      expect(empty.getValidatorKey(false)).to.equal('');
      expect(empty.getValidatorKey(0)).to.equal('');
      expect(empty.getValidatorKey(1, ':')).to.equal('');
      expect(empty.getValidatorKey(true, '-:-')).to.equal('');
    });

    it('SequelizeValidationErrorItem.getValidatorKey() should throw if namespace separator is invalid (only if NS is used & available)', () => {
      const error = new Sequelize.ValidationErrorItem('error!', 'FUNCTION', 'foo', 'bar', null, 'klen', 'len', [4]);

      expect(() => error.getValidatorKey(false, {})).to.not.throw();
      expect(() => error.getValidatorKey(false, [])).to.not.throw();
      expect(() => error.getValidatorKey(false, null)).to.not.throw();
      expect(() => error.getValidatorKey(false, '')).to.not.throw();
      expect(() => error.getValidatorKey(false, false)).to.not.throw();
      expect(() => error.getValidatorKey(false, true)).to.not.throw();
      expect(() => error.getValidatorKey(false, undefined)).to.not.throw();
      expect(() => error.getValidatorKey(true, undefined)).to.not.throw(); // undefined will trigger use of function parameter default

      expect(() => error.getValidatorKey(true, {})).to.throw(Error);
      expect(() => error.getValidatorKey(true, [])).to.throw(Error);
      expect(() => error.getValidatorKey(true, null)).to.throw(Error);
      expect(() => error.getValidatorKey(true, '')).to.throw(Error);
      expect(() => error.getValidatorKey(true, false)).to.throw(Error);
      expect(() => error.getValidatorKey(true, true)).to.throw(Error);
    });

    it('SequelizeValidationErrorItem should map deprecated "type" values to new "origin" values', () => {
      const data  = {
        'notNull Violation': 'CORE',
        'string violation': 'CORE',
        'unique violation': 'DB',
        'Validation error': 'FUNCTION'
      };

      Object.keys(data).forEach(k => {
        const error = new Sequelize.ValidationErrorItem('error!', k, 'foo', null);

        expect(error).to.have.property('origin', data[k]);
        expect(error).to.have.property('type', k);
      });
    });

    it('SequelizeValidationErrorItem.Origins is valid', () => {
      const ORIGINS = errors.ValidationErrorItem.Origins;

      expect(ORIGINS).to.have.property('CORE', 'CORE');
      expect(ORIGINS).to.have.property('DB', 'DB');
      expect(ORIGINS).to.have.property('FUNCTION', 'FUNCTION');

    });

    it('SequelizeDatabaseError should keep original message', () => {
      const orig = new Error('original database error message');
      const databaseError = new Sequelize.DatabaseError(orig);

      expect(databaseError).to.have.property('parent');
      expect(databaseError).to.have.property('original');
      expect(databaseError.name).to.equal('SequelizeDatabaseError');
      expect(databaseError.message).to.equal('original database error message');
    });

    it('ConnectionError should keep original message', () => {
      const orig = new Error('original connection error message');
      const connectionError = new Sequelize.ConnectionError(orig);

      expect(connectionError).to.have.property('parent');
      expect(connectionError).to.have.property('original');
      expect(connectionError.name).to.equal('SequelizeConnectionError');
      expect(connectionError.message).to.equal('original connection error message');
    });

    it('ConnectionRefusedError should keep original message', () => {
      const orig = new Error('original connection error message');
      const connectionError = new Sequelize.ConnectionRefusedError(orig);

      expect(connectionError).to.have.property('parent');
      expect(connectionError).to.have.property('original');
      expect(connectionError.name).to.equal('SequelizeConnectionRefusedError');
      expect(connectionError.message).to.equal('original connection error message');
    });

    it('AccessDeniedError should keep original message', () => {
      const orig = new Error('original connection error message');
      const connectionError = new Sequelize.AccessDeniedError(orig);

      expect(connectionError).to.have.property('parent');
      expect(connectionError).to.have.property('original');
      expect(connectionError.name).to.equal('SequelizeAccessDeniedError');
      expect(connectionError.message).to.equal('original connection error message');
    });

    it('HostNotFoundError should keep original message', () => {
      const orig = new Error('original connection error message');
      const connectionError = new Sequelize.HostNotFoundError(orig);

      expect(connectionError).to.have.property('parent');
      expect(connectionError).to.have.property('original');
      expect(connectionError.name).to.equal('SequelizeHostNotFoundError');
      expect(connectionError.message).to.equal('original connection error message');
    });

    it('HostNotReachableError should keep original message', () => {
      const orig = new Error('original connection error message');
      const connectionError = new Sequelize.HostNotReachableError(orig);

      expect(connectionError).to.have.property('parent');
      expect(connectionError).to.have.property('original');
      expect(connectionError.name).to.equal('SequelizeHostNotReachableError');
      expect(connectionError.message).to.equal('original connection error message');
    });

    it('InvalidConnectionError should keep original message', () => {
      const orig = new Error('original connection error message');
      const connectionError = new Sequelize.InvalidConnectionError(orig);

      expect(connectionError).to.have.property('parent');
      expect(connectionError).to.have.property('original');
      expect(connectionError.name).to.equal('SequelizeInvalidConnectionError');
      expect(connectionError.message).to.equal('original connection error message');
    });

    it('ConnectionTimedOutError should keep original message', () => {
      const orig = new Error('original connection error message');
      const connectionError = new Sequelize.ConnectionTimedOutError(orig);

      expect(connectionError).to.have.property('parent');
      expect(connectionError).to.have.property('original');
      expect(connectionError.name).to.equal('SequelizeConnectionTimedOutError');
      expect(connectionError.message).to.equal('original connection error message');
    });
  });

  describe('Constraint error', () => {
    [
      {
        type: 'UniqueConstraintError',
        exception: Sequelize.UniqueConstraintError
      },
      {
        type: 'ValidationError',
        exception: Sequelize.ValidationError
      }
    ].forEach(constraintTest => {

      it('Can be intercepted as ' + constraintTest.type + ' using .catch', function() {
        const spy = sinon.spy(),
          User = this.sequelize.define('user', {
            first_name: {
              type: Sequelize.STRING,
              unique: 'unique_name'
            },
            last_name: {
              type: Sequelize.STRING,
              unique: 'unique_name'
            }
          });

        const record = { first_name: 'jan', last_name: 'meier' };
        return this.sequelize.sync({ force: true }).bind(this).then(() => {
          return User.create(record);
        }).then(() => {
          return User.create(record).catch(constraintTest.exception, spy);
        }).then(() => {
          expect(spy).to.have.been.calledOnce;
        });
      });

    });

    it('Supports newlines in keys', function() {
      const spy = sinon.spy(),
        User = this.sequelize.define('user', {
          name: {
            type: Sequelize.STRING,
            unique: 'unique \n unique'
          }
        });

      return this.sequelize.sync({ force: true }).bind(this).then(() => {
        return User.create({ name: 'jan' });
      }).then(function() {
        // If the error was successfully parsed, we can catch it!
        return User.create({ name: 'jan' }).catch(this.sequelize.UniqueConstraintError, spy);
      }).then(() => {
        expect(spy).to.have.been.calledOnce;
      });
    });

    it('Works when unique keys are not defined in sequelize', function() {
      let User = this.sequelize.define('user', {
        name: {
          type: Sequelize.STRING,
          unique: 'unique \n unique'
        }
      }, { timestamps: false });

      return this.sequelize.sync({ force: true }).bind(this).then(function() {
        // Now let's pretend the index was created by someone else, and sequelize doesn't know about it
        User = this.sequelize.define('user', {
          name: Sequelize.STRING
        }, { timestamps: false });

        return User.create({ name: 'jan' });
      }).then(function() {
        // It should work even though the unique key is not defined in the model
        return expect(User.create({ name: 'jan' })).to.be.rejectedWith(this.sequelize.UniqueConstraintError);
      }).then(function() {
        // And when the model is not passed at all
        return expect(this.sequelize.query('INSERT INTO users (name) VALUES (\'jan\')')).to.be.rejectedWith(this.sequelize.UniqueConstraintError);
      });
    });

    it('adds parent and sql properties', function() {
      const User = this.sequelize.define('user', {
        name: {
          type: Sequelize.STRING,
          unique: 'unique'
        }
      }, { timestamps: false });

      return this.sequelize.sync({ force: true }).bind(this).then(() => {
        return User.create({ name: 'jan' });
      }).then(() => {
        return expect(User.create({ name: 'jan' })).to.be.rejected;
      }).then(function(error) {
        expect(error).to.be.instanceOf(this.sequelize.UniqueConstraintError);
        expect(error).to.have.property('parent');
        expect(error).to.have.property('original');
        expect(error).to.have.property('sql');
      });
    });
  });
});
