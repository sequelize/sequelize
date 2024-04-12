import type { InferAttributes, InferCreationAttributes } from '@sequelize/core';
import {
  ConstraintChecking,
  DataTypes,
  IsolationLevel,
  Model,
  Transaction,
  TransactionNestMode,
  TransactionType,
} from '@sequelize/core';
import { Attribute, NotNull } from '@sequelize/core/decorators-legacy';
import { assert, expect } from 'chai';
import delay from 'delay';
import type { SinonStub } from 'sinon';
import sinon from 'sinon';
import {
  beforeAll2,
  createMultiTransactionalTestSequelizeInstance,
  createSingleTransactionalTestSequelizeInstance,
  getTestDialect,
  getTestDialectTeaser,
  sequelize,
  setResetMode,
} from '../support';

const dialectName = sequelize.dialect.name;

describe(getTestDialectTeaser('Sequelize#transaction'), () => {
  if (!sequelize.dialect.supports.transactions) {
    return;
  }

  let stubs: SinonStub[] = [];

  afterEach(() => {
    for (const stub of stubs) {
      stub.restore();
    }

    stubs = [];
  });

  describe('nested managed transactions', () => {
    it('reuses the parent transaction by default', async () => {
      await sequelize.transaction(async transaction1 => {
        await sequelize.transaction({ transaction: transaction1 }, async transaction2 => {
          expect(transaction1 === transaction2).to.equal(
            true,
            'transaction1 and transaction2 should be the same',
          );
        });
      });
    });

    it('requires compatible options if nestMode is set to "reuse"', async () => {
      await sequelize.transaction(async transaction1 => {
        if (sequelize.dialect.supports.startTransaction.transactionType) {
          await expect(
            sequelize.transaction(
              { transaction: transaction1, type: TransactionType.EXCLUSIVE },
              async () => {
                /* noop */
              },
            ),
          ).to.be.rejectedWith(
            'Requested transaction type (EXCLUSIVE) is not compatible with the one of the existing transaction (DEFERRED)',
          );
        } else {
          await expect(
            sequelize.transaction(
              { transaction: transaction1, type: TransactionType.EXCLUSIVE },
              async () => {
                /* noop */
              },
            ),
          ).to.be.rejectedWith(
            `The ${sequelize.dialect.name} dialect does not support transaction types.`,
          );
        }

        await expect(
          sequelize.transaction(
            { transaction: transaction1, isolationLevel: IsolationLevel.READ_UNCOMMITTED },
            async () => {
              /* noop */
            },
          ),
        ).to.be.rejectedWith(
          'Requested isolation level (READ UNCOMMITTED) is not compatible with the one of the existing transaction (unspecified)',
        );

        await expect(
          sequelize.transaction(
            { transaction: transaction1, constraintChecking: ConstraintChecking.IMMEDIATE },
            async () => {
              /* noop */
            },
          ),
        ).to.be.rejectedWith(
          'Requested transaction constraintChecking (IMMEDIATE) is not compatible with the one of the existing transaction (none)',
        );

        await expect(
          sequelize.transaction({ transaction: transaction1, readOnly: true }, async () => {
            /* noop */
          }),
        ).to.be.rejectedWith(
          'Requested a transaction in read-only mode, which is not compatible with the existing read/write transaction',
        );
      });
    });

    it('creates a savepoint if nestMode is set to "savepoint"', async () => {
      await sequelize.transaction(async transaction1 => {
        await sequelize.transaction(
          { transaction: transaction1, nestMode: TransactionNestMode.savepoint },
          async transaction2 => {
            expect(transaction1 === transaction2).to.equal(
              false,
              'transaction1 and transaction2 should not be the same',
            );
            expect(transaction2.parent === transaction1).to.equal(
              true,
              'transaction2.parent should be transaction1',
            );
          },
        );
      });
    });

    it('requires compatible options if nestMode is set to "savepoint"', async () => {
      await sequelize.transaction(async transaction1 => {
        const commonOptions = {
          transaction: transaction1,
          nestMode: TransactionNestMode.savepoint,
        };

        if (sequelize.dialect.supports.startTransaction.transactionType) {
          await expect(
            sequelize.transaction(
              { ...commonOptions, type: TransactionType.EXCLUSIVE },
              async () => {
                /* noop */
              },
            ),
          ).to.be.rejectedWith(
            'Requested transaction type (EXCLUSIVE) is not compatible with the one of the existing transaction (DEFERRED)',
          );
        } else {
          await expect(
            sequelize.transaction(
              { ...commonOptions, type: TransactionType.EXCLUSIVE },
              async () => {
                /* noop */
              },
            ),
          ).to.be.rejectedWith(
            `The ${sequelize.dialect.name} dialect does not support transaction types.`,
          );
        }

        await expect(
          sequelize.transaction(
            { ...commonOptions, isolationLevel: IsolationLevel.READ_UNCOMMITTED },
            async () => {
              /* noop */
            },
          ),
        ).to.be.rejectedWith(
          'Requested isolation level (READ UNCOMMITTED) is not compatible with the one of the existing transaction (unspecified)',
        );

        await expect(
          sequelize.transaction(
            { ...commonOptions, constraintChecking: ConstraintChecking.IMMEDIATE },
            async () => {
              /* noop */
            },
          ),
        ).to.be.rejectedWith(
          'Requested transaction constraintChecking (IMMEDIATE) is not compatible with the one of the existing transaction (none)',
        );

        await expect(
          sequelize.transaction({ ...commonOptions, readOnly: true }, async () => {
            /* noop */
          }),
        ).to.be.rejectedWith(
          'Requested a transaction in read-only mode, which is not compatible with the existing read/write transaction',
        );
      });
    });

    // sqlite cannot have more than one transaction at the same time, so separate is not available.
    if (dialectName !== 'sqlite3') {
      it('creates a new transaction if nestMode is set to "separate"', async () => {
        await sequelize.transaction(async transaction1 => {
          await sequelize.transaction(
            { transaction: transaction1, nestMode: TransactionNestMode.separate },
            async transaction2 => {
              expect(transaction1 === transaction2).to.equal(
                false,
                'transaction1 and transaction2 should not be the same',
              );
              expect(transaction1.parent === null).to.equal(
                true,
                'transaction1.parent should be null',
              );
              expect(transaction2.parent === null).to.equal(
                true,
                'transaction2.parent should be null',
              );
            },
          );
        });
      });

      it('does not care about option compatibility when nestMode is set to "separate"', async () => {
        await sequelize.transaction(async transaction1 => {
          await sequelize.transaction(
            {
              transaction: transaction1,
              nestMode: TransactionNestMode.separate,
              type: sequelize.dialect.supports.startTransaction.transactionType
                ? TransactionType.EXCLUSIVE
                : undefined,
              isolationLevel: IsolationLevel.READ_UNCOMMITTED,
              constraintChecking: sequelize.dialect.supports.constraints.deferrable
                ? ConstraintChecking.DEFERRED
                : undefined,
              readOnly: true,
            },
            async () => {
              /* noop */
            },
          );
        });
      });
    }

    it(`defaults nestMode to sequelize's defaultTransactionNestMode option`, async () => {
      const customSequelize = await createSingleTransactionalTestSequelizeInstance(sequelize, {
        defaultTransactionNestMode: TransactionNestMode.savepoint,
      });

      await customSequelize.transaction(async transaction1 => {
        await customSequelize.transaction({ transaction: transaction1 }, async transaction2 => {
          expect(transaction1 === transaction2).to.equal(
            false,
            'transaction1 and transaction2 should not be the same',
          );
          expect(transaction2.parent === transaction1).to.equal(
            true,
            'transaction2.parent should be transaction1',
          );
        });
      });
    });
  });

  describe('Isolation Levels', () => {
    setResetMode('truncate');
    const vars = beforeAll2(async () => {
      const transactionSequelize = await createMultiTransactionalTestSequelizeInstance(sequelize);

      class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
        @Attribute(DataTypes.STRING)
        @NotNull
        declare name: string;

        @Attribute(DataTypes.INTEGER)
        @NotNull
        declare age: number;
      }

      transactionSequelize.addModels([User]);

      await transactionSequelize.sync({ force: true });

      return { transactionSequelize, User };
    });

    after(async () => {
      return vars.transactionSequelize.close();
    });

    beforeEach(async () => {
      await vars.User.create({ name: 'John Doe', age: 21 });
    });

    if (sequelize.dialect.supports.settingIsolationLevelDuringTransaction) {
      it('should allow setting the isolation level during a transaction', async () => {
        const { User, transactionSequelize } = vars;

        await transactionSequelize.transaction(async transaction => {
          await transaction.setIsolationLevel(IsolationLevel.READ_UNCOMMITTED);
          await User.update({ age: 22 }, { where: { name: 'John Doe' }, transaction });
        });

        if (dialectName !== 'sqlite3') {
          await transactionSequelize.transaction(async transaction => {
            await transaction.setIsolationLevel(IsolationLevel.READ_COMMITTED);
            const johnDoe = await User.findOne({ where: { name: 'John Doe' }, transaction });
            assert(johnDoe, 'John Doe should exist');
            expect(johnDoe.age).to.equal(22);
          });

          await transactionSequelize.transaction(async transaction => {
            await transaction.setIsolationLevel(IsolationLevel.REPEATABLE_READ);
            const users = await User.findAll({ transaction });
            expect(users.length).to.equal(1);
            expect(users[0].name).to.equal('John Doe');
            expect(users[0].age).to.equal(22);
          });
        }

        await transactionSequelize.transaction(async transaction => {
          await transaction.setIsolationLevel(IsolationLevel.SERIALIZABLE);
          await User.create({ name: 'Jane Doe', age: 21 }, { transaction });
        });
      });
    }

    // SQLite only supports read uncommitted and serializable.
    if (dialectName !== 'sqlite3') {
      it('should read the most recent committed rows when using the READ COMMITTED isolation level', async () => {
        const { User, transactionSequelize } = vars;

        await transactionSequelize.transaction(
          { isolationLevel: IsolationLevel.READ_COMMITTED },
          async transaction => {
            const users0 = await User.findAll({ transaction });
            expect(users0).to.have.lengthOf(1);
            await User.create({ name: 'Jane Doe', age: 21 }); // Create a User outside of the transaction
            const users = await User.findAll({ transaction });
            expect(users).to.have.lengthOf(2); // We SHOULD see the created user inside the transaction
          },
        );
      });
    }

    // These dialects do not allow dirty reads with isolation level "READ UNCOMMITTED".
    if (!['postgres', 'sqlite3'].includes(dialectName)) {
      it('should allow dirty read with isolation level "READ UNCOMMITTED"', async () => {
        const { User, transactionSequelize } = vars;
        const t1 = await transactionSequelize.startUnmanagedTransaction({
          isolationLevel: IsolationLevel.READ_UNCOMMITTED,
        });

        try {
          await User.update({ age: 22 }, { where: { name: 'John Doe' }, transaction: t1 });
          await transactionSequelize.transaction(
            { isolationLevel: IsolationLevel.READ_UNCOMMITTED },
            async transaction => {
              const johnDoe = await User.findOne({ where: { name: 'John Doe' }, transaction });
              assert(johnDoe, 'John Doe should exist');
              expect(johnDoe.age).to.equal(22);
            },
          );
        } finally {
          await t1.rollback();
          const johnDoe = await User.findOne({ where: { name: 'John Doe' } });
          assert(johnDoe, 'John Doe should exist');
          expect(johnDoe.age).to.equal(21);
        }
      });
    }

    // SQLite only supports read uncommitted and serializable.
    if (dialectName !== 'sqlite3') {
      it('should prevent dirty read with isolation level "READ COMMITTED"', async () => {
        const { User, transactionSequelize } = vars;
        const t1 = await transactionSequelize.startUnmanagedTransaction({
          isolationLevel: IsolationLevel.READ_COMMITTED,
        });

        try {
          await User.update({ age: 22 }, { where: { name: 'John Doe' }, transaction: t1 });
          await transactionSequelize.transaction(
            { isolationLevel: IsolationLevel.READ_COMMITTED },
            async transaction => {
              const johnDoe = await User.findOne({ where: { name: 'John Doe' }, transaction });
              assert(johnDoe, 'John Doe should exist');
              expect(johnDoe.age).to.equal(21);
            },
          );
        } finally {
          await t1.rollback();
          const johnDoe = await User.findOne({ where: { name: 'John Doe' } });
          assert(johnDoe, 'John Doe should exist');
          expect(johnDoe.age).to.equal(21);
        }
      });
    }

    // SQLite only supports read uncommitted and serializable.
    if (dialectName !== 'sqlite3') {
      it('should allow non-repeatable read with isolation level "READ COMMITTED"', async () => {
        const { User, transactionSequelize } = vars;
        const t1 = await transactionSequelize.startUnmanagedTransaction({
          isolationLevel: IsolationLevel.READ_COMMITTED,
        });

        try {
          const johnDoe = await User.findOne({ where: { name: 'John Doe' }, transaction: t1 });
          assert(johnDoe, 'John Doe should exist');
          expect(johnDoe.name).to.equal('John Doe');
          expect(johnDoe.age).to.equal(21);

          await transactionSequelize.transaction(
            { isolationLevel: IsolationLevel.READ_COMMITTED },
            async transaction => {
              await User.update({ age: 22 }, { where: { name: 'John Doe' }, transaction });
            },
          );

          const johnDoe1 = await User.findOne({ where: { name: 'John Doe' }, transaction: t1 });
          assert(johnDoe1, 'John Doe should exist');
          expect(johnDoe1.name).to.equal('John Doe');
          expect(johnDoe1.age).to.equal(22);
          await t1.commit();
        } catch (error) {
          await t1.rollback();
          throw error;
        }
      });
    }

    // These dialects do not allow phantom reads with isolation level "REPEATABLE READ" as they use snapshot rather than locking.
    if (['mariadb', 'mysql', 'postgres'].includes(dialectName)) {
      it('should not read newly committed rows when using the REPEATABLE READ isolation level', async () => {
        const { User, transactionSequelize } = vars;

        await transactionSequelize.transaction(
          { isolationLevel: IsolationLevel.REPEATABLE_READ },
          async transaction => {
            const users0 = await User.findAll({ transaction });
            expect(users0).to.have.lengthOf(1);

            await User.create({ name: 'Jane Doe', age: 21 }); // Create a User outside of the transaction
            const users = await User.findAll({ transaction });
            expect(users).to.have.lengthOf(1); // We SHOULD NOT see the created user inside the transaction
          },
        );
      });
      // SQLite only supports read uncommitted and serializable.
    } else if (dialectName !== 'sqlite3') {
      it('should allow phantom read with isolation level "REPEATABLE READ"', async () => {
        const { User, transactionSequelize } = vars;
        const t1 = await transactionSequelize.startUnmanagedTransaction({
          isolationLevel: IsolationLevel.REPEATABLE_READ,
        });

        try {
          const users = await User.findAll({ transaction: t1 });
          expect(users.length).to.equal(1);
          expect(users[0].name).to.equal('John Doe');
          expect(users[0].age).to.equal(21);

          await transactionSequelize.transaction(
            { isolationLevel: IsolationLevel.REPEATABLE_READ },
            async transaction => {
              await User.create({ name: 'Jane Doe', age: 21 }, { transaction });
            },
          );

          const users2 = await User.findAll({ transaction: t1 });
          expect(users2.length).to.equal(2);
          expect(users2[0].name).to.equal('John Doe');
          expect(users2[0].age).to.equal(21);
          expect(users2[1].name).to.equal('Jane Doe');
          expect(users2[1].age).to.equal(21);
          await t1.commit();
        } catch (error) {
          await t1.rollback();
          throw error;
        }
      });
    }

    // PostgreSQL is excluded because it detects Serialization Failure on commit instead of acquiring locks on the read rows
    if (!['postgres'].includes(dialectName)) {
      it('should block updates after reading a row using SERIALIZABLE', async () => {
        const { User, transactionSequelize } = vars;
        const transactionSpy = sinon.spy();
        const transaction = await transactionSequelize.startUnmanagedTransaction({
          isolationLevel: IsolationLevel.SERIALIZABLE,
        });

        await User.findAll({ transaction });
        await Promise.all([
          // Update should not succeed before transaction has committed
          User.update({ age: 25 }, { where: { name: 'John Doe' } }).then(() => {
            expect(transactionSpy).to.have.been.called;
            expect(transaction.finished).to.equal('commit');
          }),

          delay(4000)
            .then(transactionSpy)
            .then(async () => transaction.commit()),
        ]);
      });
    }
  });

  describe('Transaction#commit', () => {
    it('returns a promise that resolves once the transaction has been committed', async () => {
      const t = await sequelize.startUnmanagedTransaction();

      await expect(t.commit()).to.eventually.equal(undefined);
    });

    // we cannot close a sqlite connection, but there also cannot be a network error with sqlite.
    // so this test is not necessary for that dialect.
    if (dialectName !== 'sqlite3') {
      it('does not pollute the pool with broken connections if commit fails', async () => {
        const initialPoolSize = sequelize.pool.size;

        stubs.push(
          sinon
            .stub(sequelize.queryInterface, '_commitTransaction')
            .rejects(new Error('Oh no, an error!')),
        );

        const t = await sequelize.startUnmanagedTransaction();

        await expect(t.commit()).to.be.rejectedWith('Oh no, an error!');

        // connection should have been destroyed
        expect(sequelize.pool.size).to.eq(Math.max(0, initialPoolSize - 1));
      });
    }
  });

  describe('Transaction#rollback', () => {
    it('returns a promise that resolves once the transaction has been rolled back', async () => {
      const t = await sequelize.startUnmanagedTransaction();

      await expect(t.rollback()).to.eventually.equal(undefined);
    });

    // we cannot close a sqlite connection, but there also cannot be a network error with sqlite.
    // so this test is not necessary for that dialect.
    if (dialectName !== 'sqlite3') {
      it('does not pollute the pool with broken connections if the rollback fails', async () => {
        const initialPoolSize = sequelize.pool.size;

        stubs.push(
          sinon
            .stub(sequelize.queryInterface, '_rollbackTransaction')
            .rejects(new Error('Oh no, an error!')),
        );

        const t = await sequelize.startUnmanagedTransaction();

        await expect(t.rollback()).to.be.rejectedWith('Oh no, an error!');

        // connection should have been destroyed
        expect(sequelize.pool.size).to.eq(Math.max(0, initialPoolSize - 1));
      });
    }
  });

  if (getTestDialect() !== 'sqlite3' && getTestDialect() !== 'db2') {
    it('works for long running transactions', async () => {
      const sequelize2 = await createSingleTransactionalTestSequelizeInstance(sequelize);

      interface IUser extends Model<InferAttributes<IUser>, InferCreationAttributes<IUser>> {
        name: string | null;
      }

      const User = sequelize2.define<IUser>(
        'User',
        {
          name: DataTypes.STRING,
        },
        { timestamps: false },
      );

      await sequelize2.sync({ force: true });
      const t = await sequelize2.startUnmanagedTransaction();

      let query: string;
      switch (getTestDialect()) {
        case 'postgres':
          query = 'select pg_sleep(2);';
          break;
        case 'sqlite3':
          query = 'select sqlite3_sleep(2000);';
          break;
        case 'mssql':
          query = "WAITFOR DELAY '00:00:02';";
          break;
        default:
          query = 'select sleep(2);';
          break;
      }

      await sequelize2.query(query, { transaction: t });
      await User.create({ name: 'foo' });
      await sequelize2.query(query, { transaction: t });
      await t.commit();
      const users = await User.findAll();
      expect(users.length).to.equal(1);
      expect(users[0].name).to.equal('foo');
    });
  }

  describe('complex long running example', () => {
    it('works with promise syntax', async () => {
      const sequelize2 = await createSingleTransactionalTestSequelizeInstance(sequelize);
      const Test = sequelize2.define('Test', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: { type: DataTypes.STRING },
      });

      await sequelize2.sync({ force: true });
      const transaction = await sequelize2.startUnmanagedTransaction();
      expect(transaction).to.be.instanceOf(Transaction);

      await Test.create({ name: 'Peter' }, { transaction });

      await delay(1000);

      await transaction.commit();

      const count = await Test.count();
      expect(count).to.equal(1);
    });
  });

  describe('concurrency: having tables with uniqueness constraints', () => {
    it('triggers the error event for the second transactions', async () => {
      const sequelize2 = await createSingleTransactionalTestSequelizeInstance(sequelize);

      const User = sequelize2.define(
        'User',
        {
          name: { type: DataTypes.STRING, unique: true },
        },
        {
          timestamps: false,
        },
      );

      await User.sync({ force: true });

      const t1 = await sequelize2.startUnmanagedTransaction();
      const t2 = await sequelize2.startUnmanagedTransaction();
      await User.create({ name: 'omnom' }, { transaction: t1 });

      await Promise.all([
        (async () => {
          try {
            return await User.create({ name: 'omnom' }, { transaction: t2 });
          } catch (error) {
            expect(error).to.be.ok;

            return t2.rollback();
          }
        })(),

        delay(100).then(async () => {
          return t1.commit();
        }),
      ]);
    });
  });
});
