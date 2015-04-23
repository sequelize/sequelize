'use strict';

/* jshint camelcase: false */
/* jshint -W030 */
var chai      = require('chai')
  , expect    = chai.expect
  , Support   = require(__dirname + '/support')
  , Sequelize = Support.Sequelize
  , Promise   = Sequelize.Promise
  , cls       = require('continuation-local-storage')
  , current = Support.sequelize;

chai.config.includeStack = true;

if (current.dialect.supports.transactions) {
  describe(Support.getTestDialectTeaser('Continuation local storage'), function () {
    before(function () {
      Sequelize.cls = cls.createNamespace('sequelize');
    });

    after(function () {
      delete Sequelize.cls;
    });

    beforeEach(function () {
      return Support.prepareTransactionTest(this.sequelize).bind(this).then(function (sequelize) {
        this.sequelize = sequelize;

        this.ns = cls.getNamespace('sequelize');

        this.User = this.sequelize.define('user', {
          name: Sequelize.STRING
        });
        return this.sequelize.sync({ force: true });
      });
    });

    describe('context', function () {
      it('supports several concurrent transactions', function () {
        var t1id, t2id, self = this;

        return Promise.join(
          this.sequelize.transaction(function () {
            t1id = self.ns.get('transaction').id;

            return Promise.resolve();
          }),
          this.sequelize.transaction(function () {
            t2id = self.ns.get('transaction').id;

            return Promise.resolve();
          }),
          function () {
            expect(t1id).to.be.ok;
            expect(t2id).to.be.ok;
            expect(t1id).not.to.equal(t2id);
          }
        );
      });

      it('supports nested promise chains', function () {
        var self = this;

        return this.sequelize.transaction(function () {
          var tid = self.ns.get('transaction').id;

          return self.User.findAll().then(function () {
            expect(self.ns.get('transaction').id).to.be.ok;
            expect(self.ns.get('transaction').id).to.equal(tid);
          });
        });
      });

      it('does not leak variables to the outer scope', function () {
        // This is a little tricky. We want to check the values in the outer scope, when the transaction has been successfully set up, but before it has been comitted.
        // We can't just call another function from inside that transaction, since that would transfer the context to that function - exactly what we are trying to prevent;

        var self = this
          , transactionSetup = false
          , transactionEnded = false;

        this.sequelize.transaction(function () {
          transactionSetup = true;

          return Promise.delay(500).then(function () {
            expect(self.ns.get('transaction')).to.be.ok;
            transactionEnded = true;
          });
        });

        return new Promise(function (resolve)  {
          // Wait for the transaction to be setup
          var interval = setInterval(function () {
            if (transactionSetup) {
              clearInterval(interval);
              resolve();
            }
          }, 200);
        }).bind(this).then(function () {
          expect(transactionEnded).not.to.be.ok;

          expect(this.ns.get('transaction')).not.to.be.ok;

          // Just to make sure it didn't change between our last check and the assertion
          expect(transactionEnded).not.to.be.ok;
        });
      });

      it('does not leak variables to the following promise chain', function () {
        return this.sequelize.transaction(function () {
          return Promise.resolve();
        }).bind(this).then(function () {
          expect(this.ns.get('transaction')).not.to.be.ok;
        });
      });

      it('does not leak outside findOrCreate', function () {
        var self = this;

        return this.User.findOrCreate({
          where: {
            name: 'Kafka'
          }
        }).then(function () {
          return self.User.findAll();
        });
      });
    });

    describe('sequelize.query integration', function () {
      it('automagically uses the transaction in all calls', function () {
        var self = this;
        return this.sequelize.transaction(function () {
          return self.User.create({ name: 'bob' }).then(function () {
            return Promise.all([
              expect(self.User.findAll({}, { transaction: null })).to.eventually.have.length(0),
              expect(self.User.findAll({})).to.eventually.have.length(1)
            ]);
          });
        });
      });
    });
  });
}
