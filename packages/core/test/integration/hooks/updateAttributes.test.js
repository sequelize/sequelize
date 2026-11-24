'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../support');
const { DataTypes } = require('@sequelize/core');
const sinon = require('sinon');

describe(Support.getTestDialectTeaser('Hooks'), () => {
  beforeEach(async function () {
    this.User = this.sequelize.define('User', {
      username: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      mood: {
        type: DataTypes.ENUM(['happy', 'sad', 'neutral']),
      },
    });
    await this.sequelize.sync({ force: true });
  });

  describe('#update', () => {
    describe('on success', () => {
      it('should run hooks', async function () {
        const beforeHook = sinon.spy();
        const afterHook = sinon.spy();
        const beforeSave = sinon.spy();
        const afterSave = sinon.spy();

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
      it('should return an error from before', async function () {
        const beforeHook = sinon.spy();
        const afterHook = sinon.spy();
        const beforeSave = sinon.spy();
        const afterSave = sinon.spy();

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

      it('should return an error from after', async function () {
        const beforeHook = sinon.spy();
        const afterHook = sinon.spy();
        const beforeSave = sinon.spy();
        const afterSave = sinon.spy();

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
      it('beforeValidate', async function () {
        this.User.beforeValidate(user => {
          user.mood = 'happy';
        });

        const user0 = await this.User.create({ username: 'fireninja', mood: 'invalid' });
        const user = await user0.update({ username: 'hero' });
        expect(user.username).to.equal('hero');
        expect(user.mood).to.equal('happy');
      });

      it('persists changes made in beforeValidate', async function () {
        this.User.beforeValidate(user => {
          if (!user.isNewRecord) {
            user.mood = 'happy';
          }
        });

        const user = await this.User.create({ username: 'fireninja', mood: 'sad' });
        user.username = 'hero';
        await user.save();
        await user.reload();
        expect(user.mood).to.equal('happy');
      });

      it('increments the version when beforeValidate changes a clean instance', async function () {
        const User = this.sequelize.define(
          'VersionedUser',
          { mood: DataTypes.STRING },
          { version: true },
        );
        await User.sync({ force: true });

        User.beforeValidate(user => {
          if (!user.isNewRecord) {
            user.mood = 'happy';
          }
        });

        const user = await User.create({ mood: 'sad' });
        await user.save();
        expect(user.version).to.equal(1);
        await user.reload();
        expect(user.mood).to.equal('happy');
        expect(user.version).to.equal(1);
      });

      it('persists changes made in beforeValidate after beforeSave', async function () {
        this.User.beforeSave(user => {
          if (!user.isNewRecord) {
            user.username = 'hero';
          }
        });
        this.User.beforeValidate(user => {
          if (user.username === 'hero') {
            user.mood = 'happy';
          }
        });

        const user = await this.User.create({ username: 'fireninja', mood: 'sad' });
        await user.save();
        await user.reload();
        expect(user.username).to.equal('hero');
        expect(user.mood).to.equal('happy');
      });

      it('persists beforeValidate changes to dirty attributes excluded from update', async function () {
        this.User.beforeSave(user => {
          if (!user.isNewRecord) {
            user.username = 'hero';
          }
        });
        this.User.beforeValidate(user => {
          if (user.username === 'hero') {
            user.mood = 'happy';
          }
        });

        const user = await this.User.create({ username: 'fireninja', mood: 'sad' });
        user.mood = 'neutral';
        await user.update({ username: 'other' });
        await user.reload();
        expect(user.username).to.equal('hero');
        expect(user.mood).to.equal('happy');
      });

      it('persists nested JSON changes made in beforeValidate', async function () {
        if (!this.sequelize.dialect.supports.dataTypes.JSON) {
          this.skip();
        }

        const User = this.sequelize.define('JsonUser', {
          username: DataTypes.STRING,
          settings: DataTypes.JSON,
        });
        await User.sync({ force: true });

        User.beforeValidate(user => {
          if (!user.isNewRecord) {
            user.set('settings.status', 'happy');
          }
        });

        const user = await User.create({ username: 'fireninja', settings: { status: 'sad' } });
        user.username = 'hero';
        await user.save();
        await user.reload();
        expect(user.settings).to.deep.equal({ status: 'happy' });
      });

      describe('with scopes', () => {
        beforeEach(function () {
          this.User.beforeValidate(user => {
            if (!user.isNewRecord) {
              user.mood = 'happy';
            }
          });
        });

        it('persists changes on an instance loaded with a default scope that limits attributes', async function () {
          this.User.addScope('defaultScope', { attributes: ['id', 'mood'] }, { override: true });

          const { id } = await this.User.create({ username: 'fireninja', mood: 'sad' });
          const user = await this.User.findByPk(id);
          expect(user.get('username')).to.be.undefined;
          await user.save();

          const saved = await this.User.withoutScope().findByPk(id);
          expect(saved.mood).to.equal('happy');
          expect(saved.username).to.equal('fireninja');
        });

        it('persists changes on an instance loaded with a scope filtering rows', async function () {
          this.User.addScope('sad', { where: { mood: 'sad' } });

          const { id } = await this.User.create({ username: 'fireninja', mood: 'sad' });
          const user = await this.User.withScope('sad').findByPk(id);
          user.username = 'hero';
          await user.save();

          const saved = await this.User.withoutScope().findByPk(id);
          expect(saved.username).to.equal('hero');
          expect(saved.mood).to.equal('happy');
          expect(await this.User.withScope('sad').findByPk(id)).to.be.null;
        });

        it('persists changes on an instance loaded with a default scope that includes an association', async function () {
          const Task = this.sequelize.define('Task', { title: DataTypes.STRING });
          this.User.hasMany(Task);
          await this.sequelize.sync({ force: true });
          this.User.addScope('defaultScope', { include: [Task] }, { override: true });

          const { id } = await this.User.create({ username: 'fireninja', mood: 'sad' });
          await Task.create({ title: 'a', userId: id });
          const user = await this.User.findByPk(id);
          expect(user.tasks).to.have.length(1);
          await user.save();

          const saved = await this.User.withoutScope().findByPk(id);
          expect(saved.mood).to.equal('happy');
          expect(await Task.count({ where: { userId: id } })).to.equal(1);
        });
      });

      it('does not bump the version when beforeValidate only changes a virtual attribute', async function () {
        const User = this.sequelize.define(
          'VersionedUser',
          { mood: DataTypes.STRING, note: DataTypes.VIRTUAL },
          { version: true },
        );
        await User.sync({ force: true });

        User.beforeValidate(user => {
          if (!user.isNewRecord) {
            user.note = 'checked';
          }
        });

        const user = await User.create({ mood: 'sad' });
        await user.save();
        await user.reload();
        expect(user.version).to.equal(0);
      });

      it('afterValidate', async function () {
        this.User.afterValidate(user => {
          user.mood = 'sad';
        });

        const user0 = await this.User.create({ username: 'fireninja', mood: 'neutral' });
        const user = await user0.update({ username: 'spider' });
        expect(user.username).to.equal('spider');
        expect(user.mood).to.equal('sad');
      });

      it('beforeSave', async function () {
        let hookCalled = 0;

        this.User.beforeSave(user => {
          user.mood = 'happy';
          hookCalled++;
        });

        const user0 = await this.User.create({ username: 'fireninja', mood: 'neutral' });
        const user = await user0.update({ username: 'spider', mood: 'sad' });
        expect(user.username).to.equal('spider');
        expect(user.mood).to.equal('happy');
        expect(hookCalled).to.equal(2);
      });

      it('beforeSave with beforeUpdate', async function () {
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
