'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('sequelize/lib/data-types'),
  sinon = require('sinon');

describe(Support.getTestDialectTeaser('Hooks'), () => {
  beforeEach(async function() {
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
    await this.sequelize.sync({ force: true });
  });

  describe('#update', () => {
    describe('on success', () => {
      it('should run hooks', async function() {
        const beforeHook = sinon.spy(),
          afterHook = sinon.spy(),
          beforeSave = sinon.spy(),
          afterSave = sinon.spy();

        this.User.beforeUpdate(beforeHook);
        this.User.afterUpdate(afterHook);
        this.User.beforeSave(beforeSave);
        this.User.afterSave(afterSave);

        const user = await this.User.create({ username: 'Toni', mood: 'happy' });
        const user0 = await user.update({ username: 'Chong' });
        expect(beforeHook).to.have.been.calledOnce;
        expect(afterHook).to.have.been.calledOnce;
        expect(beforeSave).to.have.been.calledTwice;
        expect(afterSave).to.have.been.calledTwice;
        expect(user0.username).to.equal('Chong');
      });
    });

    describe('on error', () => {
      it('should return an error from before', async function() {
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

        const user = await this.User.create({ username: 'Toni', mood: 'happy' });
        await expect(user.update({ username: 'Chong' })).to.be.rejected;
        expect(beforeHook).to.have.been.calledOnce;
        expect(beforeSave).to.have.been.calledOnce;
        expect(afterHook).not.to.have.been.called;
        expect(afterSave).to.have.been.calledOnce;
      });

      it('should return an error from after', async function() {
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

        const user = await this.User.create({ username: 'Toni', mood: 'happy' });
        await expect(user.update({ username: 'Chong' })).to.be.rejected;
        expect(beforeHook).to.have.been.calledOnce;
        expect(afterHook).to.have.been.calledOnce;
        expect(beforeSave).to.have.been.calledTwice;
        expect(afterSave).to.have.been.calledOnce;
      });
    });

    describe('preserves changes to instance', () => {
      it('beforeValidate', async function() {
        this.User.beforeValidate(user => {
          user.mood = 'happy';
        });

        const user0 = await this.User.create({ username: 'fireninja', mood: 'invalid' });
        const user = await user0.update({ username: 'hero' });
        expect(user.username).to.equal('hero');
        expect(user.mood).to.equal('happy');
      });

      it('afterValidate', async function() {
        this.User.afterValidate(user => {
          user.mood = 'sad';
        });

        const user0 = await this.User.create({ username: 'fireninja', mood: 'nuetral' });
        const user = await user0.update({ username: 'spider' });
        expect(user.username).to.equal('spider');
        expect(user.mood).to.equal('sad');
      });

      it('beforeSave', async function() {
        let hookCalled = 0;

        this.User.beforeSave(user => {
          user.mood = 'happy';
          hookCalled++;
        });

        const user0 = await this.User.create({ username: 'fireninja', mood: 'nuetral' });
        const user = await user0.update({ username: 'spider', mood: 'sad' });
        expect(user.username).to.equal('spider');
        expect(user.mood).to.equal('happy');
        expect(hookCalled).to.equal(2);
      });

      it('beforeSave with beforeUpdate', async function() {
        let hookCalled = 0;

        this.User.beforeUpdate(user => {
          user.mood = 'sad';
          hookCalled++;
        });

        this.User.beforeSave(user => {
          user.mood = 'happy';
          hookCalled++;
        });

        const user0 = await this.User.create({ username: 'akira' });
        const user = await user0.update({ username: 'spider', mood: 'sad' });
        expect(user.mood).to.equal('happy');
        expect(user.username).to.equal('spider');
        expect(hookCalled).to.equal(3);
      });
    });
  });
});
