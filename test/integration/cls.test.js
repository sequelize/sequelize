'use strict';

const chai      = require('chai'),
  expect    = chai.expect,
  Support   = require(__dirname + '/support'),
  Sequelize = Support.Sequelize,
  Promise   = Sequelize.Promise,
  cls       = require('continuation-local-storage'),
  current = Support.sequelize;

if (current.dialect.supports.transactions) {
  describe(Support.getTestDialectTeaser('Continuation local storage'), () => {
    before(function() {
      this.thenOriginal = Promise.prototype.then;
      Sequelize.useCLS(cls.createNamespace('sequelize'));
    });

    after(() => {
      delete Sequelize._cls;
    });

    beforeEach(function() {
      return Support.prepareTransactionTest(this.sequelize).bind(this).then(function(sequelize) {
        this.sequelize = sequelize;

        this.ns = cls.getNamespace('sequelize');

        this.User = this.sequelize.define('user', {
          name: Sequelize.STRING
        });
        return this.sequelize.sync({ force: true });
      });
    });

    describe('context', () => {
      it('does not use continuation storage on manually managed transactions', function() {
        const self = this;

        return Sequelize._clsRun(() => {
          return this.sequelize.transaction().then(transaction => {
            expect(self.ns.get('transaction')).to.be.undefined;
            return transaction.rollback();
          });
        });
      });

      it('supports several concurrent transactions', function() {
        let t1id, t2id;
        const self = this;

        return Promise.join(
          this.sequelize.transaction(() => {
            t1id = self.ns.get('transaction').id;

            return Promise.resolve();
          }),
          this.sequelize.transaction(() => {
            t2id = self.ns.get('transaction').id;

            return Promise.resolve();
          }),
          () => {
            expect(t1id).to.be.ok;
            expect(t2id).to.be.ok;
            expect(t1id).not.to.equal(t2id);
          }
        );
      });

      it('supports nested promise chains', function() {
        const self = this;

        return this.sequelize.transaction(() => {
          const tid = self.ns.get('transaction').id;

          return self.User.findAll().then(() => {
            expect(self.ns.get('transaction').id).to.be.ok;
            expect(self.ns.get('transaction').id).to.equal(tid);
          });
        });
      });

      it('does not leak variables to the outer scope', function() {
        // This is a little tricky. We want to check the values in the outer scope, when the transaction has been successfully set up, but before it has been comitted.
        // We can't just call another function from inside that transaction, since that would transfer the context to that function - exactly what we are trying to prevent;

        const self = this;
        let transactionSetup = false,
          transactionEnded = false;

        this.sequelize.transaction(() => {
          transactionSetup = true;

          return Promise.delay(500).then(() => {
            expect(self.ns.get('transaction')).to.be.ok;
            transactionEnded = true;
          });
        });

        return new Promise(resolve => {
          // Wait for the transaction to be setup
          const interval = setInterval(() => {
            if (transactionSetup) {
              clearInterval(interval);
              resolve();
            }
          }, 200);
        }).bind(this).then(function() {
          expect(transactionEnded).not.to.be.ok;

          expect(this.ns.get('transaction')).not.to.be.ok;

          // Just to make sure it didn't change between our last check and the assertion
          expect(transactionEnded).not.to.be.ok;
        });
      });

      it('does not leak variables to the following promise chain', function() {
        return this.sequelize.transaction(() => {
          return Promise.resolve();
        }).bind(this).then(function() {
          expect(this.ns.get('transaction')).not.to.be.ok;
        });
      });

      it('does not leak outside findOrCreate', function() {
        const self = this;

        return this.User.findOrCreate({
          where: {
            name: 'Kafka'
          },
          logging(sql) {
            if (/default/.test(sql)) {
              throw new Error('The transaction was not properly assigned');
            }
          }
        }).then(() => {
          return self.User.findAll();
        });
      });
    });

    describe('sequelize.query integration', () => {
      it('automagically uses the transaction in all calls', function() {
        const self = this;
        return this.sequelize.transaction(() => {
          return self.User.create({ name: 'bob' }).then(() => {
            return Promise.all([
              expect(self.User.findAll({ transaction: null })).to.eventually.have.length(0),
              expect(self.User.findAll({})).to.eventually.have.length(1)
            ]);
          });
        });
      });
    });

    it('bluebird patch is applied', function() {
      expect(Promise.prototype.then).to.be.a('function');
      expect(this.thenOriginal).to.be.a('function');
      expect(Promise.prototype.then).not.to.equal(this.thenOriginal);
    });

    it('CLS namespace is stored in Sequelize._cls', function() {
      expect(Sequelize._cls).to.equal(this.ns);
    });

    it('promises returned by sequelize.query are correctly patched', function() {
      return this.sequelize.transaction(t =>
        this.sequelize.query('select 1', {type: Sequelize.QueryTypes.SELECT})
          .then(() => expect(this.ns.get('transaction')).to.equal(t))
      );
    });
  });
}
