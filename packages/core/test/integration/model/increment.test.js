'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../support');
const { DataTypes } = require('@sequelize/core');

describe(Support.getTestDialectTeaser('Model'), () => {
  before(function () {
    this.clock = Support.useFakeTimers();
  });

  after(function () {
    this.clock.restore();
  });

  beforeEach(async function () {
    this.User = this.sequelize.define('User', {
      id: { type: DataTypes.INTEGER, primaryKey: true },
      aNumber: { type: DataTypes.INTEGER },
      bNumber: { type: DataTypes.INTEGER },
      cNumber: { type: DataTypes.INTEGER, field: 'c_number' },
    });

    await this.User.sync({ force: true });

    await this.User.bulkCreate([
      {
        id: 1,
        aNumber: 0,
        bNumber: 0,
      },
      {
        id: 2,
        aNumber: 0,
        bNumber: 0,
      },
      {
        id: 3,
        aNumber: 0,
        bNumber: 0,
      },
      {
        id: 4,
        aNumber: 0,
        bNumber: 0,
        cNumber: 0,
      },
    ]);
  });

  for (const method of ['increment', 'decrement']) {
    describe(method, () => {
      before(function () {
        this.assert = (increment, decrement) => {
          return method === 'increment' ? increment : decrement;
        };
      });

      describe('paranoid', () => {
        beforeEach(async function () {
          this.ParanoidUser = this.sequelize.define(
            'ParanoidUser',
            { aNumber: DataTypes.INTEGER, name: DataTypes.STRING },
            { paranoid: true, version: true },
          );
          await this.ParanoidUser.sync({ force: true });
          this.liveUser = await this.ParanoidUser.create({ aNumber: 10, name: 'same' });
          this.deletedUser = await this.ParanoidUser.create({ aNumber: 10, name: 'same' });
          await this.deletedUser.destroy();
          await this.deletedUser.reload({ paranoid: false });
          this.clock.tick(1000);
        });

        it('does not change soft-deleted counters, versions or timestamps by default (#17612)', async function () {
          const deletedValues = structuredClone(this.deletedUser.get({ plain: true }));
          const liveUpdatedAt = this.liveUser.updatedAt;

          await this.ParanoidUser[method]('aNumber', { where: { name: 'same' }, by: 2 });

          await this.liveUser.reload();
          await this.deletedUser.reload({ paranoid: false });
          expect(this.liveUser.aNumber).to.equal(this.assert(12, 8));
          expect(this.liveUser.version).to.equal(1);
          expect(this.liveUser.updatedAt).to.be.afterTime(liveUpdatedAt);
          expect(this.deletedUser.get({ plain: true })).to.deep.equal(deletedValues);
        });

        it('updates both live and soft-deleted rows with paranoid: false', async function () {
          const oldVersions = [this.liveUser.version, this.deletedUser.version];
          await this.ParanoidUser[method]('aNumber', {
            where: { name: 'same' },
            by: 2,
            paranoid: false,
          });

          for (const [index, user] of [this.liveUser, this.deletedUser].entries()) {
            const oldUpdatedAt = user.updatedAt;
            await user.reload({ paranoid: false });
            expect(user.aNumber).to.equal(this.assert(12, 8));
            expect(user.version).to.equal(oldVersions[index] + 1);
            expect(user.updatedAt).to.be.afterTime(oldUpdatedAt);
          }
        });

        if (Support.sequelize.dialect.supports.transactions) {
          it('preserves an explicit transaction and rolls back paranoid updates', async function () {
            const transaction = await this.sequelize.startUnmanagedTransaction();
            const options = { where: { name: 'same' }, by: 2, transaction };
            try {
              await this.ParanoidUser[method]('aNumber', options);
              const users = await this.ParanoidUser.findAll({
                paranoid: false,
                order: ['id'],
                transaction,
              });
              expect(users.map(user => user.aNumber)).to.deep.equal([this.assert(12, 8), 10]);
              expect(options.transaction).to.equal(transaction);
            } finally {
              await transaction.rollback();
            }

            await this.liveUser.reload();
            await this.deletedUser.reload({ paranoid: false });
            expect(this.liveUser.aNumber).to.equal(10);
            expect(this.liveUser.version).to.equal(0);
            expect(this.deletedUser.aNumber).to.equal(10);
          });
        }

        it('composes a mapped deletedAt with scope and caller where without mutating reused options', async function () {
          const User = this.sequelize.define(
            'MappedParanoidUser',
            {
              aNumber: DataTypes.INTEGER,
              name: DataTypes.STRING,
              group: DataTypes.INTEGER,
              removedAt: { type: DataTypes.DATE, columnName: 'removed_at' },
            },
            {
              paranoid: true,
              deletedAt: 'removedAt',
              defaultScope: { where: { group: 1 } },
            },
          );
          await User.sync({ force: true });
          const users = await User.bulkCreate([
            { aNumber: 10, name: 'same', group: 1 },
            { aNumber: 10, name: 'same', group: 1 },
            { aNumber: 10, name: 'other', group: 1 },
            { aNumber: 10, name: 'same', group: 2 },
          ]);
          await users[1].destroy();
          const options = { where: { name: 'same' }, by: 2 };
          const originalOptions = structuredClone(options);

          await User[method]('aNumber', options);
          await User[method]('aNumber', options);

          const reloaded = await User.withoutScope().findAll({ paranoid: false, order: ['id'] });
          expect(reloaded.map(user => user.aNumber)).to.deep.equal([
            this.assert(14, 6),
            10,
            10,
            10,
          ]);
          expect(options).to.deep.equal(originalOptions);
        });

        it('applies paranoid filtering and its opt-out through instance delegation', async function () {
          const deletedValues = structuredClone(this.deletedUser.get({ plain: true }));
          await this.deletedUser[method]('aNumber', { by: 2 });
          await this.deletedUser.reload({ paranoid: false });
          expect(this.deletedUser.get({ plain: true })).to.deep.equal(deletedValues);

          await this.deletedUser[method]('aNumber', { by: 2, paranoid: false });
          await this.deletedUser.reload({ paranoid: false });
          expect(this.deletedUser.aNumber).to.equal(this.assert(12, 8));
          await this.liveUser.reload();
          expect(this.liveUser.aNumber).to.equal(10);
        });
      });

      it('supports where conditions', async function () {
        await this.User.findByPk(1);
        await this.User[method](['aNumber'], { by: 2, where: { id: 1 } });
        const user3 = await this.User.findByPk(2);
        expect(user3.aNumber).to.equal(this.assert(0, 0));
      });

      it('uses correct column names for where conditions', async function () {
        await this.User[method](['aNumber'], { by: 2, where: { cNumber: 0 } });
        const user4 = await this.User.findByPk(4);
        expect(user4.aNumber).to.equal(this.assert(2, -2));
      });

      it('should still work right with other concurrent increments', async function () {
        const aUsers = await this.User.findAll();

        await Promise.all([
          this.User[method](['aNumber'], { by: 2, where: {} }),
          this.User[method](['aNumber'], { by: 2, where: {} }),
          this.User[method](['aNumber'], { by: 2, where: {} }),
        ]);

        const bUsers = await this.User.findAll();
        expect(bUsers).to.have.length(4);
        for (const [i, bUser] of bUsers.entries()) {
          expect(bUser.aNumber).to.equal(this.assert(aUsers[i].aNumber + 6, aUsers[i].aNumber - 6));
        }
      });

      it('with array', async function () {
        const aUsers = await this.User.findAll();
        await this.User[method](['aNumber'], { by: 2, where: {} });
        const bUsers = await this.User.findAll();
        expect(bUsers).to.have.length(4);
        for (const [i, bUser] of bUsers.entries()) {
          expect(bUser.aNumber).to.equal(this.assert(aUsers[i].aNumber + 2, aUsers[i].aNumber - 2));
        }
      });

      it('with single field', async function () {
        const aUsers = await this.User.findAll();
        await this.User[method]('aNumber', { by: 2, where: {} });
        const bUsers = await this.User.findAll();
        expect(bUsers).to.have.length(4);
        for (const [i, bUser] of bUsers.entries()) {
          expect(bUser.aNumber).to.equal(this.assert(aUsers[i].aNumber + 2, aUsers[i].aNumber - 2));
        }
      });

      it('with single field and no value', async function () {
        const aUsers = await this.User.findAll();
        await this.User[method]('aNumber', { where: {} });
        const bUsers = await this.User.findAll();
        expect(bUsers).to.have.length(4);
        for (const [i, bUser] of bUsers.entries()) {
          expect(bUser.aNumber).to.equal(this.assert(aUsers[i].aNumber + 1, aUsers[i].aNumber - 1));
        }
      });

      it('with key value pair', async function () {
        const aUsers = await this.User.findAll();
        await this.User[method]({ aNumber: 1, bNumber: 2 }, { where: {} });
        const bUsers = await this.User.findAll();
        expect(bUsers).to.have.length(4);
        for (const [i, bUser] of bUsers.entries()) {
          expect(bUser.aNumber).to.equal(this.assert(aUsers[i].aNumber + 1, aUsers[i].aNumber - 1));
          expect(bUser.bNumber).to.equal(this.assert(aUsers[i].bNumber + 2, aUsers[i].bNumber - 2));
        }
      });

      it('should still work right with other concurrent updates', async function () {
        const aUsers = await this.User.findAll();
        await this.User.update({ aNumber: 2 }, { where: {} });
        await this.User[method](['aNumber'], { by: 2, where: {} });
        const bUsers = await this.User.findAll();
        expect(bUsers).to.have.length(4);
        for (const [i, bUser] of bUsers.entries()) {
          // for decrement 2 - 2 = 0
          expect(bUser.aNumber).to.equal(this.assert(aUsers[i].aNumber + 4, aUsers[i].aNumber));
        }
      });

      it('with timestamps set to true', async function () {
        const User = this.sequelize.define(
          'IncrementUser',
          {
            aNumber: DataTypes.INTEGER,
          },
          { timestamps: true },
        );

        await User.sync({ force: true });
        const user = await User.create({ aNumber: 1 });
        const oldDate = user.updatedAt;

        this.clock.tick(1000);
        await User[method]('aNumber', { by: 1, where: {} });

        await expect(User.findByPk(1)).to.eventually.have.property('updatedAt').afterTime(oldDate);
      });

      it('with timestamps set to true and options.silent set to true', async function () {
        const User = this.sequelize.define(
          'IncrementUser',
          {
            aNumber: DataTypes.INTEGER,
          },
          { timestamps: true },
        );

        await User.sync({ force: true });
        const user = await User.create({ aNumber: 1 });
        const oldDate = user.updatedAt;
        expect(oldDate).to.be.instanceOf(Date, 'Date from User.create is not a Date');
        this.clock.tick(1000);
        await User[method]('aNumber', { by: 1, silent: true, where: {} });

        const updatedUser = await User.findByPk(1);

        await expect(updatedUser.updatedAt).to.equalTime(oldDate);
      });

      it('should work with scopes', async function () {
        const User = this.sequelize.define(
          'User',
          {
            aNumber: DataTypes.INTEGER,
            name: DataTypes.STRING,
          },
          {
            scopes: {
              jeff: {
                where: {
                  name: 'Jeff',
                },
              },
            },
          },
        );

        await User.sync({ force: true });

        await User.bulkCreate([
          {
            aNumber: 1,
            name: 'Jeff',
          },
          {
            aNumber: 3,
            name: 'Not Jeff',
          },
        ]);

        await User.withScope('jeff')[method]('aNumber', {});
        const jeff = await User.withScope('jeff').findOne();
        expect(jeff.aNumber).to.equal(this.assert(2, 0));

        const notJeff = await User.findOne({
          where: {
            name: 'Not Jeff',
          },
        });

        expect(notJeff.aNumber).to.equal(this.assert(3, 3));
      });

      it('should not care for attributes in the instance scope', async function () {
        this.User.addScope('test', {
          attributes: ['foo', 'bar'],
        });
        const createdUser = await this.User.withScope('test').create({ id: 5, aNumber: 5 });
        await createdUser[method]('aNumber', { by: 2 });
        const user = await this.User.findByPk(5);
        expect(user.aNumber).to.equal(this.assert(7, 3));
      });
      it('should not care for exclude-attributes in the instance scope', async function () {
        this.User.addScope('test', {
          attributes: { exclude: ['foo', 'bar'] },
        });
        const createdUser = await this.User.withScope('test').create({ id: 5, aNumber: 5 });
        await createdUser[method]('aNumber', { by: 2 });
        const user = await this.User.findByPk(5);
        expect(user.aNumber).to.equal(this.assert(7, 3));
      });
      it('should not care for include-attributes in the instance scope', async function () {
        this.User.addScope('test', {
          attributes: { include: ['foo', 'bar'] },
        });
        const createdUser = await this.User.withScope('test').create({ id: 5, aNumber: 5 });
        await createdUser[method]('aNumber', { by: 2 });
        const user = await this.User.findByPk(5);
        expect(user.aNumber).to.equal(this.assert(7, 3));
      });
    });
  }
});
