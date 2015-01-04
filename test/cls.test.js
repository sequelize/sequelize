"use strict";

/* jshint camelcase: false */
var chai      = require('chai')
  , sinon     = require('sinon')
  , expect    = chai.expect
  , Support   = require(__dirname + '/support')
  , Sequelize = Support.Sequelize
  , Promise   = Sequelize.Promise
  , cls       = require('continuation-local-storage')
  , current = Support.sequelize;

chai.config.includeStack = true;

describe(Support.getTestDialectTeaser("Continuation local storage"), function () {
  before(function () {
    this.sequelize = Support.createSequelizeInstance({
      namespace: cls.createNamespace('sequelize')
    });
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

  var autoCallback = function autoCallback(sequelize, cb) {
    return sequelize.transaction(cb);
  };
  var thenCallback = function thenCallback(sequelize, cb) {
    return sequelize.transaction().then(function (t) {
      cb().then(function () {
        t.commit();
      });
    });
  };

  if (current.dialect.supports.transactions) {
    [autoCallback, thenCallback].forEach(function (cb) {
      describe(cb.name, function () {
        describe('context', function () {
          it('supports several concurrent transactions', function () {
            var t1id, t2id, self = this;

            return Promise.join(
              cb(this.sequelize, function () {
                t1id = self.ns.get('transaction').id;

                return Promise.resolve();
              }),
              cb(this.sequelize, function () {
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

            return cb(this.sequelize, function () {
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

            cb(this.sequelize, function () {
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
            return cb(this.sequelize, function () {
              return Promise.resolve();
            }).bind(this).then(function () {
              expect(this.ns.get('transaction')).not.to.be.ok;
            });
          });
        });

        describe('sequelize.query integration', function () {
          it('automagically uses the transaction in all calls', function () {
            var self = this;
            return cb(this.sequelize, function () {
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
    });
  }
});
