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

    describe('#3534, hooks modifications', function() {
      it('fields modified in hooks are saved', function() {
        var self = this;

        this.User.afterValidate(function(user, options) {
          //if username is defined and has more than 5 char
          user.username = user.username
                          ? (user.username.length < 5 ? null : user.username)
                          : null;
          user.username = user.username || 'Samorost 3';

        });

        this.User.beforeValidate(function(user, options) {
          user.mood = user.mood || 'neutral';
        });


        return this.User.create({username: 'T', mood: 'neutral'}).then(function(user) {
          expect(user.mood).to.equal('neutral');
          expect(user.username).to.equal('Samorost 3');

          //change attributes
          user.mood = 'sad';
          user.username = 'Samorost Good One';

          return user.save();
        }).then(function(uSaved) {
          expect(uSaved.mood).to.equal('sad');
          expect(uSaved.username).to.equal('Samorost Good One');

          //change attributes, expect to be replaced by hooks
          uSaved.username = 'One';

          return uSaved.save();
        }).then(function(uSaved) {
          //attributes were replaced by hooks ?
          expect(uSaved.mood).to.equal('sad');
          expect(uSaved.username).to.equal('Samorost 3');
          return self.User.findById(uSaved.id);
        }).then(function(uFetched) {
          expect(uFetched.mood).to.equal('sad');
          expect(uFetched.username).to.equal('Samorost 3');

          uFetched.mood = null;
          uFetched.username = 'New Game is Needed';

          return uFetched.save();
        }).then(function(uFetchedSaved) {
          expect(uFetchedSaved.mood).to.equal('neutral');
          expect(uFetchedSaved.username).to.equal('New Game is Needed');

          return self.User.findById(uFetchedSaved.id);
        }).then(function(uFetched) {
          expect(uFetched.mood).to.equal('neutral');
          expect(uFetched.username).to.equal('New Game is Needed');

          //expect to be replaced by hooks
          uFetched.username = 'New';
          uFetched.mood = 'happy';
          return uFetched.save();
        }).then(function(uFetchedSaved) {
          expect(uFetchedSaved.mood).to.equal('happy');
          expect(uFetchedSaved.username).to.equal('Samorost 3');
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
