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

  describe('#destroy', function() {
    describe('on success', function() {
      it('should run hooks', function() {
        var beforeHook = sinon.spy()
          , afterHook = sinon.spy();

        this.User.beforeDestroy(beforeHook);
        this.User.afterDestroy(afterHook);

        return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
          return user.destroy().then(function() {
            expect(beforeHook).to.have.been.calledOnce;
            expect(afterHook).to.have.been.calledOnce;
          });
        });
      });
    });

    describe('on error', function() {
      it('should return an error from before', function() {
        var beforeHook = sinon.spy()
          , afterHook = sinon.spy();

        this.User.beforeDestroy(function(user, options) {
          beforeHook();
          throw new Error('Whoops!');
        });
        this.User.afterDestroy(afterHook);

        return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
          return expect(user.destroy()).to.be.rejected.then(function() {
            expect(beforeHook).to.have.been.calledOnce;
            expect(afterHook).not.to.have.been.called;
          });
        });
      });

      it('should return an error from after', function() {
        var beforeHook = sinon.spy()
          , afterHook = sinon.spy();

        this.User.beforeDestroy(beforeHook);
        this.User.afterDestroy(function(user, options) {
          afterHook();
          throw new Error('Whoops!');
        });

        return this.User.create({username: 'Toni', mood: 'happy'}).then(function(user) {
          return expect(user.destroy()).to.be.rejected.then(function() {
            expect(beforeHook).to.have.been.calledOnce;
            expect(afterHook).to.have.been.calledOnce;
          });
        });
      });
    });
  });

});
