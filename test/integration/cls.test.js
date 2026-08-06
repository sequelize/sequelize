import { delay } from '../../lib/utils/promise-helpers.js';
import * as chai from 'chai';
import Support from './support.js';
import clsHooked from 'cls-hooked';

const expect = chai.expect;

const Sequelize = Support.Sequelize;

const current = Support.sequelize;

// Run the whole suite against both namespace implementations: the one this fork ships
// (`Sequelize.createCLSNamespace`) and `cls-hooked`, which callers had to supply
// themselves before it existed and which `useCLS` still duck-types for.
const implementations = current.dialect.supports.transactions
  ? [
      ['CLSNamespace', () => Sequelize.createCLSNamespace()],
      ['cls-hooked', () => clsHooked.createNamespace('sequelize')]
    ]
  : [];

for (const [implementation, createNamespace] of implementations) {
  describe(`${Support.getTestDialectTeaser('Continuation local storage')} (${implementation})`, () => {
    let ns;

    before(() => {
      ns = createNamespace();
      Sequelize.useCLS(ns);
    });

    after(() => {
      delete Sequelize._cls;
    });

    beforeEach(function () {
      return Support.prepareTransactionTest(this.sequelize).then((sequelize) => {
        this.sequelize = sequelize;

        this.ns = ns;

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

    describe('nested transaction savepoint release', () => {
      it('releases the savepoint when a nested transaction commits', function () {
        const sql = [];

        return this.sequelize
          .transaction(async () => {
            await this.sequelize.transaction({ logging: (s) => sql.push(s) }, async () => {
              await this.User.create({ name: 'bob' });
            });
          })
          .then(() => {
            expect(sql.join('\n')).to.match(/RELEASE SAVEPOINT/);
          });
      });

      it('leaves no savepoint to roll back to after the nested transaction commits', function () {
        return this.sequelize.transaction(async (outer) => {
          let savepointName;

          await this.sequelize.transaction(async (inner) => {
            savepointName = inner.name;
          });

          // The savepoint is released, so rolling back to it is an error rather than a silent no-op.
          await expect(
            this.sequelize.query(
              'ROLLBACK TO SAVEPOINT ' + this.sequelize.getQueryInterface().quoteIdentifier(savepointName, true),
              { transaction: outer }
            )
          ).to.be.rejected;
        });
      });

      it('rolls a savepoint back to itself after it has opened a deeper savepoint', function () {
        // Regression: the savepoint name used to be assigned onto the PARENT transaction, so opening a
        // deeper savepoint renamed the middle one and its rollback targeted the deeper savepoint —
        // silently keeping writes the rollback was supposed to discard.
        return this.sequelize.transaction(async () => {
          await this.User.create({ name: 'outer' });

          await expect(
            this.sequelize.transaction(async () => {
              await this.User.create({ name: 'middle' });

              await this.sequelize.transaction(async () => {
                await this.User.create({ name: 'deep' });
              });

              throw new Error('rollback the middle savepoint');
            })
          ).to.be.rejectedWith('rollback the middle savepoint');

          const users = await this.User.findAll();
          expect(users.map((user) => user.name)).to.deep.equal(['outer']);
        });
      });

      it('releases one savepoint per sequential nested transaction', function () {
        const sql = [];
        const logging = (s) => sql.push(s);

        return this.sequelize.transaction(async () => {
          for (const name of ['first', 'second', 'third']) {
            await this.sequelize.transaction({ logging }, async () => {
              await this.User.create({ name });
            });
          }

          // One release per commit, so the subtransaction stack does not grow with the loop.
          expect(sql.filter((statement) => /RELEASE SAVEPOINT/.test(statement))).to.have.length(3);
          await expect(this.User.findAll()).to.eventually.have.length(3);
        });
      });
    });

    describe('nested transaction afterCommit hooks', () => {
      it('defers a savepoint hook to the root transaction instead of running it at savepoint commit', function () {
        const fired = [];

        return this.sequelize
          .transaction(async () => {
            await this.sequelize.transaction(async (inner) => {
              inner.afterCommit(() => fired.push('inner'));
            });

            // The savepoint has committed, but its work is not durable yet.
            expect(fired).to.deep.equal([]);
          })
          .then(() => {
            expect(fired).to.deep.equal(['inner']);
          });
      });

      it('does not run a hook registered in a savepoint that rolled back', function () {
        const fired = [];

        return this.sequelize
          .transaction(async () => {
            await expect(
              this.sequelize.transaction(async (inner) => {
                inner.afterCommit(() => fired.push('inner'));
                throw new Error('rollback the savepoint');
              })
            ).to.be.rejectedWith('rollback the savepoint');
          })
          .then(() => {
            expect(fired).to.deep.equal([]);
          });
      });

      it('hands hooks up through several levels of savepoint', function () {
        const fired = [];

        return this.sequelize
          .transaction(async (outer) => {
            outer.afterCommit(() => fired.push('outer'));

            await this.sequelize.transaction(async (middle) => {
              middle.afterCommit(() => fired.push('middle'));

              await this.sequelize.transaction(async (deep) => {
                deep.afterCommit(() => fired.push('deep'));
              });
            });

            expect(fired).to.deep.equal([]);
          })
          .then(() => {
            expect(fired).to.deep.equal(['outer', 'middle', 'deep']);
          });
      });

      it('discards hooks handed up by a savepoint when an enclosing transaction rolls back', function () {
        const fired = [];

        return expect(
          this.sequelize.transaction(async () => {
            await this.sequelize.transaction(async (inner) => {
              inner.afterCommit(() => fired.push('inner'));
            });

            throw new Error('rollback the root');
          })
        )
          .to.be.rejectedWith('rollback the root')
          .then(() => {
            expect(fired).to.deep.equal([]);
          });
      });

      it('defers hooks from an unmanaged savepoint to its explicitly passed parent', async function () {
        const fired = [];
        const root = await this.sequelize.transaction();
        const savepoint = await this.sequelize.transaction({ transaction: root });

        savepoint.afterCommit(() => fired.push('savepoint'));
        await savepoint.commit();
        expect(fired).to.deep.equal([]);

        await root.commit();
        expect(fired).to.deep.equal(['savepoint']);
      });

      it('drops hooks from an unmanaged savepoint that is rolled back', async function () {
        const fired = [];
        const root = await this.sequelize.transaction();
        const savepoint = await this.sequelize.transaction({ transaction: root });

        savepoint.afterCommit(() => fired.push('savepoint'));
        await savepoint.rollback();
        await root.commit();

        expect(fired).to.deep.equal([]);
      });

      it('defers hooks from an unmanaged savepoint nested via CLS', function () {
        const fired = [];

        return this.sequelize
          .transaction(async () => {
            const savepoint = await this.sequelize.transaction();

            savepoint.afterCommit(() => fired.push('savepoint'));
            await savepoint.commit();

            expect(fired).to.deep.equal([]);
          })
          .then(() => {
            expect(fired).to.deep.equal(['savepoint']);
          });
      });

      it('calls a deferred hook with the transaction it was registered on', function () {
        let received, savepoint;

        return this.sequelize
          .transaction(async (outer) => {
            await this.sequelize.transaction(async (inner) => {
              savepoint = inner;
              inner.afterCommit((transaction) => {
                received = transaction;
              });
            });

            expect(savepoint).to.not.equal(outer);
          })
          .then(() => {
            expect(received).to.equal(savepoint);
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
