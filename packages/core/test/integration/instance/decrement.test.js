'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../support');
const { DataTypes } = require('@sequelize/core');
const sinon = require('sinon');

const current = Support.sequelize;

describe(Support.getTestDialectTeaser('Instance'), () => {
  before(function () {
    this.clock = sinon.useFakeTimers();
  });

  afterEach(function () {
    this.clock.reset();
  });

  after(function () {
    this.clock.restore();
  });

  beforeEach(async function () {
    this.User = this.sequelize.define('User', {
      username: { type: DataTypes.STRING },
      uuidv1: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV1 },
      uuidv4: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4 },
      touchedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      aNumber: { type: DataTypes.INTEGER },
      bNumber: { type: DataTypes.INTEGER },
      aDate: { type: DataTypes.DATE },

      validateTest: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: { isInt: true },
      },
      validateCustom: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: { len: { msg: 'Length failed.', args: [1, 20] } },
      },

      dateAllowNullTrue: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      isSuperUser: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    });

    await this.User.sync({ force: true });
  });

  describe('decrement', () => {
    beforeEach(async function () {
      await this.User.create({ id: 1, aNumber: 0, bNumber: 0 });
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', async function () {
        const sequelize = await Support.prepareTransactionTest(this.sequelize);
        const User = sequelize.define('User', { number: DataTypes.INTEGER });

        await User.sync({ force: true });
        const user = await User.create({ number: 3 });
        const t = await sequelize.startUnmanagedTransaction();
        await user.decrement('number', { by: 2, transaction: t });

        // CockroachDB transaction isolation does not allow read queries in between a transaction unless the transaction commits.
        if (current.dialect.name !== 'cockroachdb') {
          const users1 = await User.findAll();
          expect(users1[0].number).to.equal(3);
        }

        const users2 = await User.findAll({ transaction: t });

        expect(users2[0].number).to.equal(1);
        await t.rollback();
      });
    }

    if (current.dialect.supports.returnValues === 'returning') {
      it('supports returning', async function () {
        const user1 = await this.User.findByPk(1);
        await user1.decrement('aNumber', { by: 2 });
        expect(user1.aNumber).to.be.equal(-2);
        const user3 = await user1.decrement('bNumber', { by: 2, returning: false });
        expect(user3.bNumber).to.be.equal(0);
      });
    }

    it('with array', async function () {
      const user1 = await this.User.findByPk(1);
      await user1.decrement(['aNumber'], { by: 2 });
      const user3 = await this.User.findByPk(1);
      expect(user3.aNumber).to.be.equal(-2);
    });

    it('with single field', async function () {
      const user1 = await this.User.findByPk(1);
      await user1.decrement('aNumber', { by: 2 });
      const user3 = await this.User.findByPk(1);
      expect(user3.aNumber).to.be.equal(-2);
    });

    it('with single field and no value', async function () {
      const user1 = await this.User.findByPk(1);
      await user1.decrement('aNumber');
      const user2 = await this.User.findByPk(1);
      expect(user2.aNumber).to.be.equal(-1);
    });

    it('should still work right with other concurrent updates', async function () {
      const user1 = await this.User.findByPk(1);
      // Select the user again (simulating a concurrent query)
      const user2 = await this.User.findByPk(1);

      await user2.update({
        aNumber: user2.aNumber + 1,
      });

      await user1.decrement(['aNumber'], { by: 2 });
      const user5 = await this.User.findByPk(1);
      expect(user5.aNumber).to.be.equal(-1);
    });

    it('should still work right with other concurrent increments', async function () {
      const user1 = await this.User.findByPk(1);

      await Promise.all([
        user1.decrement(['aNumber'], { by: 2 }),
        user1.decrement(['aNumber'], { by: 2 }),
        user1.decrement(['aNumber'], { by: 2 }),
      ]);

      const user2 = await this.User.findByPk(1);
      expect(user2.aNumber).to.equal(-6);
    });

    it('with key value pair', async function () {
      const user1 = await this.User.findByPk(1);
      await user1.decrement({ aNumber: 1, bNumber: 2 });
      const user3 = await this.User.findByPk(1);
      expect(user3.aNumber).to.be.equal(-1);
      expect(user3.bNumber).to.be.equal(-2);
    });

    it('with negative value', async function () {
      const user1 = await this.User.findByPk(1);

      await Promise.all([
        user1.decrement('aNumber', { by: -2 }),
        user1.decrement(['aNumber', 'bNumber'], { by: -2 }),
        user1.decrement({ aNumber: -1, bNumber: -2 }),
      ]);

      const user3 = await this.User.findByPk(1);
      expect(user3.aNumber).to.be.equal(+5);
      expect(user3.bNumber).to.be.equal(+4);
    });

    it('with timestamps set to true', async function () {
      const User = this.sequelize.define('IncrementUser', {
        aNumber: DataTypes.INTEGER,
      }, { timestamps: true });

      await User.sync({ force: true });
      const user = await User.create({ aNumber: 1 });
      const oldDate = user.updatedAt;
      if (current.dialect.name !== 'cockroachdb') {
        expect(oldDate).to.be.instanceOf(Date);
      }

      this.clock.tick(1000);
      await user.decrement('aNumber', { by: 1 });
      let reloadedUser;
      if (current.dialect.name === 'cockroachdb') {
        reloadedUser = await User.findByPk(user.id);

      } else {
        reloadedUser = await User.findByPk(1);
      }

      expect(reloadedUser.updatedAt).to.be.instanceOf(Date);
      expect(reloadedUser.updatedAt).to.be.afterTime(oldDate);
    });

    it('with timestamps set to true and options.silent set to true', async function () {
      const User = this.sequelize.define('IncrementUser', {
        aNumber: DataTypes.INTEGER,
      }, { timestamps: true });

      await User.sync({ force: true });
      const user = await User.create({ aNumber: 1 });
      const oldDate = user.updatedAt;
      this.clock.tick(1000);
      await user.decrement('aNumber', { by: 1, silent: true });

      if (current.dialect.name === 'cockroachdb') {
        await expect(User.findByPk(user.id)).to.eventually.have.property('updatedAt').equalTime(oldDate);
      } else {
        await expect(User.findByPk(1)).to.eventually.have.property('updatedAt').equalTime(oldDate);
      }
    });

    it('is disallowed if no primary key is present', async function () {
      const Foo = this.sequelize.define('Foo', {}, { noPrimaryKey: true });
      await Foo.sync({ force: true });

      const instance = await Foo.create({});
      await expect(instance.decrement()).to.be.rejectedWith('but the model does not have a primary key attribute definition.');
    });
  });
});
