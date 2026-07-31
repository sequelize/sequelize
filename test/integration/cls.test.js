'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/support'),
  Sequelize = Support.Sequelize,
  cls = require('cls-hooked'),
  { delay } = require(__dirname + '/../../lib/utils/promise-helpers'),
  current = Support.sequelize;

if (current.dialect.supports.transactions) {
  describe(Support.getTestDialectTeaser('Continuation local storage'), () => {
    before(() => {
      Sequelize.useCLS(cls.createNamespace('sequelize'));
    });

    after(() => {
      delete Sequelize._cls;
    });

    beforeEach(function () {
      return Support.prepareTransactionTest(this.sequelize).then((sequelize) => {
        this.sequelize = sequelize;

        this.ns = cls.getNamespace('sequelize');

        this.User = this.sequelize.define('user', {
          name: Sequelize.STRING
        });
        return this.sequelize.sync({ force: true });
      });
    });

    describe('context', () => {
      it('does not use continuation storage on manually managed transactions', function () {
        const self = this;

        return Sequelize._clsRun(() => {
          return this.sequelize.transaction().then((transaction) => {
            expect(self.ns.get('transaction')).to.be.undefined;
            return transaction.rollback();
          });
        });
      });

      it('supports several concurrent transactions', function () {
        let t1id, t2id;
        const self = this;

        return Promise.all([
          this.sequelize.transaction(() => {
            t1id = self.ns.get('transaction').id;

            return Promise.resolve();
          }),
          this.sequelize.transaction(() => {
            t2id = self.ns.get('transaction').id;

            return Promise.resolve();
          })
        ]).then(() => {
          expect(t1id).to.be.ok;
          expect(t2id).to.be.ok;
          expect(t1id).not.to.equal(t2id);
        });
      });

      it('supports nested promise chains', function () {
        const self = this;

        return this.sequelize.transaction(() => {
          const tid = self.ns.get('transaction').id;

          return self.User.findAll().then(() => {
            expect(self.ns.get('transaction').id).to.be.ok;
            expect(self.ns.get('transaction').id).to.equal(tid);
          });
        });
      });

      it('does not leak variables to the outer scope', function () {
        // This is a little tricky. We want to check the values in the outer scope, when the transaction has been successfully set up, but before it has been comitted.
        // We can't just call another function from inside that transaction, since that would transfer the context to that function - exactly what we are trying to prevent;

        const self = this;
        let transactionSetup = false,
          transactionEnded = false;

        this.sequelize.transaction(() => {
          transactionSetup = true;

          return delay(500).then(() => {
            expect(self.ns.get('transaction')).to.be.ok;
            transactionEnded = true;
          });
        });

        return new Promise((resolve) => {
          // Wait for the transaction to be setup
          const interval = setInterval(() => {
            if (transactionSetup) {
              clearInterval(interval);
              resolve();
            }
          }, 200);
        }).then(() => {
          expect(transactionEnded).not.to.be.ok;

          expect(this.ns.get('transaction')).not.to.be.ok;

          // Just to make sure it didn't change between our last check and the assertion
          expect(transactionEnded).not.to.be.ok;
        });
      });

      it('does not leak variables to the following promise chain', function () {
        return this.sequelize
          .transaction(() => {
            return Promise.resolve();
          })
          .then(() => {
            expect(this.ns.get('transaction')).not.to.be.ok;
          });
      });

      it('does not leak outside findOrCreate', function () {
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

    describe('nested transactions', () => {
      it('nests a transaction with no explicit parent as a savepoint', function () {
        return this.sequelize.transaction((outer) => {
          return this.sequelize.transaction((inner) => {
            expect(inner.parent).to.equal(outer);
            expect(inner.id).to.equal(outer.id);
            expect(inner.connection).to.equal(outer.connection);
            return Promise.resolve();
          });
        });
      });

      it('nests as a savepoint when `transaction` is explicitly undefined', function () {
        return this.sequelize.transaction((outer) => {
          return this.sequelize.transaction({ transaction: undefined }, (inner) => {
            expect(inner.parent).to.equal(outer);
            return Promise.resolve();
          });
        });
      });

      it('starts an independent transaction when `transaction` is null', function () {
        return this.sequelize.transaction((outer) => {
          return this.sequelize.transaction({ transaction: null }, (inner) => {
            expect(inner.parent).not.to.be.ok;
            expect(inner.id).not.to.equal(outer.id);
            expect(inner.connection).not.to.equal(outer.connection);
            return Promise.resolve();
          });
        });
      });

      it('leaves the outer transaction usable after a constraint violation inside the savepoint', function () {
        const Person = this.sequelize.define('person', {
          name: { type: Sequelize.STRING, unique: true }
        });

        return Person.sync({ force: true }).then(() => {
          return this.sequelize.transaction(() => {
            return Person.create({ name: 'bob' })
              .then(() => {
                return expect(
                  this.sequelize.transaction(() => {
                    return Person.create({ name: 'bob' });
                  })
                ).to.be.rejectedWith(Sequelize.UniqueConstraintError);
              })
              .then(() => {
                // Would fail with `25P02: current transaction is aborted` on postgres if the failed
                // INSERT had run in the outer transaction rather than a savepoint.
                return expect(Person.findAll()).to.eventually.have.length(1);
              });
          });
        });
      });

      it('rolls back only the savepoint and leaves the outer transaction usable', function () {
        return this.sequelize.transaction(() => {
          return this.User.create({ name: 'bob' })
            .then(() => {
              return expect(
                this.sequelize.transaction(() => {
                  return this.User.create({ name: 'alice' }).then(() => {
                    throw new Error('rollback the savepoint');
                  });
                })
              ).to.be.rejectedWith('rollback the savepoint');
            })
            .then(() => {
              return expect(this.User.findAll()).to.eventually.have.length(1);
            });
        });
      });
    });

    describe('sequelize.query integration', () => {
      it('automagically uses the transaction in all calls', function () {
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

    it('CLS namespace is stored in Sequelize._cls', function () {
      expect(Sequelize._cls).to.equal(this.ns);
    });

    it('promises returned by sequelize.query carry CLS context', function () {
      return this.sequelize.transaction((t) =>
        this.sequelize
          .query('select 1', { type: Sequelize.QueryTypes.SELECT })
          .then(() => expect(this.ns.get('transaction')).to.equal(t))
      );
    });
  });
}
