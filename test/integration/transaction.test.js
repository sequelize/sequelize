'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require('./support');
const dialect = Support.getTestDialect();
const { Sequelize, QueryTypes, DataTypes, Transaction } = require('sequelize');
const sinon = require('sinon');
const current = Support.sequelize;
const delay = require('delay');
const pSettle = require('p-settle');

if (current.dialect.supports.transactions) {

  describe(Support.getTestDialectTeaser('Transaction'), () => {
    beforeEach(function() {
      this.sinon = sinon.createSandbox();
    });

    afterEach(function() {
      this.sinon.restore();
    });

    describe('constructor', () => {
      it('stores options', function() {
        const transaction = new Transaction(this.sequelize);
        expect(transaction.options).to.be.an.instanceOf(Object);
      });

      it('generates an identifier', function() {
        const transaction = new Transaction(this.sequelize);
        expect(transaction.id).to.exist;
      });

      it('should call dialect specific generateTransactionId method', function() {
        const transaction = new Transaction(this.sequelize);
        expect(transaction.id).to.exist;
        if (dialect === 'mssql') {
          expect(transaction.id).to.have.lengthOf(20);
        }
      });
    });

    describe('commit', () => {
      it('is a commit method available', () => {
        expect(Transaction).to.respondTo('commit');
      });
    });

    describe('rollback', () => {
      it('is a rollback method available', () => {
        expect(Transaction).to.respondTo('rollback');
      });
    });

    describe('autoCallback', () => {
      it('supports automatically committing', async function() {
        await this.sequelize.transaction(async () => {});
      });

      it('supports automatically rolling back with a thrown error', async function() {
        let t;

        await expect(this.sequelize.transaction(transaction => {
          t = transaction;
          throw new Error('Yolo');
        })).to.eventually.be.rejected;

        expect(t.finished).to.be.equal('rollback');
      });

      it('supports automatically rolling back with a rejection', async function() {
        let t;

        await expect(this.sequelize.transaction(async transaction => {
          t = transaction;
          throw new Error('Swag');
        })).to.eventually.be.rejected;

        expect(t.finished).to.be.equal('rollback');
      });

      it('supports running hooks when a transaction is committed', async function() {
        const hook = sinon.spy();
        let transaction;

        await expect((async () => {
          await this.sequelize.transaction(t => {
            transaction = t;
            transaction.afterCommit(hook);
            return this.sequelize.query(`SELECT 1+1${  Support.addDualInSelect()}`, { transaction, type: QueryTypes.SELECT });
          });

          expect(hook).to.have.been.calledOnce;
          expect(hook).to.have.been.calledWith(transaction);
        })()
        ).to.eventually.be.fulfilled;
      });

      it('does not run hooks when a transaction is rolled back', async function() {
        const hook = sinon.spy();

        await expect(this.sequelize.transaction(async transaction => {
          transaction.afterCommit(hook);
          throw new Error('Rollback');
        })
        ).to.eventually.be.rejected;

        expect(hook).to.not.have.been.called;
      });

      if (dialect === 'postgres') {
        // See #3689, #3726 and #6972 (https://github.com/sequelize/sequelize/pull/6972/files#diff-533eac602d424db379c3d72af5089e9345fd9d3bbe0a26344503c22a0a5764f7L75)
        it('does not try to rollback a transaction that failed upon committing with SERIALIZABLE isolation level (#3689)', async function() {
          // See https://wiki.postgresql.org/wiki/SSI

          const Dots = this.sequelize.define('dots', { color: Sequelize.STRING });
          await Dots.sync({ force: true });

          const initialData = [
            { color: 'red' },
            { color: 'green' },
            { color: 'green' },
            { color: 'red' },
            { color: 'green' },
            { color: 'red' },
            { color: 'green' },
            { color: 'green' },
            { color: 'green' },
            { color: 'red' },
            { color: 'red' },
            { color: 'red' },
            { color: 'green' },
            { color: 'red' },
            { color: 'red' },
            { color: 'red' },
            { color: 'green' },
            { color: 'red' }
          ];

          await Dots.bulkCreate(initialData);

          const isolationLevel = Transaction.ISOLATION_LEVELS.SERIALIZABLE;

          let firstTransactionGotNearCommit = false;
          let secondTransactionGotNearCommit = false;

          const firstTransaction = async () => {
            await this.sequelize.transaction({ isolationLevel }, async t => {
              await Dots.update({ color: 'red' }, {
                where: { color: 'green' },
                transaction: t
              });
              await delay(1500);
              firstTransactionGotNearCommit = true;
            });
          };

          const secondTransaction = async () => {
            await delay(500);
            await this.sequelize.transaction({ isolationLevel }, async t => {
              await Dots.update({ color: 'green' }, {
                where: { color: 'red' },
                transaction: t
              });

              // Sanity check - in this test we want this line to be reached before the
              // first transaction gets to commit
              expect(firstTransactionGotNearCommit).to.be.false;

              secondTransactionGotNearCommit = true;
            });
          };

          await expect(
            Promise.all([firstTransaction(), secondTransaction()])
          ).to.eventually.be.rejectedWith('could not serialize access due to read/write dependencies among transactions');

          expect(firstTransactionGotNearCommit).to.be.true;
          expect(secondTransactionGotNearCommit).to.be.true;

          // Only the second transaction worked
          expect(await Dots.count({ where: { color: 'red' } })).to.equal(0);
          expect(await Dots.count({ where: { color: 'green' } })).to.equal(initialData.length);
        });
      }

    });

    it('does not allow queries after commit', async function() {
      const t = await this.sequelize.transaction();
      await this.sequelize.query(`SELECT 1+1${  Support.addDualInSelect()}`, { transaction: t, raw: true });
      await t.commit();
      await expect(this.sequelize.query(`SELECT 1+1${  Support.addDualInSelect()}`, { transaction: t, raw: true })).to.be.eventually.rejectedWith(
        Error,
        /commit has been called on this transaction\([^)]+\), you can no longer use it\. \(The rejected query is attached as the 'sql' property of this error\)/
      ).and.have.deep.property('sql').that.equal(`SELECT 1+1${  Support.addDualInSelect()}`);
    });

    it('does not allow queries immediately after commit call', async function() {
      await expect((async () => {
        const t = await this.sequelize.transaction();
        await this.sequelize.query(`SELECT 1+1${  Support.addDualInSelect()}`, { transaction: t, raw: true });
        await Promise.all([
          expect(t.commit()).to.eventually.be.fulfilled,
          expect(this.sequelize.query(`SELECT 1+1${  Support.addDualInSelect()}`, { transaction: t, raw: true })).to.be.eventually.rejectedWith(
            Error,
            /commit has been called on this transaction\([^)]+\), you can no longer use it\. \(The rejected query is attached as the 'sql' property of this error\)/
          ).and.have.deep.property('sql').that.equal(`SELECT 1+1${  Support.addDualInSelect()}`)
        ]);
      })()).to.be.eventually.fulfilled;
    });

    it('does not allow queries after rollback', async function() {
      await expect(
        (async () => {
          const t = await this.sequelize.transaction();
          await this.sequelize.query('SELECT 1+1', { transaction: t, raw: true });
          await t.rollback();
          return await this.sequelize.query('SELECT 1+1', { transaction: t, raw: true });
        })()
      ).to.eventually.be.rejected;
    });

    it('should not rollback if connection was not acquired', async function() {
      this.sinon.stub(this.sequelize.connectionManager, '_connect')
        .returns(new Promise(() => {}));

      const transaction = new Transaction(this.sequelize);

      await expect(transaction.rollback())
        .to.eventually.be.rejectedWith('Transaction cannot be rolled back because it never started');
    });

    it('does not allow queries immediately after rollback call', async function() {
      await expect(
        this.sequelize.transaction().then(async t => {
          await Promise.all([
            expect(t.rollback()).to.eventually.be.fulfilled,
            expect(this.sequelize.query('SELECT 1+1', { transaction: t, raw: true })).to.be.eventually.rejectedWith(
              Error,
              /rollback has been called on this transaction\([^)]+\), you can no longer use it\. \(The rejected query is attached as the 'sql' property of this error\)/
            ).and.have.deep.property('sql').that.equal('SELECT 1+1')
          ]);
        })
      ).to.eventually.be.fulfilled;
    });

    it('does not allow commits after commit', async function() {
      await expect(
        (async () => {
          const t = await this.sequelize.transaction();
          await t.commit();
          return await t.commit();
        })()
      ).to.be.rejectedWith('Transaction cannot be committed because it has been finished with state: commit');
    });

    it('should run hooks if a non-auto callback transaction is committed', async function() {
      const hook = sinon.spy();
      let transaction;

      await expect(
        (async () => {
          try {
            const t = await this.sequelize.transaction();
            transaction = t;
            transaction.afterCommit(hook);
            await t.commit();
            expect(hook).to.have.been.calledOnce;
            expect(hook).to.have.been.calledWith(t);
          } catch (err) {
            // Cleanup this transaction so other tests don't
            // fail due to an open transaction
            if (!transaction.finished) {
              await transaction.rollback();
              throw err;
            }
            throw err;
          }
        })()
      ).to.eventually.be.fulfilled;
    });

    it('should not run hooks if a non-auto callback transaction is rolled back', async function() {
      const hook = sinon.spy();

      await expect(
        (async () => {
          const t = await this.sequelize.transaction();
          t.afterCommit(hook);
          await t.rollback();
          expect(hook).to.not.have.been.called;
        })()
      ).to.eventually.be.fulfilled;
    });

    it('should throw an error if null is passed to afterCommit', async function() {
      const hook = null;
      let transaction;

      await expect(
        (async () => {
          try {
            const t = await this.sequelize.transaction();
            transaction = t;
            transaction.afterCommit(hook);
            return await t.commit();
          } catch (err) {
            // Cleanup this transaction so other tests don't
            // fail due to an open transaction
            if (!transaction.finished) {
              await transaction.rollback();
              throw err;
            }
            throw err;
          }
        })()
      ).to.eventually.be.rejectedWith('"fn" must be a function');
    });

    it('should throw an error if undefined is passed to afterCommit', async function() {
      const hook = undefined;
      let transaction;

      await expect(
        (async () => {
          try {
            const t = await this.sequelize.transaction();
            transaction = t;
            transaction.afterCommit(hook);
            return await t.commit();
          } catch (err) {
            // Cleanup this transaction so other tests don't
            // fail due to an open transaction
            if (!transaction.finished) {
              await transaction.rollback();
              throw err;
            }
            throw err;
          }
        })()
      ).to.eventually.be.rejectedWith('"fn" must be a function');
    });

    it('should throw an error if an object is passed to afterCommit', async function() {
      const hook = {};
      let transaction;

      await expect(
        (async () => {
          try {
            const t = await this.sequelize.transaction();
            transaction = t;
            transaction.afterCommit(hook);
            return await t.commit();
          } catch (err) {
            // Cleanup this transaction so other tests don't
            // fail due to an open transaction
            if (!transaction.finished) {
              await transaction.rollback();
              throw err;
            }
            throw err;
          }
        })()
      ).to.eventually.be.rejectedWith('"fn" must be a function');
    });

    it('does not allow commits after rollback', async function() {
      await expect((async () => {
        const t = await this.sequelize.transaction();
        await t.rollback();
        return await t.commit();
      })()).to.be.rejectedWith('Transaction cannot be committed because it has been finished with state: rollback');
    });

    it('does not allow rollbacks after commit', async function() {
      await expect((async () => {
        const t = await this.sequelize.transaction();
        await t.commit();
        return await t.rollback();
      })()).to.be.rejectedWith('Transaction cannot be rolled back because it has been finished with state: commit');
    });

    it('does not allow rollbacks after rollback', async function() {
      await expect((async () => {
        const t = await this.sequelize.transaction();
        await t.rollback();
        return await t.rollback();
      })()).to.be.rejectedWith('Transaction cannot be rolled back because it has been finished with state: rollback');
    });

    it('works even if a transaction: null option is passed', async function() {
      this.sinon.spy(this.sequelize, 'query');

      const t = await this.sequelize.transaction({
        transaction: null
      });

      await t.commit();
      expect(this.sequelize.query.callCount).to.be.greaterThan(0);

      for (let i = 0; i < this.sequelize.query.callCount; i++) {
        expect(this.sequelize.query.getCall(i).args[1].transaction).to.equal(t);
      }
    });

    it('works even if a transaction: undefined option is passed', async function() {
      this.sinon.spy(this.sequelize, 'query');

      const t = await this.sequelize.transaction({
        transaction: undefined
      });

      await t.commit();
      expect(this.sequelize.query.callCount).to.be.greaterThan(0);

      for (let i = 0; i < this.sequelize.query.callCount; i++) {
        expect(this.sequelize.query.getCall(i).args[1].transaction).to.equal(t);
      }
    });

    if (['mysql', 'mariadb'].includes(dialect)) {
      // Both MariaDB and MySQL (probably innoDB) seem to have changed the way they handle this deadlock
      //  and the deadlock does not occur anymore.
      // We have not managed to recreate this deadlock and, for now, are disabling this test.
      // See https://github.com/sequelize/sequelize/issues/14174
      describe.skip('deadlock handling', () => {
        // Create the `Task` table and ensure it's initialized with 2 rows
        const getAndInitializeTaskModel = async sequelize => {
          const Task = sequelize.define('task', {
            id: {
              type: Sequelize.INTEGER,
              primaryKey: true
            }
          });

          await sequelize.sync({ force: true });
          await Task.create({ id: 0 });
          await Task.create({ id: 1 });
          return Task;
        };

        // Lock the row with id of `from`, and then try to update the row
        // with id of `to`
        const update = async (sequelize, Task, from, to) => {
          await sequelize
            .transaction(async transaction => {
              try {
                try {
                  await Task.findAll({
                    where: { id: { [Sequelize.Op.eq]: from } },
                    lock: transaction.LOCK.UPDATE,
                    transaction
                  });

                  await delay(10);

                  await Task.update(
                    { id: to },
                    {
                      where: { id: { [Sequelize.Op.ne]: to } },
                      lock: transaction.LOCK.UPDATE,
                      transaction
                    }
                  );
                } catch (e) {
                  console.log(e.message);
                }

                await Task.create({ id: 2 }, { transaction });
              } catch (e) {
                console.log(e.message);
              }

              throw new Error('Rollback!');
            })
            .catch(() => {});
        };

        it('should treat deadlocked transaction as rollback', async function() {
          const Task = await getAndInitializeTaskModel(this.sequelize);

          // This gets called twice simultaneously, and we expect at least one of the calls to encounter a
          // deadlock (which effectively rolls back the active transaction).
          // We only expect createTask() to insert rows if a transaction is active.  If deadlocks are handled
          // properly, it should only execute a query if we're actually inside a real transaction.  If it does
          // execute a query, we expect the newly-created rows to be destroyed when we forcibly rollback by
          // throwing an error.
          // tl;dr; This test is designed to ensure that this function never inserts and commits a new row.
          await Promise.all([update(this.sequelize, Task, 1, 0), update(this.sequelize, Task, 0, 1)]);

          const count = await Task.count();
          // If we were actually inside a transaction when we called `Task.create({ id: 2 })`, no new rows should be added.
          expect(count).to.equal(2, 'transactions were fully rolled-back, and no new rows were added');
        });

        it('should release the connection for a deadlocked transaction (1/2)', async function() {
          const Task = await getAndInitializeTaskModel(this.sequelize);

          // 1 of 2 queries should deadlock and be rolled back by InnoDB
          this.sinon.spy(this.sequelize.connectionManager, 'releaseConnection');
          await Promise.all([update(this.sequelize, Task, 1, 0), update(this.sequelize, Task, 0, 1)]);

          // Verify that both of the connections were released
          expect(this.sequelize.connectionManager.releaseConnection.callCount).to.equal(2);

          // Verify that a follow-up READ_COMMITTED works as expected.
          // For unknown reasons, we need to explicitly rollback on MariaDB,
          // even though the transaction should've automatically been rolled
          // back.
          // Otherwise, this READ_COMMITTED doesn't work as expected.
          const User = this.sequelize.define('user', {
            username: Support.Sequelize.STRING
          });
          await this.sequelize.sync({ force: true });
          await this.sequelize.transaction(
            { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
            async transaction => {
              const users0 = await User.findAll({ transaction });
              expect(users0).to.have.lengthOf(0);
              await User.create({ username: 'jan' }); // Create a User outside of the transaction
              const users = await User.findAll({ transaction });
              expect(users).to.have.lengthOf(1); // We SHOULD see the created user inside the transaction
            }
          );
        });

        it('should release the connection for a deadlocked transaction (2/2)', async function() {
          // TODO [>=2022-06-01]: The following code is supposed to cause a deadlock in MariaDB,
          //  but starting with MariaDB 10.5.15, this does not happen anymore.
          //  We think it may be a bug in MariaDB, so we temporarily disable this test for that specific version
          //  If this still happens on newer releases, update this check, or look into why this is not working.
          //  See https://github.com/sequelize/sequelize/issues/14174
          if (dialect === 'mariadb' && this.sequelize.options.databaseVersion === '10.5.15') {
            return;
          }

          const verifyDeadlock = async () => {
            const User = this.sequelize.define('user', {
              username: DataTypes.STRING,
              awesome: DataTypes.BOOLEAN
            }, { timestamps: false });

            await this.sequelize.sync({ force: true });
            const { id } = await User.create({ username: 'jan' });

            // First, we start a transaction T1 and perform a SELECT with it using the `LOCK.SHARE` mode (setting a shared mode lock on the row).
            // This will cause other sessions to be able to read the row but not modify it.
            // So, if another transaction tries to update those same rows, it will wait until T1 commits (or rolls back).
            // https://dev.mysql.com/doc/refman/5.7/en/innodb-locking-reads.html
            const t1 = await this.sequelize.transaction();
            const t1Jan = await User.findByPk(id, { lock: t1.LOCK.SHARE, transaction: t1 });

            // Then we start another transaction T2 and see that it can indeed read the same row.
            const t2 = await this.sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED });
            const t2Jan = await User.findByPk(id, { transaction: t2 });

            // Then, we want to see that an attempt to update that row from T2 will be queued until T1 commits.
            // However, before commiting T1 we will also perform an update via T1 on the same rows.
            // This should cause T2 to notice that it can't function anymore, so it detects a deadlock and automatically rolls itself back (and throws an error).
            // Meanwhile, T1 should still be ok.
            const executionOrder = [];
            const [t2AttemptData, t1AttemptData] = await pSettle([
              (async () => {
                try {
                  executionOrder.push('Begin attempt to update via T2');
                  await t2Jan.update({ awesome: false }, { transaction: t2 });
                  executionOrder.push('Done updating via T2'); // Shouldn't happen
                } catch (error) {
                  executionOrder.push('Failed to update via T2');
                  throw error;
                }

                await delay(30);

                try {
                  // We shouldn't reach this point, but if we do, let's at least commit the transaction
                  // to avoid forever occupying one connection of the pool with a pending transaction.
                  executionOrder.push('Attempting to commit T2');
                  await t2.commit();
                  executionOrder.push('Done committing T2');
                } catch {
                  executionOrder.push('Failed to commit T2');
                }
              })(),
              (async () => {
                await delay(100);

                try {
                  executionOrder.push('Begin attempt to update via T1');
                  await t1Jan.update({ awesome: true }, { transaction: t1 });
                  executionOrder.push('Done updating via T1');
                } catch (error) {
                  executionOrder.push('Failed to update via T1'); // Shouldn't happen
                  throw error;
                }

                await delay(150);

                try {
                  executionOrder.push('Attempting to commit T1');
                  await t1.commit();
                  executionOrder.push('Done committing T1');
                } catch {
                  executionOrder.push('Failed to commit T1'); // Shouldn't happen
                }
              })()
            ]);

            expect(t1AttemptData.isFulfilled).to.be.true;
            expect(t2AttemptData.isRejected).to.be.true;
            expect(t2AttemptData.reason.message).to.include('Deadlock found when trying to get lock; try restarting transaction');
            expect(t1.finished).to.equal('commit');
            expect(t2.finished).to.equal('rollback');

            const expectedExecutionOrder = [
              'Begin attempt to update via T2',
              'Begin attempt to update via T1', // 100ms after
              'Done updating via T1', // right after
              'Failed to update via T2', // right after
              'Attempting to commit T1', // 150ms after
              'Done committing T1' // right after
            ];

            // The order things happen in the database must be the one shown above. However, sometimes it can happen that
            // the calls in the JavaScript event loop that are communicating with the database do not match exactly this order.
            // In particular, it is possible that the JS event loop logs `'Failed to update via T2'` before logging `'Done updating via T1'`,
            // even though the database updated T1 first (and then rushed to declare a deadlock for T2).

            const anotherAcceptableExecutionOrderFromJSPerspective = [
              'Begin attempt to update via T2',
              'Begin attempt to update via T1', // 100ms after
              'Failed to update via T2', // right after
              'Done updating via T1', // right after
              'Attempting to commit T1', // 150ms after
              'Done committing T1' // right after
            ];

            const executionOrderOk = Support.isDeepEqualToOneOf(
              executionOrder,
              [
                expectedExecutionOrder,
                anotherAcceptableExecutionOrderFromJSPerspective
              ]
            );

            if (!executionOrderOk) {
              throw new Error(`Unexpected execution order: ${executionOrder.join(' > ')}`);
            }
          };

          for (let i = 0; i < 3 * Support.getPoolMax(); i++) {
            await verifyDeadlock();
            await delay(10);
          }
        });
      });
    }

    if (dialect === 'sqlite') {
      it('provides persistent transactions', async () => {
        const sequelize = new Support.Sequelize('database', 'username', 'password', { dialect: 'sqlite' }),
          User = sequelize.define('user', {
            username: Support.Sequelize.STRING,
            awesome: Support.Sequelize.BOOLEAN
          });

        const t1 = await sequelize.transaction();
        await sequelize.sync({ transaction: t1 });
        const t0 = t1;
        await User.create({}, { transaction: t0 });
        await t0.commit();
        const persistentTransaction = await sequelize.transaction();
        const users = await User.findAll({ transaction: persistentTransaction });
        expect(users.length).to.equal(1);

        await persistentTransaction.commit();
      });
    }

    if (current.dialect.supports.transactionOptions.type) {
      describe('transaction types', () => {
        it('should support default transaction type DEFERRED', async function() {
          const t = await this.sequelize.transaction({
          });

          await t.rollback();
          expect(t.options.type).to.equal('DEFERRED');
        });

        Object.keys(Transaction.TYPES).forEach(key => {
          it(`should allow specification of ${key} type`, async function() {
            const t = await this.sequelize.transaction({
              type: key
            });

            await t.rollback();
            expect(t.options.type).to.equal(Transaction.TYPES[key]);
          });
        });

      });

    }

    if (dialect === 'sqlite') {
      it('automatically retries on SQLITE_BUSY failure', async function() {
        const sequelize = await Support.prepareTransactionTest(this.sequelize);
        const User = sequelize.define('User', { username: Support.Sequelize.STRING });
        await User.sync({ force: true });
        const newTransactionFunc = async function() {
          const t = await sequelize.transaction({ type: Support.Sequelize.Transaction.TYPES.EXCLUSIVE });
          await User.create({}, { transaction: t });
          return t.commit();
        };
        await Promise.all([newTransactionFunc(), newTransactionFunc()]);
        const users = await User.findAll();
        expect(users.length).to.equal(2);
      });

      it('fails with SQLITE_BUSY when retry.match is changed', async function() {
        const sequelize = await Support.prepareTransactionTest(this.sequelize);
        const User = sequelize.define('User', { id: { type: Support.Sequelize.INTEGER, primaryKey: true }, username: Support.Sequelize.STRING });
        await User.sync({ force: true });
        const newTransactionFunc = async function() {
          const t = await sequelize.transaction({ type: Support.Sequelize.Transaction.TYPES.EXCLUSIVE, retry: { match: ['NO_MATCH'] } });
          // introduce delay to force the busy state race condition to fail
          await delay(1000);
          await User.create({ id: null, username: `test ${t.id}` }, { transaction: t });
          return t.commit();
        };
        await expect(Promise.all([newTransactionFunc(), newTransactionFunc()])).to.be.rejectedWith('SQLITE_BUSY: database is locked');
      });

    }

    describe('isolation levels', () => {
      it('should read the most recent committed rows when using the READ COMMITTED isolation level', async function() {
        const User = this.sequelize.define('user', {
          username: Support.Sequelize.STRING
        });

        await expect(
          this.sequelize.sync({ force: true }).then(() => {
            return this.sequelize.transaction(
              { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
              async transaction => {
                const users0 = await User.findAll({ transaction });
                expect(users0).to.have.lengthOf(0);
                await User.create({ username: 'jan' }); // Create a User outside of the transaction
                const users = await User.findAll({ transaction });
                expect(users).to.have.lengthOf(1); // We SHOULD see the created user inside the transaction
              }
            );
          })
        ).to.eventually.be.fulfilled;
      });

      // mssql is excluded because it implements REPREATABLE READ using locks rather than a snapshot, and will see the new row
      if (!['sqlite', 'mssql', 'db2'].includes(dialect)) {
        it('should not read newly committed rows when using the REPEATABLE READ isolation level', async function() {
          const User = this.sequelize.define('user', {
            username: Support.Sequelize.STRING
          });

          await expect(
            this.sequelize.sync({ force: true }).then(() => {
              return this.sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.REPEATABLE_READ }, async transaction => {
                const users0 = await User.findAll({ transaction });
                await expect( users0 ).to.have.lengthOf(0);
                await User.create({ username: 'jan' }); // Create a User outside of the transaction
                const users = await User.findAll({ transaction });
                return expect( users ).to.have.lengthOf(0); // We SHOULD NOT see the created user inside the transaction
              });
            })
          ).to.eventually.be.fulfilled;
        });
      }

      // PostgreSQL is excluded because it detects Serialization Failure on commit instead of acquiring locks on the read rows
      if (!['sqlite', 'postgres', 'postgres-native', 'db2', 'oracle'].includes(dialect)) {
        it('should block updates after reading a row using SERIALIZABLE', async function() {
          const User = this.sequelize.define('user', {
              username: Support.Sequelize.STRING
            }),
            transactionSpy = sinon.spy();

          await this.sequelize.sync({ force: true });
          await User.create({ username: 'jan' });
          const transaction = await this.sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.SERIALIZABLE });
          await User.findAll( { transaction } );

          await Promise.all([
            // Update should not succeed before transaction has committed
            User.update({ username: 'joe' }, {
              where: {
                username: 'jan'
              }
            }).then(() => {
              expect(transactionSpy).to.have.been.called;
              expect(transaction.finished).to.equal('commit');
            }),

            delay(4000)
              .then(transactionSpy)
              .then(() => transaction.commit())
          ]);
        });
      }

    });


    if (current.dialect.supports.lock) {
      describe('row locking', () => {
        it('supports for update', async function() {
          const User = this.sequelize.define('user', {
              username: Support.Sequelize.STRING,
              awesome: Support.Sequelize.BOOLEAN
            }),
            t1Spy = sinon.spy(),
            t2Spy = sinon.spy();

          await this.sequelize.sync({ force: true });
          await User.create({ username: 'jan' });
          const t1 = await this.sequelize.transaction();

          const t1Jan = await User.findOne({
            where: {
              username: 'jan'
            },
            lock: t1.LOCK.UPDATE,
            transaction: t1
          });

          const t2 = await this.sequelize.transaction({
            isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED
          });

          await Promise.all([(async () => {
            await User.findOne({
              where: {
                username: 'jan'
              },
              lock: t2.LOCK.UPDATE,
              transaction: t2
            });

            t2Spy();
            await t2.commit();
            expect(t2Spy).to.have.been.calledAfter(t1Spy); // Find should not succeed before t1 has committed
          })(), (async () => {
            await t1Jan.update({
              awesome: true
            }, {
              transaction: t1
            });

            t1Spy();
            await delay(2000);
            return await t1.commit();
          })()]);
        });

        if (current.dialect.supports.skipLocked) {
          it('supports for update with skip locked', async function() {
            const User = this.sequelize.define('user', {
              username: Support.Sequelize.STRING,
              awesome: Support.Sequelize.BOOLEAN
            });

            await this.sequelize.sync({ force: true });

            await Promise.all([
              User.create(
                { username: 'jan' }
              ),
              User.create(
                { username: 'joe' }
              )
            ]);

            const t1 = await this.sequelize.transaction();

            const results = await User.findAll({
              limit: 1,
              lock: true,
              transaction: t1
            });

            const firstUserId = results[0].id;
            const t2 = await this.sequelize.transaction();

            const secondResults = await User.findAll({
              limit: 1,
              lock: true,
              skipLocked: true,
              transaction: t2
            });

            expect(secondResults[0].id).to.not.equal(firstUserId);

            await Promise.all([
              t1.commit(),
              t2.commit()
            ]);
          });
        }

        it('fail locking with outer joins', async function() {
          const User = this.sequelize.define('User', { username: Support.Sequelize.STRING }),
            Task = this.sequelize.define('Task', { title: Support.Sequelize.STRING, active: Support.Sequelize.BOOLEAN });

          User.belongsToMany(Task, { through: 'UserTasks' });
          Task.belongsToMany(User, { through: 'UserTasks' });

          await this.sequelize.sync({ force: true });

          const [john, task1] = await Promise.all([
            User.create({ username: 'John' }),
            Task.create({ title: 'Get rich', active: false })
          ]);

          await john.setTasks([task1]);

          await this.sequelize.transaction(t1 => {

            if (current.dialect.supports.lockOuterJoinFailure) {

              return expect(User.findOne({
                where: {
                  username: 'John'
                },
                include: [Task],
                lock: t1.LOCK.UPDATE,
                transaction: t1
              })).to.be.rejectedWith('FOR UPDATE cannot be applied to the nullable side of an outer join');
            }

            return User.findOne({
              where: {
                username: 'John'
              },
              include: [Task],
              lock: t1.LOCK.UPDATE,
              transaction: t1
            });
          });
        });

        if (current.dialect.supports.lockOf) {
          it('supports for update of table', async function() {
            const User = this.sequelize.define('User', { username: Support.Sequelize.STRING }, { tableName: 'Person' }),
              Task = this.sequelize.define('Task', { title: Support.Sequelize.STRING, active: Support.Sequelize.BOOLEAN });

            User.belongsToMany(Task, { through: 'UserTasks' });
            Task.belongsToMany(User, { through: 'UserTasks' });

            await this.sequelize.sync({ force: true });

            const [john, task1] = await Promise.all([
              User.create({ username: 'John' }),
              Task.create({ title: 'Get rich', active: false }),
              Task.create({ title: 'Die trying', active: false })
            ]);

            await john.setTasks([task1]);

            await this.sequelize.transaction(async t1 => {
              const t1John = await User.findOne({
                where: {
                  username: 'John'
                },
                include: [Task],
                lock: {
                  level: t1.LOCK.UPDATE,
                  of: User
                },
                transaction: t1
              });

              // should not be blocked by the lock of the other transaction
              await this.sequelize.transaction(t2 => {
                return Task.update({
                  active: true
                }, {
                  where: {
                    active: false
                  },
                  transaction: t2
                });
              });

              return t1John.save({
                transaction: t1
              });
            });
          });
        }

        if (current.dialect.supports.lockKey) {
          it('supports for key share', async function() {
            const User = this.sequelize.define('user', {
                username: Support.Sequelize.STRING,
                awesome: Support.Sequelize.BOOLEAN
              }),
              t1Spy = sinon.spy(),
              t2Spy = sinon.spy();

            await this.sequelize.sync({ force: true });
            await User.create({ username: 'jan' });
            const t1 = await this.sequelize.transaction();

            const t1Jan = await User.findOne({
              where: {
                username: 'jan'
              },
              lock: t1.LOCK.NO_KEY_UPDATE,
              transaction: t1
            });

            const t2 = await this.sequelize.transaction();

            await Promise.all([(async () => {
              await User.findOne({
                where: {
                  username: 'jan'
                },
                lock: t2.LOCK.KEY_SHARE,
                transaction: t2
              });

              t2Spy();
              return await t2.commit();
            })(), (async () => {
              await t1Jan.update({
                awesome: true
              }, {
                transaction: t1
              });

              await delay(2000);
              t1Spy();
              expect(t1Spy).to.have.been.calledAfter(t2Spy);
              return await t1.commit();
            })()]);
          });
        }

        it('supports for share (i.e. `SELECT ... LOCK IN SHARE MODE`)', async function() {
          const verifySelectLockInShareMode = async () => {
            const User = this.sequelize.define('user', {
              username: DataTypes.STRING,
              awesome: DataTypes.BOOLEAN
            }, { timestamps: false });

            await this.sequelize.sync({ force: true });
            const { id } = await User.create({ username: 'jan' });

            // First, we start a transaction T1 and perform a SELECT with it using the `LOCK.SHARE` mode (setting a shared mode lock on the row).
            // This will cause other sessions to be able to read the row but not modify it.
            // So, if another transaction tries to update those same rows, it will wait until T1 commits (or rolls back).
            // https://dev.mysql.com/doc/refman/5.7/en/innodb-locking-reads.html
            const t1 = await this.sequelize.transaction();
            await User.findByPk(id, { lock: t1.LOCK.SHARE, transaction: t1 });

            // Then we start another transaction T2 and see that it can indeed read the same row.
            const t2 = await this.sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED });
            const t2Jan = await User.findByPk(id, { transaction: t2 });

            // Then, we want to see that an attempt to update that row from T2 will be queued until T1 commits.
            const executionOrder = [];
            const [t2AttemptData, t1AttemptData] = await pSettle([
              (async () => {
                try {
                  executionOrder.push('Begin attempt to update via T2');
                  await t2Jan.update({ awesome: false }, { transaction: t2 });
                  executionOrder.push('Done updating via T2');
                } catch (error) {
                  executionOrder.push('Failed to update via T2'); // Shouldn't happen
                  throw error;
                }

                await delay(30);

                try {
                  executionOrder.push('Attempting to commit T2');
                  await t2.commit();
                  executionOrder.push('Done committing T2');
                } catch {
                  executionOrder.push('Failed to commit T2'); // Shouldn't happen
                }
              })(),
              (async () => {
                await delay(100);

                try {
                  executionOrder.push('Begin attempt to read via T1');
                  await User.findAll({ transaction: t1 });
                  executionOrder.push('Done reading via T1');
                } catch (error) {
                  executionOrder.push('Failed to read via T1'); // Shouldn't happen
                  throw error;
                }

                await delay(150);

                try {
                  executionOrder.push('Attempting to commit T1');
                  await t1.commit();
                  executionOrder.push('Done committing T1');
                } catch {
                  executionOrder.push('Failed to commit T1'); // Shouldn't happen
                }
              })()
            ]);

            expect(t1AttemptData.isFulfilled).to.be.true;
            expect(t2AttemptData.isFulfilled).to.be.true;
            expect(t1.finished).to.equal('commit');
            expect(t2.finished).to.equal('commit');

            const expectedExecutionOrder = [
              'Begin attempt to update via T2',
              'Begin attempt to read via T1', // 100ms after
              'Done reading via T1', // right after
              'Attempting to commit T1', // 150ms after
              'Done committing T1', // right after
              'Done updating via T2', // right after
              'Attempting to commit T2', // 30ms after
              'Done committing T2' // right after
            ];

            // The order things happen in the database must be the one shown above. However, sometimes it can happen that
            // the calls in the JavaScript event loop that are communicating with the database do not match exactly this order.
            // In particular, it is possible that the JS event loop logs `'Done updating via T2'` before logging `'Done committing T1'`,
            // even though the database committed T1 first (and then rushed to complete the pending update query from T2).

            const anotherAcceptableExecutionOrderFromJSPerspective = [
              'Begin attempt to update via T2',
              'Begin attempt to read via T1', // 100ms after
              'Done reading via T1', // right after
              'Attempting to commit T1', // 150ms after
              'Done updating via T2', // right after
              'Done committing T1', // right after
              'Attempting to commit T2', // 30ms after
              'Done committing T2' // right after
            ];

            const executionOrderOk = Support.isDeepEqualToOneOf(
              executionOrder,
              [
                expectedExecutionOrder,
                anotherAcceptableExecutionOrderFromJSPerspective
              ]
            );

            if (!executionOrderOk) {
              throw new Error(`Unexpected execution order: ${executionOrder.join(' > ')}`);
            }
          };

          for (let i = 0; i < 3 * Support.getPoolMax(); i++) {
            await verifySelectLockInShareMode();
            await delay(10);
          }
        });
      });
    }
  });
}
