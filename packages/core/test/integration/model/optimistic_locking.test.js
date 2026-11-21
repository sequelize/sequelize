'use strict';

const Support = require('../support');
const { DataTypes, OptimisticLockError } = require('@sequelize/core');
const chai = require('chai');

const expect = chai.expect;

describe(Support.getTestDialectTeaser('Model'), () => {
  describe('optimistic locking', () => {
    let Account;
    beforeEach(async function () {
      Account = this.sequelize.define(
        'Account',
        {
          number: {
            type: DataTypes.INTEGER,
          },
        },
        {
          version: true,
        },
      );
      await Account.sync({ force: true });
    });

    it('should increment the version on save', async () => {
      const account0 = await Account.create({ number: 1 });
      account0.number += 1;
      expect(account0.version).to.eq(0);
      const account = await account0.save();
      expect(account.version).to.eq(1);
    });

    it('should increment the version on update', async () => {
      const account1 = await Account.create({ number: 1 });
      expect(account1.version).to.eq(0);
      const account0 = await account1.update({ number: 2 });
      expect(account0.version).to.eq(1);
      account0.number += 1;
      const account = await account0.save();
      expect(account.number).to.eq(3);
      expect(account.version).to.eq(2);
    });

    it('prevents stale instances from being saved', async () => {
      await expect(
        (async () => {
          const accountA = await Account.create({ number: 1 });
          const accountB0 = await Account.findByPk(accountA.id);
          accountA.number += 1;
          await accountA.save();
          const accountB = await accountB0;
          accountB.number += 1;

          return await accountB.save();
        })(),
      ).to.eventually.be.rejectedWith(OptimisticLockError);
    });

    it('increment() also increments the version', async () => {
      const account1 = await Account.create({ number: 1 });
      expect(account1.version).to.eq(0);
      const account0 = await account1.increment('number', { by: 1 });
      const account = await account0.reload();
      expect(account.version).to.eq(1);
    });

    it('decrement() also increments the version', async () => {
      const account1 = await Account.create({ number: 1 });
      expect(account1.version).to.eq(0);
      const account0 = await account1.decrement('number', { by: 1 });
      const account = await account0.reload();
      expect(account.version).to.eq(1);
    });

    describe('when the version column name differs from the attribute name', () => {
      let UnderscoredAccount;
      beforeEach(async function () {
        UnderscoredAccount = this.sequelize.define(
          'UnderscoredAccount',
          {
            number: {
              type: DataTypes.INTEGER,
            },
          },
          {
            version: 'lockVersion',
            underscored: true,
          },
        );
        await UnderscoredAccount.sync({ force: true });
      });

      it('increment() also increments the version', async () => {
        const account = await UnderscoredAccount.create({ number: 1 });
        expect(account.lockVersion).to.eq(0);
        await account.increment('number', { by: 1 });
        await account.reload();
        expect(account.number).to.eq(2);
        expect(account.lockVersion).to.eq(1);
      });

      it('decrement() also increments the version', async () => {
        const account = await UnderscoredAccount.create({ number: 1 });
        expect(account.lockVersion).to.eq(0);
        await account.decrement('number', { by: 1 });
        await account.reload();
        expect(account.number).to.eq(0);
        expect(account.lockVersion).to.eq(1);
      });
    });
  });
});
