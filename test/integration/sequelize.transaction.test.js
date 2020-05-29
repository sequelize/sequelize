'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('./support'),
  Transaction = require('../../lib/transaction'),
  current = Support.sequelize,
  delay = require('delay');

if (current.dialect.supports.transactions) {

  describe(Support.getTestDialectTeaser('Sequelize#transaction'), () => {

    describe('then', () => {
      it('gets triggered once a transaction has been successfully committed', async function() {
        let called = false;

        const t = await this
          .sequelize
          .transaction();

        await t.commit();
        called = 1;
        expect(called).to.be.ok;
      });

      it('gets triggered once a transaction has been successfully rolled back', async function() {
        let called = false;

        const t = await this
          .sequelize
          .transaction();

        await t.rollback();
        called = 1;
        expect(called).to.be.ok;
      });

      if (Support.getTestDialect() !== 'sqlite') {
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
    });

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

        await Test
          .create({ name: 'Peter' }, { transaction });

        await delay(1000);

        await transaction
          .commit();

        const count = await Test.count();
        expect(count).to.equal(1);
      });
    });

    describe('concurrency', () => {
      describe('having tables with uniqueness constraints', () => {
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
  });

}
