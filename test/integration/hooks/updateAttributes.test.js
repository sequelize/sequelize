'use strict';

/* jshint -W030 */
const chai = require('chai');
const expect = chai.expect;
const Support = require('./../support');
const DataTypes = require('./../../../lib/data-types');
const sinon = require('sinon');

describe(Support.getTestDialectTeaser('Hooks'), () => {
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

  describe('#updateAttributes', () => {
    describe('on success', () => {
      it('should run hooks', function() {
        const beforeHook = sinon.spy(), afterHook = sinon.spy();

        this.User.beforeUpdate(beforeHook);
        this.User.afterUpdate(afterHook);

        return this.User.create({username: 'Toni', mood: 'happy'}).then(user => user.updateAttributes({username: 'Chong'}).then(user => {
          expect(beforeHook).to.have.been.calledOnce;
          expect(afterHook).to.have.been.calledOnce;
          expect(user.username).to.equal('Chong');
        }));
      });
    });

    describe('on error', () => {
      it('should return an error from before', function() {
        const beforeHook = sinon.spy(), afterHook = sinon.spy();

        this.User.beforeUpdate((user, options) => {
          beforeHook();
          throw new Error('Whoops!');
        });
        this.User.afterUpdate(afterHook);

        return this.User.create({username: 'Toni', mood: 'happy'}).then(user => expect(user.updateAttributes({username: 'Chong'})).to.be.rejected.then(() => {
          expect(beforeHook).to.have.been.calledOnce;
          expect(afterHook).not.to.have.been.called;
        }));
      });

      it('should return an error from after', function() {
        const beforeHook = sinon.spy(), afterHook = sinon.spy();

        this.User.beforeUpdate(beforeHook);
        this.User.afterUpdate((user, options) => {
          afterHook();
          throw new Error('Whoops!');
        });

        return this.User.create({username: 'Toni', mood: 'happy'}).then(user => expect(user.updateAttributes({username: 'Chong'})).to.be.rejected.then(() => {
          expect(beforeHook).to.have.been.calledOnce;
          expect(afterHook).to.have.been.calledOnce;
        }));
      });
    });

    describe('preserves changes to instance', () => {
      it('beforeValidate', function(){

        this.User.beforeValidate((user, options) => {
          user.mood = 'happy';
        });

        return this.User.create({username: 'fireninja', mood: 'invalid'}).then(user => user.updateAttributes({username: 'hero'})).then(user => {
          expect(user.username).to.equal('hero');
          expect(user.mood).to.equal('happy');
        });
      });

      it('afterValidate', function() {

        this.User.afterValidate((user, options) => {
          user.mood = 'sad';
        });

        return this.User.create({username: 'fireninja', mood: 'nuetral'}).then(user => user.updateAttributes({username: 'spider'})).then(user => {
          expect(user.username).to.equal('spider');
          expect(user.mood).to.equal('sad');
        });
      });
    });

  });

});
