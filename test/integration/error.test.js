'use strict';

/* jshint -W030 */
var chai      = require('chai')
  , sinon     = require('sinon')
  , expect    = chai.expect
  , errors    = require('../../lib/errors')
  , Support   = require(__dirname + '/support')
  , Sequelize = Support.Sequelize;

describe(Support.getTestDialectTeaser('Sequelize Errors'), function () {
  describe('API Surface', function() {

    it('Should have the Error constructors exposed', function() {
      expect(Sequelize).to.have.property('Error');
      expect(Sequelize).to.have.property('ValidationError');
      var sequelize = new Sequelize();
      expect(sequelize).to.have.property('Error');
      expect(sequelize).to.have.property('ValidationError');
    });

    it('Sequelize Errors instances should be instances of Error', function() {
      var error = new Sequelize.Error();
      var errorMessage = 'Validation Error';
      var validationError = new Sequelize.ValidationError(errorMessage, [
        new errors.ValidationErrorItem('<field name> cannot be null', 'notNull Violation', '<field name>', null)
      , new errors.ValidationErrorItem('<field name> cannot be an array or an object', 'string violation', '<field name>', null)
      ]);

      var sequelize = new Sequelize();
      var instError = new sequelize.Error();
      var instValidationError = new sequelize.ValidationError();

      expect(error).to.be.instanceOf(Sequelize.Error);
      expect(error).to.be.instanceOf(Error);
      expect(error).to.have.property('name', 'SequelizeBaseError');

      expect(validationError).to.be.instanceOf(Sequelize.ValidationError);
      expect(validationError).to.be.instanceOf(Error);
      expect(validationError).to.have.property('name', 'SequelizeValidationError');
      expect(validationError.message).to.equal(errorMessage);

      expect(instError).to.be.instanceOf(Sequelize.Error);
      expect(instError).to.be.instanceOf(Error);
      expect(instValidationError).to.be.instanceOf(Sequelize.ValidationError);
      expect(instValidationError).to.be.instanceOf(Error);
    });

    it('SequelizeValidationError should find errors by path', function() {
      var errorItems = [
        new Sequelize.ValidationErrorItem('invalid', 'type', 'first_name', null),
        new Sequelize.ValidationErrorItem('invalid', 'type', 'last_name', null)
      ];
      var validationError = new Sequelize.ValidationError('Validation error', errorItems);
      expect(validationError).to.have.property('get');
      expect(validationError.get).to.be.a('function');

      var matches = validationError.get('first_name');
      expect(matches).to.be.instanceOf(Array);
      expect(matches).to.have.lengthOf(1);
      expect(matches[0]).to.have.property('message', 'invalid');
    });

    it('SequelizeValidationError should override message property when message parameter is specified', function() {
      var errorItems = [
            new Sequelize.ValidationErrorItem('invalid', 'type', 'first_name', null)
          , new Sequelize.ValidationErrorItem('invalid', 'type', 'last_name', null)
          ]
        , customErrorMessage = 'Custom validation error message'
        , validationError = new Sequelize.ValidationError(customErrorMessage, errorItems);

      expect(validationError).to.have.property('name', 'SequelizeValidationError');
      expect(validationError.message).to.equal(customErrorMessage);
    });

    it('SequelizeValidationError should concatenate an error messages from given errors if no explicit message is defined', function() {
      var errorItems = [
            new errors.ValidationErrorItem('<field name> cannot be null', 'notNull Violation', '<field name>', null)
          , new errors.ValidationErrorItem('<field name> cannot be an array or an object', 'string violation', '<field name>', null)
          ]
        , validationError = new Sequelize.ValidationError(null, errorItems);

      expect(validationError).to.have.property('name', 'SequelizeValidationError');
      expect(validationError.message).to.match(/notNull Violation: <field name> cannot be null,\nstring violation: <field name> cannot be an array or an object/);
    });

    it('SequelizeDatabaseError should keep original message', function() {
      var orig = new Error('original database error message');
      var databaseError = new Sequelize.DatabaseError(orig);

      expect(databaseError).to.have.property('parent');
      expect(databaseError).to.have.property('original');
      expect(databaseError.name).to.equal('SequelizeDatabaseError');
      expect(databaseError.message).to.equal('original database error message');
    });

    it('ConnectionError should keep original message', function() {
      var orig = new Error('original connection error message');
      var connectionError = new Sequelize.ConnectionError(orig);

      expect(connectionError).to.have.property('parent');
      expect(connectionError).to.have.property('original');
      expect(connectionError.name).to.equal('SequelizeConnectionError');
      expect(connectionError.message).to.equal('original connection error message');
    });

    it('ConnectionRefusedError should keep original message', function() {
      var orig = new Error('original connection error message');
      var connectionError = new Sequelize.ConnectionRefusedError(orig);

      expect(connectionError).to.have.property('parent');
      expect(connectionError).to.have.property('original');
      expect(connectionError.name).to.equal('SequelizeConnectionRefusedError');
      expect(connectionError.message).to.equal('original connection error message');
    });

    it('AccessDeniedError should keep original message', function() {
      var orig = new Error('original connection error message');
      var connectionError = new Sequelize.AccessDeniedError(orig);

      expect(connectionError).to.have.property('parent');
      expect(connectionError).to.have.property('original');
      expect(connectionError.name).to.equal('SequelizeAccessDeniedError');
      expect(connectionError.message).to.equal('original connection error message');
    });

    it('HostNotFoundError should keep original message', function() {
      var orig = new Error('original connection error message');
      var connectionError = new Sequelize.HostNotFoundError(orig);

      expect(connectionError).to.have.property('parent');
      expect(connectionError).to.have.property('original');
      expect(connectionError.name).to.equal('SequelizeHostNotFoundError');
      expect(connectionError.message).to.equal('original connection error message');
    });

    it('HostNotReachableError should keep original message', function() {
      var orig = new Error('original connection error message');
      var connectionError = new Sequelize.HostNotReachableError(orig);

      expect(connectionError).to.have.property('parent');
      expect(connectionError).to.have.property('original');
      expect(connectionError.name).to.equal('SequelizeHostNotReachableError');
      expect(connectionError.message).to.equal('original connection error message');
    });

    it('InvalidConnectionError should keep original message', function() {
      var orig = new Error('original connection error message');
      var connectionError = new Sequelize.InvalidConnectionError(orig);

      expect(connectionError).to.have.property('parent');
      expect(connectionError).to.have.property('original');
      expect(connectionError.name).to.equal('SequelizeInvalidConnectionError');
      expect(connectionError.message).to.equal('original connection error message');
    });

    it('ConnectionTimedOutError should keep original message', function() {
      var orig = new Error('original connection error message');
      var connectionError = new Sequelize.ConnectionTimedOutError(orig);

      expect(connectionError).to.have.property('parent');
      expect(connectionError).to.have.property('original');
      expect(connectionError.name).to.equal('SequelizeConnectionTimedOutError');
      expect(connectionError.message).to.equal('original connection error message');
    });
  });

  describe('Constraint error', function () {
    [
      {
        type: 'UniqueConstraintError',
        exception: Sequelize.UniqueConstraintError
      },
      {
        type: 'ValidationError',
        exception: Sequelize.ValidationError
      }
    ].forEach(function(constraintTest) {

      it('Can be intercepted as ' + constraintTest.type + ' using .catch', function () {
        var spy = sinon.spy()
          , User = this.sequelize.define('user', {
            first_name: {
              type: Sequelize.STRING,
              unique: 'unique_name'
            },
            last_name: {
              type: Sequelize.STRING,
              unique: 'unique_name'
            }
          });

        var record = { first_name: 'jan', last_name: 'meier' };
        return this.sequelize.sync({ force: true }).bind(this).then(function () {
          return User.create(record);
        }).then(function () {
          return User.create(record).catch(constraintTest.exception, spy);
        }).then(function () {
          expect(spy).to.have.been.calledOnce;
        });
      });

    });

    it('Supports newlines in keys', function () {
      var spy = sinon.spy()
        , User = this.sequelize.define('user', {
            name: {
              type: Sequelize.STRING,
              unique: 'unique \n unique',
            }
          });

      return this.sequelize.sync({ force: true }).bind(this).then(function () {
        return User.create({ name: 'jan' });
      }).then(function () {
        // If the error was successfully parsed, we can catch it!
        return User.create({ name: 'jan' }).catch(this.sequelize.UniqueConstraintError, spy);
      }).then(function () {
        expect(spy).to.have.been.calledOnce;
      });
    });

    it('Works when unique keys are not defined in sequelize', function () {
      var User = this.sequelize.define('user', {
        name: {
          type: Sequelize.STRING,
          unique: 'unique \n unique',
        }
      }, { timestamps: false });

      return this.sequelize.sync({ force: true }).bind(this).then(function () {
        // Now let's pretend the index was created by someone else, and sequelize doesn't know about it
        User = this.sequelize.define('user', {
          name: Sequelize.STRING
        }, { timestamps: false });

        return User.create({ name: 'jan' });
      }).then(function () {
        // It should work even though the unique key is not defined in the model
        return expect(User.create({ name: 'jan' })).to.be.rejectedWith(this.sequelize.UniqueConstraintError);
      }).then(function () {
        // And when the model is not passed at all
        return expect(this.sequelize.query('INSERT INTO users (name) VALUES (\'jan\')')).to.be.rejectedWith(this.sequelize.UniqueConstraintError);
      });
    });

    it('adds parent and sql properties', function () {
      var User = this.sequelize.define('user', {
        name: {
          type: Sequelize.STRING,
          unique: 'unique',
        }
      }, { timestamps: false });

      return this.sequelize.sync({ force: true }).bind(this).then(function () {
        return User.create({ name: 'jan' });
      }).then(function () {
        return expect(User.create({ name: 'jan' })).to.be.rejected;
      }).then(function (error) {
        expect(error).to.be.instanceOf(this.sequelize.UniqueConstraintError);
        expect(error).to.have.property('parent');
        expect(error).to.have.property('original');
        expect(error).to.have.property('sql');
      });
    });
  });
});
