'use strict';

var chai      = require('chai')
  , sinon     = require('sinon')
  , expect    = chai.expect
  , Support   = require(__dirname + '/support')
  , Sequelize = Support.Sequelize
  , Promise   = Sequelize.Promise;

chai.config.includeStack = true;

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
      var validationError = new Sequelize.ValidationError();


      var sequelize = new Sequelize();
      var instError = new sequelize.Error();
      var instValidationError = new sequelize.ValidationError();

      expect(error).to.be.instanceOf(Sequelize.Error);
      expect(error).to.be.instanceOf(Error);
      expect(error).to.have.property('name', 'SequelizeBaseError');

      expect(validationError).to.be.instanceOf(Sequelize.ValidationError);
      expect(validationError).to.be.instanceOf(Error);
      expect(validationError).to.have.property('name', 'SequelizeValidationError');

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
  });
});
