'use strict';

const sinon = require('sinon');
const chai = require('chai'),
  expect = chai.expect,
  Support = require('./support'),
  Transaction = require('sequelize/lib/transaction'),
  current = Support.sequelize,
  delay = require('delay');

const sequelize = Support.sequelize;
const dialectName = sequelize.dialect.name;

describe(Support.getTestDialectTeaser('Sequelize#transaction'), () => {
  if (!current.dialect.supports.transactions) {
    return;
  }

  let stubs = [];

  afterEach(() => {
    for (const stub of stubs) {
      stub.restore();
    }

    stubs = [];
  });

  describe('Transaction#commit', () => {
    it('returns a promise that resolves once the transaction has been committed', async function() {
      const t = await this
        .sequelize
        .transaction();

      await expect(t.commit()).to.eventually.equal(undefined);
    });

    // we cannot close a sqlite connection, but there also cannot be a network error with sqlite.
    // so this test is not necessary for that dialect.
    if (dialectName !== 'sqlite') {
      it('does not pollute the pool with broken connections if commit fails', async function() {
        const initialPoolSize = this.sequelize.connectionManager.pool.size;

        stubs.push(sinon.stub(this.sequelize.queryInterface, 'commitTransaction').rejects(new Error('Oh no, an error!')));

        const t = await this
          .sequelize
          .transaction();

        await expect(t.commit()).to.be.rejectedWith('Oh no, an error!');

        // connection should have been destroyed
        expect(this.sequelize.connectionManager.pool.size).to.eq(Math.max(0, initialPoolSize - 1));
      });
    }
  });

  describe('Transaction#rollback', () => {
    it('returns a promise that resolves once the transaction has been rolled back', async function() {
      const t = await this
        .sequelize
        .transaction();

      expect(t.rollback()).to.eventually.equal(undefined);
    });

    // we cannot close a sqlite connection, but there also cannot be a network error with sqlite.
    // so this test is not necessary for that dialect.
    if (dialectName !== 'sqlite') {
      it('does not pollute the pool with broken connections if the rollback fails', async function() {
        const initialPoolSize = this.sequelize.connectionManager.pool.size;

        stubs.push(sinon.stub(this.sequelize.queryInterface, 'rollbackTransaction').rejects(new Error('Oh no, an error!')));

        const t = await this
          .sequelize
          .transaction();

        await expect(t.rollback()).to.be.rejectedWith('Oh no, an error!');

        // connection should have been destroyed
        expect(this.sequelize.connectionManager.pool.size).to.eq(Math.max(0, initialPoolSize - 1));
      });
    }
  });

  if (Support.getTestDialect() !== 'sqlite' && Support.getTestDialect() !== 'db2') {
    it('works for long running transactions', async function() {
      const sequelize = await Support.prepareTransactionTest(this.sequelize);
      this.sequelize = sequelize;

      this.User = sequelize.define('User', {
        name: Support.Sequelize.STRING
      }, { timestamps: false });

      await sequelize.sync({ force: true });
      const t = await this.sequelize.transaction();
      let query = 'select sleep(2);';

      switch (Support.getTestDialect()) {
        case 'postgres':
          query = 'select pg_sleep(2);';
          break;
        case 'sqlite':
          query = 'select sqlite3_sleep(2000);';
          break;
        case 'mssql':
          query = 'WAITFOR DELAY \'00:00:02\';';
          break;
        case 'oracle':
          query = 'BEGIN DBMS_SESSION.sleep(2); END;';
          break;
        default:
          break;
      }

      await this.sequelize.query(query, { transaction: t });
      await this.User.create({ name: 'foo' });
      await this.sequelize.query(query, { transaction: t });
      await t.commit();
      const users = await this.User.findAll();
      expect(users.length).to.equal(1);
      expect(users[0].name).to.equal('foo');
    });
  }

  describe('complex long running example', () => {
    it('works with promise syntax', async function() {
      const sequelize = await Support.prepareTransactionTest(this.sequelize);
      const Test = sequelize.define('Test', {
        id: { type: Support.Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: Support.Sequelize.STRING }
      });

      await sequelize.sync({ force: true });
      const transaction = await sequelize.transaction();
      expect(transaction).to.be.instanceOf(Transaction);

      await Test.create({ name: 'Peter' }, { transaction });

      await delay(1000);

      await transaction.commit();

      const count = await Test.count();
      expect(count).to.equal(1);
    });
  });

  describe('concurrency: having tables with uniqueness constraints', () => {
    beforeEach(async function() {
      const sequelize = await Support.prepareTransactionTest(this.sequelize);
      this.sequelize = sequelize;

      this.Model = sequelize.define('Model', {
        name: { type: Support.Sequelize.STRING, unique: true }
      }, {
        timestamps: false
      });

      await this.Model.sync({ force: true });
    });

    it('triggers the error event for the second transactions', async function() {
      const t1 = await this.sequelize.transaction();
      const t2 = await this.sequelize.transaction();
      await this.Model.create({ name: 'omnom' }, { transaction: t1 });

      await Promise.all([
        (async () => {
          try {
            return await this.Model.create({ name: 'omnom' }, { transaction: t2 });
          } catch (err) {
            expect(err).to.be.ok;
            return t2.rollback();
          }
        })(),
        delay(100).then(() => {
          return t1.commit();
        })
      ]);
    });
  });
});
