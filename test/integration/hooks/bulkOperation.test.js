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

    this.ParanoidUser = this.sequelize.define('ParanoidUser', {
      username: DataTypes.STRING,
      mood: {
        type: DataTypes.ENUM,
        values: ['happy', 'sad', 'neutral']
      }
    }, {
      paranoid: true
    });

    await this.sequelize.sync({ force: true });
  });

  describe('#bulkCreate', () => {
    describe('on success', () => {
      it('should run hooks', async function() {
        const beforeBulk = sinon.spy(),
          afterBulk = sinon.spy();

        this.User.beforeBulkCreate(beforeBulk);

        this.User.afterBulkCreate(afterBulk);

        await this.User.bulkCreate([
          { username: 'Cheech', mood: 'sad' },
          { username: 'Chong', mood: 'sad' }
        ]);

        expect(beforeBulk).to.have.been.calledOnce;
        expect(afterBulk).to.have.been.calledOnce;
      });
    });

    describe('on error', () => {
      it('should return an error from before', async function() {
        this.User.beforeBulkCreate(() => {
          throw new Error('Whoops!');
        });

        await expect(this.User.bulkCreate([
          { username: 'Cheech', mood: 'sad' },
          { username: 'Chong', mood: 'sad' }
        ])).to.be.rejected;
      });

      it('should return an error from after', async function() {
        this.User.afterBulkCreate(() => {
          throw new Error('Whoops!');
        });

        await expect(this.User.bulkCreate([
          { username: 'Cheech', mood: 'sad' },
          { username: 'Chong', mood: 'sad' }
        ])).to.be.rejected;
      });
    });

    describe('with the {individualHooks: true} option', () => {
      beforeEach(async function() {
        this.User = this.sequelize.define('User', {
          username: {
            type: DataTypes.STRING,
            defaultValue: ''
          },
          beforeHookTest: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
          },
          aNumber: {
            type: DataTypes.INTEGER,
            defaultValue: 0
          }
        });

        await this.User.sync({ force: true });
      });

      it('should run the afterCreate/beforeCreate functions for each item created successfully', async function() {
        let beforeBulkCreate = false,
          afterBulkCreate = false;

        this.User.beforeBulkCreate(async () => {
          beforeBulkCreate = true;
        });

        this.User.afterBulkCreate(async () => {
          afterBulkCreate = true;
        });

        this.User.beforeCreate(async user => {
          user.beforeHookTest = true;
        });

        this.User.afterCreate(async user => {
          user.username = `User${user.id}`;
        });

        const records = await this.User.bulkCreate([{ aNumber: 5 }, { aNumber: 7 }, { aNumber: 3 }], { fields: ['aNumber'], individualHooks: true });
        records.forEach(record => {
          expect(record.username).to.equal(`User${record.id}`);
          expect(record.beforeHookTest).to.be.true;
        });
        expect(beforeBulkCreate).to.be.true;
        expect(afterBulkCreate).to.be.true;
      });

      it('should run the afterCreate/beforeCreate functions for each item created with an error', async function() {
        let beforeBulkCreate = false,
          afterBulkCreate = false;

        this.User.beforeBulkCreate(async () => {
          beforeBulkCreate = true;
        });

        this.User.afterBulkCreate(async () => {
          afterBulkCreate = true;
        });

        this.User.beforeCreate(async () => {
          throw new Error('You shall not pass!');
        });

        this.User.afterCreate(async user => {
          user.username = `User${user.id}`;
        });

        try {
          await this.User.bulkCreate([{ aNumber: 5 }, { aNumber: 7 }, { aNumber: 3 }], { fields: ['aNumber'], individualHooks: true });
        } catch (err) {
          expect(err).to.be.instanceOf(Error);
          expect(beforeBulkCreate).to.be.true;
          expect(afterBulkCreate).to.be.false;
        }
      });
    });
  });

  describe('#bulkUpdate', () => {
    describe('on success', () => {
      it('should run hooks', async function() {
        const beforeBulk = sinon.spy(),
          afterBulk = sinon.spy();

        this.User.beforeBulkUpdate(beforeBulk);
        this.User.afterBulkUpdate(afterBulk);

        await this.User.bulkCreate([
          { username: 'Cheech', mood: 'sad' },
          { username: 'Chong', mood: 'sad' }
        ]);

        await this.User.update({ mood: 'happy' }, { where: { mood: 'sad' } });
        expect(beforeBulk).to.have.been.calledOnce;
        expect(afterBulk).to.have.been.calledOnce;
      });
    });

    describe('on error', () => {
      it('should return an error from before', async function() {
        this.User.beforeBulkUpdate(() => {
          throw new Error('Whoops!');
        });

        await this.User.bulkCreate([
          { username: 'Cheech', mood: 'sad' },
          { username: 'Chong', mood: 'sad' }
        ]);

        await expect(this.User.update({ mood: 'happy' }, { where: { mood: 'sad' } })).to.be.rejected;
      });

      it('should return an error from after', async function() {
        this.User.afterBulkUpdate(() => {
          throw new Error('Whoops!');
        });

        await this.User.bulkCreate([
          { username: 'Cheech', mood: 'sad' },
          { username: 'Chong', mood: 'sad' }
        ]);

        await expect(this.User.update({ mood: 'happy' }, { where: { mood: 'sad' } })).to.be.rejected;
      });
    });

    describe('with the {individualHooks: true} option', () => {
      beforeEach(async function() {
        this.User = this.sequelize.define('User', {
          username: {
            type: DataTypes.STRING,
            defaultValue: ''
          },
          beforeHookTest: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
          },
          aNumber: {
            type: DataTypes.INTEGER,
            defaultValue: 0
          }
        });

        await this.User.sync({ force: true });
      });

      it('should run the after/before functions for each item created successfully', async function() {
        const beforeBulk = sinon.spy(),
          afterBulk = sinon.spy();

        this.User.beforeBulkUpdate(beforeBulk);

        this.User.afterBulkUpdate(afterBulk);

        this.User.beforeUpdate(user => {
          expect(user.changed()).to.not.be.empty;
          user.beforeHookTest = true;
        });

        this.User.afterUpdate(user => {
          user.username = `User${user.id}`;
        });

        await this.User.bulkCreate([
          { aNumber: 1 }, { aNumber: 1 }, { aNumber: 1 }
        ]);

        const [, records] = await this.User.update({ aNumber: 10 }, { where: { aNumber: 1 }, individualHooks: true });
        records.forEach(record => {
          expect(record.username).to.equal(`User${record.id}`);
          expect(record.beforeHookTest).to.be.true;
        });
        expect(beforeBulk).to.have.been.calledOnce;
        expect(afterBulk).to.have.been.calledOnce;
      });

      it('should run the after/before functions for each item created successfully changing some data before updating', async function() {
        this.User.beforeUpdate(user => {
          expect(user.changed()).to.not.be.empty;
          if (user.get('id') === 1) {
            user.set('aNumber', user.get('aNumber') + 3);
          }
        });

        await this.User.bulkCreate([
          { aNumber: 1 }, { aNumber: 1 }, { aNumber: 1 }
        ]);

        const [, records] = await this.User.update({ aNumber: 10 }, { where: { aNumber: 1 }, individualHooks: true });
        records.forEach(record => {
          expect(record.aNumber).to.equal(10 + (record.id === 1 ? 3 : 0));
        });
      });

      it('should run the after/before functions for each item created with an error', async function() {
        const beforeBulk = sinon.spy(),
          afterBulk = sinon.spy();

        this.User.beforeBulkUpdate(beforeBulk);

        this.User.afterBulkUpdate(afterBulk);

        this.User.beforeUpdate(() => {
          throw new Error('You shall not pass!');
        });

        this.User.afterUpdate(user => {
          user.username = `User${user.id}`;
        });

        await this.User.bulkCreate([{ aNumber: 1 }, { aNumber: 1 }, { aNumber: 1 }], { fields: ['aNumber'] });

        try {
          await this.User.update({ aNumber: 10 }, { where: { aNumber: 1 }, individualHooks: true });
        } catch (err) {
          expect(err).to.be.instanceOf(Error);
          expect(err.message).to.be.equal('You shall not pass!');
          expect(beforeBulk).to.have.been.calledOnce;
          expect(afterBulk).not.to.have.been.called;
        }
      });
    });
  });

  describe('#bulkDestroy', () => {
    describe('on success', () => {
      it('should run hooks', async function() {
        const beforeBulk = sinon.spy(),
          afterBulk = sinon.spy();

        this.User.beforeBulkDestroy(beforeBulk);
        this.User.afterBulkDestroy(afterBulk);

        await this.User.destroy({ where: { username: 'Cheech', mood: 'sad' } });
        expect(beforeBulk).to.have.been.calledOnce;
        expect(afterBulk).to.have.been.calledOnce;
      });
    });

    describe('on error', () => {
      it('should return an error from before', async function() {
        this.User.beforeBulkDestroy(() => {
          throw new Error('Whoops!');
        });

        await expect(this.User.destroy({ where: { username: 'Cheech', mood: 'sad' } })).to.be.rejected;
      });

      it('should return an error from after', async function() {
        this.User.afterBulkDestroy(() => {
          throw new Error('Whoops!');
        });

        await expect(this.User.destroy({ where: { username: 'Cheech', mood: 'sad' } })).to.be.rejected;
      });
    });

    describe('with the {individualHooks: true} option', () => {
      beforeEach(async function() {
        this.User = this.sequelize.define('User', {
          username: {
            type: DataTypes.STRING,
            defaultValue: ''
          },
          beforeHookTest: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
          },
          aNumber: {
            type: DataTypes.INTEGER,
            defaultValue: 0
          }
        });

        await this.User.sync({ force: true });
      });

      it('should run the after/before functions for each item created successfully', async function() {
        let beforeBulk = false,
          afterBulk = false,
          beforeHook = false,
          afterHook = false;

        this.User.beforeBulkDestroy(async () => {
          beforeBulk = true;
        });

        this.User.afterBulkDestroy(async () => {
          afterBulk = true;
        });

        this.User.beforeDestroy(async () => {
          beforeHook = true;
        });

        this.User.afterDestroy(async () => {
          afterHook = true;
        });

        await this.User.bulkCreate([
          { aNumber: 1 }, { aNumber: 1 }, { aNumber: 1 }
        ]);

        await this.User.destroy({ where: { aNumber: 1 }, individualHooks: true });
        expect(beforeBulk).to.be.true;
        expect(afterBulk).to.be.true;
        expect(beforeHook).to.be.true;
        expect(afterHook).to.be.true;
      });

      it('should run the after/before functions for each item created with an error', async function() {
        let beforeBulk = false,
          afterBulk = false,
          beforeHook = false,
          afterHook = false;

        this.User.beforeBulkDestroy(async () => {
          beforeBulk = true;
        });

        this.User.afterBulkDestroy(async () => {
          afterBulk = true;
        });

        this.User.beforeDestroy(async () => {
          beforeHook = true;
          throw new Error('You shall not pass!');
        });

        this.User.afterDestroy(async () => {
          afterHook = true;
        });

        await this.User.bulkCreate([{ aNumber: 1 }, { aNumber: 1 }, { aNumber: 1 }], { fields: ['aNumber'] });

        try {
          await this.User.destroy({ where: { aNumber: 1 }, individualHooks: true });
        } catch (err) {
          expect(err).to.be.instanceOf(Error);
          expect(beforeBulk).to.be.true;
          expect(beforeHook).to.be.true;
          expect(afterBulk).to.be.false;
          expect(afterHook).to.be.false;
        }
      });
    });
  });

  describe('#bulkRestore', () => {
    beforeEach(async function() {
      await this.ParanoidUser.bulkCreate([
        { username: 'adam', mood: 'happy' },
        { username: 'joe', mood: 'sad' }
      ]);

      await this.ParanoidUser.destroy({ truncate: true });
    });

    describe('on success', () => {
      it('should run hooks', async function() {
        const beforeBulk = sinon.spy(),
          afterBulk = sinon.spy();

        this.ParanoidUser.beforeBulkRestore(beforeBulk);
        this.ParanoidUser.afterBulkRestore(afterBulk);

        await this.ParanoidUser.restore({ where: { username: 'adam', mood: 'happy' } });
        expect(beforeBulk).to.have.been.calledOnce;
        expect(afterBulk).to.have.been.calledOnce;
      });
    });

    describe('on error', () => {
      it('should return an error from before', async function() {
        this.ParanoidUser.beforeBulkRestore(() => {
          throw new Error('Whoops!');
        });

        await expect(this.ParanoidUser.restore({ where: { username: 'adam', mood: 'happy' } })).to.be.rejected;
      });

      it('should return an error from after', async function() {
        this.ParanoidUser.afterBulkRestore(() => {
          throw new Error('Whoops!');
        });

        await expect(this.ParanoidUser.restore({ where: { username: 'adam', mood: 'happy' } })).to.be.rejected;
      });
    });

    describe('with the {individualHooks: true} option', () => {
      beforeEach(async function() {
        this.ParanoidUser = this.sequelize.define('ParanoidUser', {
          aNumber: {
            type: DataTypes.INTEGER,
            defaultValue: 0
          }
        }, {
          paranoid: true
        });

        await this.ParanoidUser.sync({ force: true });
      });

      it('should run the after/before functions for each item restored successfully', async function() {
        const beforeBulk = sinon.spy(),
          afterBulk = sinon.spy(),
          beforeHook = sinon.spy(),
          afterHook = sinon.spy();

        this.ParanoidUser.beforeBulkRestore(beforeBulk);
        this.ParanoidUser.afterBulkRestore(afterBulk);
        this.ParanoidUser.beforeRestore(beforeHook);
        this.ParanoidUser.afterRestore(afterHook);

        await this.ParanoidUser.bulkCreate([
          { aNumber: 1 }, { aNumber: 1 }, { aNumber: 1 }
        ]);

        await this.ParanoidUser.destroy({ where: { aNumber: 1 } });
        await this.ParanoidUser.restore({ where: { aNumber: 1 }, individualHooks: true });
        expect(beforeBulk).to.have.been.calledOnce;
        expect(afterBulk).to.have.been.calledOnce;
        expect(beforeHook).to.have.been.calledThrice;
        expect(afterHook).to.have.been.calledThrice;
      });

      it('should run the after/before functions for each item restored with an error', async function() {
        const beforeBulk = sinon.spy(),
          afterBulk = sinon.spy(),
          beforeHook = sinon.spy(),
          afterHook = sinon.spy();

        this.ParanoidUser.beforeBulkRestore(beforeBulk);
        this.ParanoidUser.afterBulkRestore(afterBulk);
        this.ParanoidUser.beforeRestore(async () => {
          beforeHook();
          throw new Error('You shall not pass!');
        });

        this.ParanoidUser.afterRestore(afterHook);

        try {
          await this.ParanoidUser.bulkCreate([{ aNumber: 1 }, { aNumber: 1 }, { aNumber: 1 }], { fields: ['aNumber'] });
          await this.ParanoidUser.destroy({ where: { aNumber: 1 } });
          await this.ParanoidUser.restore({ where: { aNumber: 1 }, individualHooks: true });
        } catch (err) {
          expect(err).to.be.instanceOf(Error);
          expect(beforeBulk).to.have.been.calledOnce;
          expect(beforeHook).to.have.been.calledThrice;
          expect(afterBulk).not.to.have.been.called;
          expect(afterHook).not.to.have.been.called;
        }
      });
    });
  });
});
