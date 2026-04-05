import type { CreationOptional, InferAttributes, InferCreationAttributes } from '@sequelize/core';
import { DataTypes, Model } from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import {
  beforeAll2,
  createSingleTransactionalTestSequelizeInstance,
  sequelize,
  setResetMode,
} from '../support';

describe('Model#decrement', () => {
  setResetMode('destroy');

  context('with transactions', () => {
    if (!sequelize.dialect.supports.transactions) {
      return;
    }

    it('supports transactions', async () => {
      const transactionSequelize = await createSingleTransactionalTestSequelizeInstance(sequelize);

      class User extends Model<InferAttributes<User>> {
        @Attribute(DataTypes.INTEGER)
        @NotNull
        declare integer: number;
      }

      transactionSequelize.addModels([User]);

      await User.sync({ force: true });
      const user = await User.create({ integer: 3 });
      const t = await transactionSequelize.startUnmanagedTransaction();

      try {
        await user.decrement('integer', { by: 2, transaction: t });
        const users1 = await User.findAll();
        const users2 = await User.findAll({ transaction: t });
        expect(users1[0].integer).to.equal(3);
        expect(users2[0].integer).to.equal(1);
      } finally {
        await t.rollback();
      }
    });
  });

  context('without transactions', () => {
    const vars = beforeAll2(async () => {
      const clock = sinon.useFakeTimers();

      class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
        declare id: number;
        declare updatedAt: CreationOptional<Date>;

        @Attribute(DataTypes.INTEGER)
        @NotNull
        declare integer1: number;

        @Attribute(DataTypes.INTEGER)
        @NotNull
        declare integer2: number;
      }

      sequelize.addModels([User]);

      await User.sync({ force: true });

      return { User, clock };
    });

    afterEach(() => {
      vars.clock.reset();
    });

    after(() => {
      vars.clock.restore();
    });

    beforeEach(async () => {
      await vars.User.create({ id: 1, integer1: 0, integer2: 0 });
    });

    if (sequelize.dialect.supports.returnValues === 'returning') {
      it('supports returning', async () => {
        const user1 = await vars.User.findByPk(1, { rejectOnEmpty: true });
        await user1.decrement('integer1', { by: 2 });
        expect(user1.integer1).to.equal(-2);
        const user3 = await user1.decrement('integer2', { by: 2, returning: false });
        expect(user3.integer2).to.equal(0);
      });
    }

    it('with array', async () => {
      const user1 = await vars.User.findByPk(1, { rejectOnEmpty: true });
      await user1.decrement(['integer1'], { by: 2 });
      const user3 = await vars.User.findByPk(1, { rejectOnEmpty: true });
      expect(user3.integer1).to.equal(-2);
    });

    it('with single field', async () => {
      const user1 = await vars.User.findByPk(1, { rejectOnEmpty: true });
      await user1.decrement('integer1', { by: 2 });
      const user3 = await vars.User.findByPk(1, { rejectOnEmpty: true });
      expect(user3.integer1).to.equal(-2);
    });

    it('with single field and no value', async () => {
      const user1 = await vars.User.findByPk(1, { rejectOnEmpty: true });
      await user1.decrement('integer1');
      const user2 = await vars.User.findByPk(1, { rejectOnEmpty: true });
      expect(user2.integer1).to.equal(-1);
    });

    it('should still work right with other concurrent updates', async () => {
      const user1 = await vars.User.findByPk(1, { rejectOnEmpty: true });
      // Select the user again (simulating a concurrent query)
      const user2 = await vars.User.findByPk(1, { rejectOnEmpty: true });

      await user2.update({
        integer1: user2.integer1 + 1,
      });

      await user1.decrement(['integer1'], { by: 2 });
      const user5 = await vars.User.findByPk(1, { rejectOnEmpty: true });
      expect(user5.integer1).to.equal(-1);
    });

    it('should still work right with other concurrent increments', async () => {
      const user1 = await vars.User.findByPk(1, { rejectOnEmpty: true });

      await Promise.all([
        user1.decrement(['integer1'], { by: 2 }),
        user1.decrement(['integer1'], { by: 2 }),
        user1.decrement(['integer1'], { by: 2 }),
      ]);

      const user2 = await vars.User.findByPk(1, { rejectOnEmpty: true });
      expect(user2.integer1).to.equal(-6);
    });

    it('with key value pair', async () => {
      const user1 = await vars.User.findByPk(1, { rejectOnEmpty: true });
      await user1.decrement({ integer1: 1, integer2: 2 });
      const user3 = await vars.User.findByPk(1, { rejectOnEmpty: true });
      expect(user3.integer1).to.equal(-1);
      expect(user3.integer2).to.equal(-2);
    });

    it('with negative value', async () => {
      const user1 = await vars.User.findByPk(1, { rejectOnEmpty: true });

      await Promise.all([
        user1.decrement('integer1', { by: -2 }),
        user1.decrement(['integer1', 'integer2'], { by: -2 }),
        user1.decrement({ integer1: -1, integer2: -2 }),
      ]);

      const user3 = await vars.User.findByPk(1, { rejectOnEmpty: true });
      expect(user3.integer1).to.equal(+5);
      expect(user3.integer2).to.equal(+4);
    });

    it('supports silent: true', async () => {
      const user = await vars.User.findByPk(1, { rejectOnEmpty: true });
      const oldDate = user.updatedAt;

      vars.clock.tick(1000);
      await user.decrement('integer1', { by: 1, silent: true });

      const refreshedUser = await vars.User.findByPk(1, { rejectOnEmpty: true });

      expect(refreshedUser.updatedAt).to.equalTime(oldDate);
    });

    it('is disallowed if no primary key is present', async () => {
      const Foo = sequelize.define('Foo', {}, { noPrimaryKey: true });
      await Foo.sync({ force: true });

      const instance = await Foo.create({});
      await expect(instance.decrement('id')).to.be.rejectedWith(
        'but the model does not have a primary key attribute definition.',
      );
    });
  });
});
