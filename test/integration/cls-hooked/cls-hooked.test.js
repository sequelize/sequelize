'use strict';

const chai      = require('chai'),
  expect    = chai.expect,
  Support   = require('../support'),
  Sequelize = Support.Sequelize,
  Promise   = Sequelize.Promise,
  cls       = require('cls-hooked'),
  current = Support.sequelize,
  semver = require('semver'),
  isNode8 = semver.satisfies(process.version, '>= 8');

if (current.dialect.supports.transactions && isNode8) {
  describe(Support.getTestDialectTeaser('cls-hooked'), () => {
    before(function() {
      this.thenOriginal = Promise.prototype.then;
      Sequelize.useCLS(cls.createNamespace('sequelize'));
    });

    after(() => {
      delete Sequelize._cls;
    });

    let sequelize, ns, User;
    beforeEach(async function() {
      sequelize = await Support.prepareTransactionTest(this.sequelize);
      ns = cls.getNamespace('sequelize');
      User = sequelize.define('user', {
        name: Sequelize.STRING
      });
      await sequelize.sync({ force: true });
    });

    describe('context', () => {
      it('does not use continuation storage on manually managed transactions', () => {
        return Sequelize._clsRun(async() => {
          const transaction = await sequelize.transaction();
          expect(ns.get('transaction')).to.be.undefined;
          await transaction.rollback();
        });
      });

      it('supports several concurrent transactions', async() => {
        const [t1id, t2id] = await Promise.all([
          sequelize.transaction(async() => {
            const _t1id = ns.get('transaction').id;
            return await Promise.resolve(_t1id);
          }),
          sequelize.transaction(async() => {
            const _t2id = ns.get('transaction').id;
            return await Promise.resolve(_t2id);
          })
        ]);
        expect(t1id).to.be.ok;
        expect(t2id).to.be.ok;
        expect(t1id).not.to.equal(t2id);
      });

      it('supports nested promise chains', async() => {
        await sequelize.transaction(async() => {
          const tid = ns.get('transaction').id;
          expect(tid).to.be.ok;

          await User.findAll().then(() => {
            expect(ns.get('transaction').id).to.equal(tid);
          });
          expect(ns.get('transaction').id).to.equal(tid);
        });
      });

      it('does not leak variables to the outer scope', async() => {
        // This is a little tricky. We want to check the values in the outer scope, when the transaction has been successfully set up, but before it has been comitted.
        // We can't just call another function from inside that transaction, since that would transfer the context to that function - exactly what we are trying to prevent;

        let transactionSetup = false,
          transactionEnded = false;

        sequelize.transaction(async() => {
          transactionSetup = true;

          await Promise.delay(500).then(() => {
            expect(ns.get('transaction')).to.be.ok;
            transactionEnded = true;
          });
        });

        await new Promise(resolve => {
          // Wait for the transaction to be setup
          const interval = setInterval(() => {
            if (transactionSetup) {
              clearInterval(interval);
              resolve();
            }
          }, 200);
        });
        expect(transactionEnded).not.to.be.ok;

        expect(ns.get('transaction')).not.to.be.ok;

        // Just to make sure it didn't change between our last check and the assertion
        expect(transactionEnded).not.to.be.ok;
      });

      it('does not leak variables to the following promise chain', async() => {
        await sequelize.transaction(() => {
          return Promise.resolve();
        });
        expect(ns.get('transaction')).not.to.be.ok;
      });

      it('does not leak outside findOrCreate', async() => {
        await User.findOrCreate({
          where: {
            name: 'Kafka'
          },
          logging(sql) {
            if (/default/.test(sql)) {
              throw new Error('The transaction was not properly assigned');
            }
          }
        });
        await User.findAll();
      });
    });

    describe('sequelize.query integration', () => {
      it('automagically uses the transaction in all calls', async() => {
        await sequelize.transaction(async() => {
          await User.create({ name: 'bob' });
          await Promise.all([
            expect(User.findAll({ transaction: null })).to.eventually.have.length(0),
            expect(User.findAll({})).to.eventually.have.length(1)
          ]);
        });
      });
    });

    it('bluebird patch is applied', function() {
      expect(Promise.prototype.then).to.be.a('function');
      expect(this.thenOriginal).to.be.a('function');
      expect(Promise.prototype.then).not.to.equal(this.thenOriginal);
    });

    it('CLS namespace is stored in Sequelize._cls', () => {
      expect(Sequelize._cls).to.equal(ns);
    });
  });
}
