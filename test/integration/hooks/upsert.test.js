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

  describe('#upsert', function() {
    describe('on success', function() {
      it('should run hooks', function() {
        var beforeHook = sinon.spy()
          , afterHook = sinon.spy();

        this.User.beforeUpsert(beforeHook);
        this.User.afterUpsert(afterHook);

        return this.User.upsert({username: 'Toni', mood: 'happy'}).then(function() {
          expect(beforeHook).to.have.been.calledOnce;
          expect(afterHook).to.have.been.calledOnce;
        });
      });
    });

    describe('on error', function() {
      it('should return an error from before', function() {
        var beforeHook = sinon.spy()
          , afterHook = sinon.spy();

        this.User.beforeUpsert(function(values, options) {
          beforeHook();
          throw new Error('Whoops!');
        });
        this.User.afterUpsert(afterHook);

        return expect(this.User.upsert({username: 'Toni', mood: 'happy'})).to.be.rejected.then(function(err) {
          expect(beforeHook).to.have.been.calledOnce;
          expect(afterHook).not.to.have.been.called;
        });
      });

      it('should return an error from after', function() {
        var beforeHook = sinon.spy()
          , afterHook = sinon.spy();


        this.User.beforeUpsert(beforeHook);
        this.User.afterUpsert(function(user, options) {
          afterHook();
          throw new Error('Whoops!');
        });

        return expect(this.User.upsert({username: 'Toni', mood: 'happy'})).to.be.rejected.then(function(err) {
          expect(beforeHook).to.have.been.calledOnce;
          expect(afterHook).to.have.been.calledOnce;
        });
      });
    });

    describe('preserves changes to values', function() {
      it('beforeUpsert', function(){
        var hookCalled = 0;
        var valuesOriginal = { mood: 'sad', username: 'leafninja' };

        this.User.beforeUpsert(function(values, options) {
          values.mood = 'happy';
          hookCalled++;
        });

        return this.User.upsert(valuesOriginal).then(function() {
          expect(valuesOriginal.mood).to.equal('happy');
          expect(hookCalled).to.equal(1);
        });
      });
    });
  });
});
