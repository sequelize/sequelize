'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
  sinon = require('sinon');

describe(Support.getTestDialectTeaser('Hooks'), () => {
  beforeEach(function () {
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
      it('should run hooks', function () {
        const beforeHook = sinon.spy(),
          afterHook = sinon.spy(),
          beforeSave = sinon.spy(),
          afterSave = sinon.spy();

        this.User.beforeUpdate(beforeHook);
        this.User.afterUpdate(afterHook);
        this.User.beforeSave(beforeSave);
        this.User.afterSave(afterSave);

        return this.User.create({ username: 'Toni', mood: 'happy' }).then((user) => {
          return user.updateAttributes({ username: 'Chong' }).then((user) => {
            expect(beforeHook.calledOnce).to.be.true;
            expect(afterHook.calledOnce).to.be.true;
            expect(beforeSave.calledTwice).to.be.true;
            expect(afterSave.calledTwice).to.be.true;
            expect(user.username).to.equal('Chong');
          });
        });
      });
    });

    describe('on error', () => {
      it('should return an error from before', function () {
        const beforeHook = sinon.spy(),
          afterHook = sinon.spy(),
          beforeSave = sinon.spy(),
          afterSave = sinon.spy();

        this.User.beforeUpdate(() => {
          beforeHook();
          throw new Error('Whoops!');
        });
        this.User.afterUpdate(afterHook);
        this.User.beforeSave(beforeSave);
        this.User.afterSave(afterSave);

        return this.User.create({ username: 'Toni', mood: 'happy' }).then((user) => {
          return expect(user.updateAttributes({ username: 'Chong' })).to.be.rejected.then(() => {
            expect(beforeHook.calledOnce).to.be.true;
            expect(beforeSave.calledOnce).to.be.true;
            expect(afterHook.called, 'afterHook should not have been called').to.be.false;
            expect(afterSave.calledOnce).to.be.true;
          });
        });
      });

      it('should return an error from after', function () {
        const beforeHook = sinon.spy(),
          afterHook = sinon.spy(),
          beforeSave = sinon.spy(),
          afterSave = sinon.spy();

        this.User.beforeUpdate(beforeHook);
        this.User.afterUpdate(() => {
          afterHook();
          throw new Error('Whoops!');
        });
        this.User.beforeSave(beforeSave);
        this.User.afterSave(afterSave);

        return this.User.create({ username: 'Toni', mood: 'happy' }).then((user) => {
          return expect(user.updateAttributes({ username: 'Chong' })).to.be.rejected.then(() => {
            expect(beforeHook.calledOnce).to.be.true;
            expect(afterHook.calledOnce).to.be.true;
            expect(beforeSave.calledTwice).to.be.true;
            expect(afterSave.calledOnce).to.be.true;
          });
        });
      });
    });

    describe('preserves changes to instance', () => {
      it('beforeValidate', function () {
        this.User.beforeValidate((user) => {
          user.mood = 'happy';
        });

        return this.User.create({ username: 'fireninja', mood: 'invalid' })
          .then((user) => {
            return user.updateAttributes({ username: 'hero' });
          })
          .then((user) => {
            expect(user.username).to.equal('hero');
            expect(user.mood).to.equal('happy');
          });
      });

      it('afterValidate', function () {
        this.User.afterValidate((user) => {
          user.mood = 'sad';
        });

        return this.User.create({ username: 'fireninja', mood: 'nuetral' })
          .then((user) => {
            return user.updateAttributes({ username: 'spider' });
          })
          .then((user) => {
            expect(user.username).to.equal('spider');
            expect(user.mood).to.equal('sad');
          });
      });

      it('beforeSave', function () {
        let hookCalled = 0;

        this.User.beforeSave((user) => {
          user.mood = 'happy';
          hookCalled++;
        });

        return this.User.create({ username: 'fireninja', mood: 'nuetral' })
          .then((user) => {
            return user.updateAttributes({ username: 'spider', mood: 'sad' });
          })
          .then((user) => {
            expect(user.username).to.equal('spider');
            expect(user.mood).to.equal('happy');
            expect(hookCalled).to.equal(2);
          });
      });

      it('beforeSave with beforeUpdate', function () {
        let hookCalled = 0;

        this.User.beforeUpdate((user) => {
          user.mood = 'sad';
          hookCalled++;
        });

        this.User.beforeSave((user) => {
          user.mood = 'happy';
          hookCalled++;
        });

        return this.User.create({ username: 'akira' })
          .then((user) => {
            return user.updateAttributes({ username: 'spider', mood: 'sad' });
          })
          .then((user) => {
            expect(user.mood).to.equal('happy');
            expect(user.username).to.equal('spider');
            expect(hookCalled).to.equal(3);
          });
      });
    });
  });
});
