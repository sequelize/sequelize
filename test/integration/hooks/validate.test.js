'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , sinon = require('sinon');

describe(Support.getTestDialectTeaser('Hooks'), function() {
  beforeEach(function() {
    this.User = this.sequelize.define('User', {
      username: {
        type: DataTypes.STRING,
        allowNull: false
      },
      mood: {
        type: DataTypes.ENUM,
        values: ['happy', 'sad', 'neutral']
      }
    });
    return this.sequelize.sync({ force: true });
  });

  describe('#validate', function() {
    describe('#create', function() {
      it('should return the user', function() {
        this.User.beforeValidate(function(user, options) {
          user.username = 'Bob';
          user.mood = 'happy';
        });

        this.User.afterValidate(function(user, options) {
          user.username = 'Toni';
        });

        return this.User.create({mood: 'ecstatic'}).then(function(user) {
          expect(user.mood).to.equal('happy');
          expect(user.username).to.equal('Toni');
        });
      });
    });

    describe('on error', function() {
      it('should emit an error from after hook', function() {
        this.User.afterValidate(function(user, options) {
          user.mood = 'ecstatic';
          throw new Error('Whoops! Changed user.mood!');
        });

        return expect(this.User.create({username: 'Toni', mood: 'happy'})).to.be.rejectedWith('Whoops! Changed user.mood!');
      });

      it('should call validationFailed hook', function() {
        var validationFailedHook = sinon.spy();

        this.User.validationFailed(validationFailedHook);

        return expect(this.User.create({mood: 'happy'})).to.be.rejected.then(function(err) {
          expect(validationFailedHook).to.have.been.calledOnce;
        });
      });

      it('should not replace the validation error in validationFailed hook by default', function() {
        var validationFailedHook = sinon.stub();

        this.User.validationFailed(validationFailedHook);

        return expect(this.User.create({mood: 'happy'})).to.be.rejected.then(function(err) {
          expect(err.name).to.equal('SequelizeValidationError');
        });
      });

      it('should replace the validation error if validationFailed hook creates a new error', function() {
        var validationFailedHook = sinon.stub().throws(new Error('Whoops!'));

        this.User.validationFailed(validationFailedHook);

        return expect(this.User.create({mood: 'happy'})).to.be.rejected.then(function(err) {
          expect(err.message).to.equal('Whoops!');
        });
      });
    });
  });

});
