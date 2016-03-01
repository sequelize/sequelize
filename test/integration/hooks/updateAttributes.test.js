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

  describe('#updateAttributes', function() {
    describe('on success', function() {
      it('should run hooks', function() {
        var beforeHook = sinon.spy()
          , afterHook = sinon.spy();

        this.User.beforeUpdate(beforeHook);
        this.User.afterUpdate(afterHook);

        return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
          return user.updateAttributes({username: 'Chong'}).then(function(user) {
            expect(beforeHook).to.have.been.calledOnce;
            expect(afterHook).to.have.been.calledOnce;
            expect(user.username).to.equal('Chong');
          });
        });
      });
    });

    describe('on error', function() {
      it('should return an error from before', function() {
        var beforeHook = sinon.spy()
          , afterHook = sinon.spy();

        this.User.beforeUpdate(function(user, options) {
          beforeHook();
          throw new Error('Whoops!');
        });
        this.User.afterUpdate(afterHook);

        return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
          return expect(user.updateAttributes({username: 'Chong'})).to.be.rejected.then(function() {
            expect(beforeHook).to.have.been.calledOnce;
            expect(afterHook).not.to.have.been.called;
          });
        });
      });

      it('should return an error from after', function() {
        var beforeHook = sinon.spy()
          , afterHook = sinon.spy();

        this.User.beforeUpdate(beforeHook);
        this.User.afterUpdate(function(user, options) {
          afterHook();
          throw new Error('Whoops!');
        });

        return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
          return expect(user.updateAttributes({username: 'Chong'})).to.be.rejected.then(function() {
            expect(beforeHook).to.have.been.calledOnce;
            expect(afterHook).to.have.been.calledOnce;
          });
        });
      });
    });

    describe('preserves changes to instance', function() {
      it('beforeValidate', function(){

        this.User.beforeValidate(function(user, options) {
          user.mood = 'happy';
        });

        return this.User.create({username: 'fireninja', mood: 'invalid'}).then(function(user) {
          return user.updateAttributes({username: 'hero'});
        }).then(function(user) {
          expect(user.username).to.equal('hero');
          expect(user.mood).to.equal('happy');
        });
      });

      it('afterValidate', function() {

        this.User.afterValidate(function(user, options) {
          user.mood = 'sad';
        });

        return this.User.create({username: 'fireninja', mood: 'nuetral'}).then(function(user) {
          return user.updateAttributes({username: 'spider'});
        }).then(function(user) {
          expect(user.username).to.equal('spider');
          expect(user.mood).to.equal('sad');
        });
      });
    });

  });

});
