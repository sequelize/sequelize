import { expect } from 'chai';
import delay from 'delay';
import type { SinonStub } from 'sinon';
import sinon from 'sinon';
import type { InferAttributes, InferCreationAttributes, Model } from '@sequelize/core';
import {
  ConstraintChecking,
  DataTypes,
  IsolationLevel,
  Transaction,
  TransactionNestMode,
  TransactionType,
} from '@sequelize/core';
import { createSingleTransactionalTestSequelizeInstance, getTestDialect, getTestDialectTeaser, sequelize } from '../support';

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
          expect(transaction1 === transaction2).to.equal(true, 'transaction1 and transaction2 should be the same');
        });
      });
    });

    it('requires compatible options if nestMode is set to "reuse"', async () => {
      await sequelize.transaction(async transaction1 => {
        await expect(sequelize.transaction(
          { transaction: transaction1, type: TransactionType.EXCLUSIVE },
          async () => { /* noop */ },
        )).to.be.rejectedWith('Requested transaction type (EXCLUSIVE) is not compatible with the one of the existing transaction (DEFERRED)');

        await expect(sequelize.transaction(
          { transaction: transaction1, isolationLevel: IsolationLevel.READ_UNCOMMITTED },
          async () => { /* noop */ },
        )).to.be.rejectedWith('Requested isolation level (READ UNCOMMITTED) is not compatible with the one of the existing transaction (unspecified)');

        await expect(sequelize.transaction(
          { transaction: transaction1, constraintChecking: ConstraintChecking.IMMEDIATE },
          async () => { /* noop */ },
        )).to.be.rejectedWith('Requested transaction constraintChecking (IMMEDIATE) is not compatible with the one of the existing transaction (none)');

        await expect(sequelize.transaction(
          { transaction: transaction1, readOnly: true },
          async () => { /* noop */ },
        )).to.be.rejectedWith('Requested a transaction in read-only mode, which is not compatible with the existing read/write transaction');
      });
    });

    it('creates a savepoint if nestMode is set to "savepoint"', async () => {
      await sequelize.transaction(async transaction1 => {
        await sequelize.transaction(
          { transaction: transaction1, nestMode: TransactionNestMode.savepoint },
          async transaction2 => {
            expect(transaction1 === transaction2).to.equal(false, 'transaction1 and transaction2 should not be the same');
            expect(transaction2.parent === transaction1).to.equal(true, 'transaction2.parent should be transaction1');
          },
        );
      });
    });

    it('requires compatible options if nestMode is set to "savepoint"', async () => {
      await sequelize.transaction(async transaction1 => {
        const commonOptions = { transaction: transaction1, nestMode: TransactionNestMode.savepoint };

        await expect(sequelize.transaction(
          { ...commonOptions, type: TransactionType.EXCLUSIVE },
          async () => { /* noop */ },
        )).to.be.rejectedWith('Requested transaction type (EXCLUSIVE) is not compatible with the one of the existing transaction (DEFERRED)');

        await expect(sequelize.transaction(
          { ...commonOptions, isolationLevel: IsolationLevel.READ_UNCOMMITTED },
          async () => { /* noop */ },
        )).to.be.rejectedWith('Requested isolation level (READ UNCOMMITTED) is not compatible with the one of the existing transaction (unspecified)');

        await expect(sequelize.transaction(
          { ...commonOptions, constraintChecking: ConstraintChecking.IMMEDIATE },
          async () => { /* noop */ },
        )).to.be.rejectedWith('Requested transaction constraintChecking (IMMEDIATE) is not compatible with the one of the existing transaction (none)');

        await expect(sequelize.transaction(
          { ...commonOptions, readOnly: true },
          async () => { /* noop */ },
        )).to.be.rejectedWith('Requested a transaction in read-only mode, which is not compatible with the existing read/write transaction');
      });
    });

    // sqlite cannot have more than one transaction at the same time, so separate is not available.
    if (dialectName !== 'sqlite') {
      it('creates a new transaction if nestMode is set to "separate"', async () => {
        await sequelize.transaction(async transaction1 => {
          await sequelize.transaction(
            { transaction: transaction1, nestMode: TransactionNestMode.separate },
            async transaction2 => {
              expect(transaction1 === transaction2).to.equal(false, 'transaction1 and transaction2 should not be the same');
              expect(transaction1.parent === null).to.equal(true, 'transaction1.parent should be null');
              expect(transaction2.parent === null).to.equal(true, 'transaction2.parent should be null');
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
              type: TransactionType.EXCLUSIVE,
              isolationLevel: IsolationLevel.READ_UNCOMMITTED,
              constraintChecking: sequelize.dialect.supports.constraints.deferrable
                ? ConstraintChecking.DEFERRED
                : undefined,
              readOnly: true,
            },
            async () => { /* noop */
            },
          );
        });
      });
    }

    it(`defaults nestMode to sequelize's defaultTransactionNestMode option`, async () => {
      const customSequelize = await createSingleTransactionalTestSequelizeInstance({
        defaultTransactionNestMode: TransactionNestMode.savepoint,
      });

      await customSequelize.transaction(async transaction1 => {
        await customSequelize.transaction(
          { transaction: transaction1 },
          async transaction2 => {
            expect(transaction1 === transaction2).to.equal(false, 'transaction1 and transaction2 should not be the same');
            expect(transaction2.parent === transaction1).to.equal(true, 'transaction2.parent should be transaction1');
          },
        );
      });
    });
  });

  describe('Transaction#commit', () => {
    it('returns a promise that resolves once the transaction has been committed', async () => {
      const t = await sequelize.startUnmanagedTransaction();

      await expect(t.commit()).to.eventually.equal(undefined);
    });

    // we cannot close a sqlite connection, but there also cannot be a network error with sqlite.
    // so this test is not necessary for that dialect.
    if (dialectName !== 'sqlite') {
      it('does not pollute the pool with broken connections if commit fails', async () => {
        const initialPoolSize = sequelize.connectionManager.pool.size;

        stubs.push(sinon.stub(sequelize.queryInterface, 'commitTransaction').rejects(new Error('Oh no, an error!')));

        const t = await sequelize.startUnmanagedTransaction();

        await expect(t.commit()).to.be.rejectedWith('Oh no, an error!');

        // connection should have been destroyed
        expect(sequelize.connectionManager.pool.size).to.eq(Math.max(0, initialPoolSize - 1));
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
    if (dialectName !== 'sqlite') {
      it('does not pollute the pool with broken connections if the rollback fails', async () => {
        const initialPoolSize = sequelize.connectionManager.pool.size;

        stubs.push(sinon.stub(sequelize.queryInterface, 'rollbackTransaction').rejects(new Error('Oh no, an error!')));

        const t = await sequelize.startUnmanagedTransaction();

        await expect(t.rollback()).to.be.rejectedWith('Oh no, an error!');

        // connection should have been destroyed
        expect(sequelize.connectionManager.pool.size).to.eq(Math.max(0, initialPoolSize - 1));
      });
    }
  });

  if (getTestDialect() !== 'sqlite' && getTestDialect() !== 'db2') {
    it('works for long running transactions', async () => {
      const sequelize2 = await createSingleTransactionalTestSequelizeInstance(sequelize);

      interface IUser extends Model<InferAttributes<IUser>, InferCreationAttributes<IUser>> {
        name: string | null;
      }

      const User = sequelize2.define<IUser>('User', {
        name: DataTypes.STRING,
      }, { timestamps: false });

      await sequelize2.sync({ force: true });
      const t = await sequelize2.startUnmanagedTransaction();

      let query: string;
      switch (getTestDialect()) {
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

      const Model = sequelize2.define('Model', {
        name: { type: DataTypes.STRING, unique: true },
      }, {
        timestamps: false,
      });

      await Model.sync({ force: true });

      const t1 = await sequelize2.startUnmanagedTransaction();
      const t2 = await sequelize2.startUnmanagedTransaction();
      await Model.create({ name: 'omnom' }, { transaction: t1 });

      await Promise.all([
        (async () => {
          try {
            return await Model.create({ name: 'omnom' }, { transaction: t2 });
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
