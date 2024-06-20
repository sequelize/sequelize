'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../support');
const { DataTypes } = require('@sequelize/core');

const dialect = Support.sequelize.dialect;

describe('Model', () => {
  beforeEach(async function () {
    this.Payment = this.sequelize.define('Payment', {
      amount: DataTypes.FLOAT,
      mood: {
        type: DataTypes.ENUM(['happy', 'sad', 'neutral']),
      },
    });

    await this.sequelize.sync({ force: true });

    await this.Payment.bulkCreate([
      { amount: 5, mood: 'neutral' },
      { amount: -5, mood: 'neutral' },
      { amount: 10, mood: 'happy' },
      { amount: 90, mood: 'happy' },
    ]);
  });

  describe('sum', () => {
    it('should sum without rows', async function () {
      await expect(this.Payment.sum('amount', { where: { mood: 'sad' } })).to.eventually.be.null;
    });

    it('should sum when is 0', async function () {
      await expect(
        this.Payment.sum('amount', { where: { mood: 'neutral' } }),
      ).to.eventually.be.equal(0);
    });

    it('should sum', async function () {
      await expect(this.Payment.sum('amount', { where: { mood: 'happy' } })).to.eventually.be.equal(
        100,
      );
    });
  });

  for (const methodName of ['min', 'max']) {
    describe(methodName, () => {
      beforeEach(async function () {
        this.UserWithAge = this.sequelize.define('UserWithAge', {
          age: DataTypes.INTEGER,
          order: DataTypes.INTEGER,
        });

        await this.UserWithAge.sync({ force: true });
      });

      if (Support.sequelize.dialect.supports.transactions) {
        it('supports transactions', async function () {
          const sequelize = await Support.createSingleTransactionalTestSequelizeInstance(
            this.sequelize,
          );
          const User = sequelize.define('User', { age: DataTypes.INTEGER });

          await User.sync({ force: true });
          const t = await sequelize.startUnmanagedTransaction();
          await User.bulkCreate([{ age: 2 }, { age: 5 }, { age: 3 }], { transaction: t });
          const val1 = await User[methodName]('age');
          const val2 = await User[methodName]('age', { transaction: t });
          expect(val1).to.be.not.ok;
          expect(val2).to.equal(methodName === 'min' ? 2 : 5);
          await t.rollback();
        });
      }

      it('returns the correct value', async function () {
        await this.UserWithAge.bulkCreate([{ age: 3 }, { age: 2 }]);
        expect(await this.UserWithAge[methodName]('age')).to.equal(methodName === 'min' ? 2 : 3);
      });

      it('allows sql logging', async function () {
        let test = false;
        await this.UserWithAge[methodName]('age', {
          logging(sql) {
            test = true;
            expect(sql).to.exist;
            expect(sql.toUpperCase()).to.include('SELECT');
          },
        });
        expect(test).to.be.true;
      });

      if (dialect.supports.dataTypes.DECIMAL) {
        it('should allow decimals', async function () {
          const UserWithDec = this.sequelize.define('UserWithDec', {
            value: DataTypes.DECIMAL(10, 3),
          });

          await UserWithDec.sync({ force: true });

          await UserWithDec.bulkCreate([{ value: 5.5 }, { value: 3.5 }]);
          expect(await UserWithDec[methodName]('value')).to.equal(methodName === 'min' ? 3.5 : 5.5);
        });
      }

      it('should work with fields named as an SQL reserved keyword', async function () {
        await this.UserWithAge.bulkCreate([
          { age: 2, order: 3 },
          { age: 3, order: 5 },
        ]);
        expect(await this.UserWithAge[methodName]('order')).to.equal(methodName === 'min' ? 3 : 5);
      });
    });
  }
});
