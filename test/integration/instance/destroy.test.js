'use strict';

const chai = require('chai'),
  expect = chai.expect,
  sinon = require('sinon'),
  moment = require('moment'),
  Support = require('../support'),
  dialect = Support.getTestDialect(),
  current = Support.sequelize;

describe(Support.getTestDialectTeaser('Instance'), () => {
  describe('destroy', () => {
    if (current.dialect.supports.transactions) {
      it('supports transactions', async function() {
        const sequelize = await Support.prepareTransactionTest(this.sequelize);
        const User = sequelize.define('User', { username: Support.Sequelize.STRING });

        await User.sync({ force: true });
        const user = await User.create({ username: 'foo' });
        const t = await sequelize.transaction();
        await user.destroy({ transaction: t });
        const count1 = await User.count();
        const count2 = await User.count({ transaction: t });
        expect(count1).to.equal(1);
        expect(count2).to.equal(0);
        await t.rollback();
      });
    }

    it('does not set the deletedAt date in subsequent destroys if dao is paranoid', async function() {
      const UserDestroy = this.sequelize.define('UserDestroy', {
        name: Support.Sequelize.STRING,
        bio: Support.Sequelize.TEXT
      }, { paranoid: true });

      await UserDestroy.sync({ force: true });
      const user = await UserDestroy.create({ name: 'hallo', bio: 'welt' });
      await user.destroy();
      await user.reload({ paranoid: false });
      const deletedAt = user.deletedAt;

      await user.destroy();
      await user.reload({ paranoid: false });
      expect(user.deletedAt).to.eql(deletedAt);
    });

    it('does not update deletedAt with custom default in subsequent destroys', async function() {
      const ParanoidUser = this.sequelize.define('ParanoidUser', {
        username: Support.Sequelize.STRING,
        deletedAt: { type: Support.Sequelize.DATE, defaultValue: new Date(0) }
      }, { paranoid: true });

      await ParanoidUser.sync({ force: true });

      const user1 = await ParanoidUser.create({
        username: 'username'
      });

      const user0 = await user1.destroy();
      const deletedAt = user0.deletedAt;
      expect(deletedAt).to.be.ok;
      expect(deletedAt.getTime()).to.be.ok;

      const user = await user0.destroy();
      expect(user).to.be.ok;
      expect(user.deletedAt).to.be.ok;
      expect(user.deletedAt.toISOString()).to.equal(deletedAt.toISOString());
    });

    it('deletes a record from the database if dao is not paranoid', async function() {
      const UserDestroy = this.sequelize.define('UserDestroy', {
        name: Support.Sequelize.STRING,
        bio: Support.Sequelize.TEXT
      });

      await UserDestroy.sync({ force: true });
      const u = await UserDestroy.create({ name: 'hallo', bio: 'welt' });
      const users = await UserDestroy.findAll();
      expect(users.length).to.equal(1);
      await u.destroy();
      const users0 = await UserDestroy.findAll();
      expect(users0.length).to.equal(0);
    });

    it('allows updating soft deleted instance', async function() {
      const ParanoidUser = this.sequelize.define('ParanoidUser', {
        username: Support.Sequelize.STRING
      }, { paranoid: true });

      await ParanoidUser.sync({ force: true });

      const user2 = await ParanoidUser.create({
        username: 'username'
      });

      const user1 = await user2.destroy();
      expect(user1.deletedAt).to.be.ok;
      const deletedAt = user1.deletedAt;
      user1.username = 'foo';
      const user0 = await user1.save();
      expect(user0.username).to.equal('foo');
      expect(user0.deletedAt).to.equal(deletedAt, 'should not update deletedAt');

      const user = await ParanoidUser.findOne({
        paranoid: false,
        where: {
          username: 'foo'
        }
      });

      expect(user).to.be.ok;
      expect(user.deletedAt).to.be.ok;
    });

    it('supports custom deletedAt field', async function() {
      const ParanoidUser = this.sequelize.define('ParanoidUser', {
        username: Support.Sequelize.STRING,
        destroyTime: Support.Sequelize.DATE
      }, { paranoid: true, deletedAt: 'destroyTime' });

      await ParanoidUser.sync({ force: true });

      const user1 = await ParanoidUser.create({
        username: 'username'
      });

      const user0 = await user1.destroy();
      expect(user0.destroyTime).to.be.ok;
      expect(user0.deletedAt).to.not.be.ok;

      const user = await ParanoidUser.findOne({
        paranoid: false,
        where: {
          username: 'username'
        }
      });

      expect(user).to.be.ok;
      expect(user.destroyTime).to.be.ok;
      expect(user.deletedAt).to.not.be.ok;
    });

    it('supports custom deletedAt database column', async function() {
      const ParanoidUser = this.sequelize.define('ParanoidUser', {
        username: Support.Sequelize.STRING,
        deletedAt: { type: Support.Sequelize.DATE, field: 'deleted_at' }
      }, { paranoid: true });

      await ParanoidUser.sync({ force: true });

      const user1 = await ParanoidUser.create({
        username: 'username'
      });

      const user0 = await user1.destroy();
      expect(user0.dataValues.deletedAt).to.be.ok;
      expect(user0.dataValues.deleted_at).to.not.be.ok;

      const user = await ParanoidUser.findOne({
        paranoid: false,
        where: {
          username: 'username'
        }
      });

      expect(user).to.be.ok;
      expect(user.deletedAt).to.be.ok;
      expect(user.deleted_at).to.not.be.ok;
    });

    it('supports custom deletedAt field and database column', async function() {
      const ParanoidUser = this.sequelize.define('ParanoidUser', {
        username: Support.Sequelize.STRING,
        destroyTime: { type: Support.Sequelize.DATE, field: 'destroy_time' }
      }, { paranoid: true, deletedAt: 'destroyTime' });

      await ParanoidUser.sync({ force: true });

      const user1 = await ParanoidUser.create({
        username: 'username'
      });

      const user0 = await user1.destroy();
      expect(user0.dataValues.destroyTime).to.be.ok;
      expect(user0.dataValues.destroy_time).to.not.be.ok;

      const user = await ParanoidUser.findOne({
        paranoid: false,
        where: {
          username: 'username'
        }
      });

      expect(user).to.be.ok;
      expect(user.destroyTime).to.be.ok;
      expect(user.destroy_time).to.not.be.ok;
    });

    it('persists other model changes when soft deleting', async function() {
      const ParanoidUser = this.sequelize.define('ParanoidUser', {
        username: Support.Sequelize.STRING
      }, { paranoid: true });

      await ParanoidUser.sync({ force: true });

      const user4 = await ParanoidUser.create({
        username: 'username'
      });

      user4.username = 'foo';
      const user3 = await user4.destroy();
      expect(user3.username).to.equal('foo');
      expect(user3.deletedAt).to.be.ok;
      const deletedAt = user3.deletedAt;

      const user2 = await ParanoidUser.findOne({
        paranoid: false,
        where: {
          username: 'foo'
        }
      });

      expect(user2).to.be.ok;
      expect(moment.utc(user2.deletedAt).startOf('second').toISOString())
        .to.equal(moment.utc(deletedAt).startOf('second').toISOString());
      expect(user2.username).to.equal('foo');
      const user1 = user2;
      // update model and delete again
      user1.username = 'bar';
      const user0 = await user1.destroy();
      expect(moment.utc(user0.deletedAt).startOf('second').toISOString())
        .to.equal(moment.utc(deletedAt).startOf('second').toISOString(),
          'should not updated deletedAt when destroying multiple times');

      const user = await ParanoidUser.findOne({
        paranoid: false,
        where: {
          username: 'bar'
        }
      });

      expect(user).to.be.ok;
      expect(moment.utc(user.deletedAt).startOf('second').toISOString())
        .to.equal(moment.utc(deletedAt).startOf('second').toISOString());
      expect(user.username).to.equal('bar');
    });

    it('allows sql logging of delete statements', async function() {
      const UserDelete = this.sequelize.define('UserDelete', {
        name: Support.Sequelize.STRING,
        bio: Support.Sequelize.TEXT
      });

      const logging = sinon.spy();

      await UserDelete.sync({ force: true });
      const u = await UserDelete.create({ name: 'hallo', bio: 'welt' });
      const users = await UserDelete.findAll();
      expect(users.length).to.equal(1);
      await u.destroy({ logging });
      expect(logging.callCount).to.equal(1, 'should call logging');
      const sql = logging.firstCall.args[0];
      expect(sql).to.exist;
      expect(sql.toUpperCase()).to.include('DELETE');
    });

    it('allows sql logging of update statements', async function() {
      const UserDelete = this.sequelize.define('UserDelete', {
        name: Support.Sequelize.STRING,
        bio: Support.Sequelize.TEXT
      }, { paranoid: true });

      const logging = sinon.spy();

      await UserDelete.sync({ force: true });
      const u = await UserDelete.create({ name: 'hallo', bio: 'welt' });
      const users = await UserDelete.findAll();
      expect(users.length).to.equal(1);
      await u.destroy({ logging });
      expect(logging.callCount).to.equal(1, 'should call logging');
      const sql = logging.firstCall.args[0];
      expect(sql).to.exist;
      expect(sql.toUpperCase()).to.include('UPDATE');
    });

    it('should not call save hooks when soft deleting', async function() {
      const beforeSave = sinon.spy();
      const afterSave = sinon.spy();

      const ParanoidUser = this.sequelize.define('ParanoidUser', {
        username: Support.Sequelize.STRING
      }, {
        paranoid: true,
        hooks: {
          beforeSave,
          afterSave
        }
      });

      await ParanoidUser.sync({ force: true });

      const user0 = await ParanoidUser.create({
        username: 'username'
      });

      // clear out calls from .create
      beforeSave.resetHistory();
      afterSave.resetHistory();

      const result0 = await user0.destroy();
      expect(beforeSave.callCount).to.equal(0, 'should not call beforeSave');
      expect(afterSave.callCount).to.equal(0, 'should not call afterSave');
      const user = result0;
      const result = await user.destroy({ hooks: true });
      expect(beforeSave.callCount).to.equal(0, 'should not call beforeSave even if `hooks: true`');
      expect(afterSave.callCount).to.equal(0, 'should not call afterSave even if `hooks: true`');

      await result;
    });

    it('delete a record of multiple primary keys table', async function() {
      const MultiPrimary = this.sequelize.define('MultiPrimary', {
        bilibili: {
          type: Support.Sequelize.CHAR(2),
          primaryKey: true
        },

        guruguru: {
          type: Support.Sequelize.CHAR(2),
          primaryKey: true
        }
      });

      await MultiPrimary.sync({ force: true });
      await MultiPrimary.create({ bilibili: 'bl', guruguru: 'gu' });
      const m2 = await MultiPrimary.create({ bilibili: 'bl', guruguru: 'ru' });
      const ms = await MultiPrimary.findAll();
      expect(ms.length).to.equal(2);

      await m2.destroy({
        logging(sql) {
          expect(sql).to.exist;
          expect(sql.toUpperCase()).to.include('DELETE');
          expect(sql).to.include('ru');
          expect(sql).to.include('bl');
        }
      });

      const ms0 = await MultiPrimary.findAll();
      expect(ms0.length).to.equal(1);
      expect(ms0[0].bilibili).to.equal('bl');
      expect(ms0[0].guruguru).to.equal('gu');
    });

    if (dialect.match(/^postgres/)) {
      it('converts Infinity in where clause to a timestamp', async function() {
        const Date = this.sequelize.define('Date',
          {
            date: {
              type: Support.Sequelize.DATE,
              primaryKey: true
            },
            deletedAt: {
              type: Support.Sequelize.DATE,
              defaultValue: Infinity
            }
          },
          { paranoid: true });

        await this.sequelize.sync({ force: true });

        const date = await Date.build({ date: Infinity })
          .save();

        await date.destroy();
      });
    }
  });
});
