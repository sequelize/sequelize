import type { Transactionable } from '@sequelize/core';
import { setTransactionFromCls } from '@sequelize/core/_non-semver-use-at-your-own-risk_/model-internals.js';
import { expect } from 'chai';
import { beforeAll2, createSequelizeInstance, getTestDialect } from '../../support';

const dialectName = getTestDialect();

describe('setTransactionFromCls', () => {
  const vars = beforeAll2(() => {
    const sequelize = createSequelizeInstance({
      disableClsTransactions: false,
    });

    return { sequelize };
  });

  after(async () => {
    return vars.sequelize.close();
  });

  it('sets the transaction & connection if they exists in CLS', async () => {
    const { sequelize } = vars;

    await sequelize.transaction(transaction => {
      const options: Transactionable = {};
      setTransactionFromCls(options, sequelize);

      expect(options.transaction).to.eq(transaction);
      expect(options.connection).to.eq(transaction.getConnection());
    });
  });

  it('does not use CLS if a transaction is already provided', async () => {
    // SQLite only has a single connection, we can't open a second transaction
    if (dialectName === 'sqlite3') {
      return;
    }

    const { sequelize } = vars;

    const manualTransaction = await sequelize.startUnmanagedTransaction();

    await sequelize.transaction(async () => {
      const options: Transactionable = { transaction: manualTransaction };

      setTransactionFromCls(options, sequelize);

      expect(options.transaction).to.eq(manualTransaction);
      expect(options.connection).to.eq(manualTransaction.getConnection());
    });

    await manualTransaction.commit();
  });

  it('does not use CLS if null is explicitly provided', async () => {
    const { sequelize } = vars;

    await sequelize.transaction(async () => {
      const options: Transactionable = { transaction: null };

      setTransactionFromCls(options, sequelize);

      expect(options.transaction).to.eq(null);
      expect(options.connection).to.eq(undefined);
    });
  });

  it('does not set the transaction from CLS if an incompatible connection is provided', async () => {
    // SQLite only has a single connection, so it's the same connection
    if (dialectName === 'sqlite3') {
      return;
    }

    const { sequelize } = vars;

    await sequelize.transaction(async () => {
      await sequelize.withConnection(async connection => {
        const options: Transactionable = { connection };

        setTransactionFromCls(options, sequelize);

        expect(options.transaction).to.eq(undefined);
        expect(options.connection).to.eq(connection);
      });
    });
  });

  it('does not set the transaction from CLS if a compatible connection is provided', async () => {
    const { sequelize } = vars;

    await sequelize.transaction(async transaction => {
      const options: Transactionable = { connection: transaction.getConnection() };

      setTransactionFromCls(options, sequelize);

      expect(options.transaction).to.eq(transaction);
      expect(options.connection).to.eq(transaction.getConnection());
    });
  });

  it('does not allow mismatching connection & transaction', async () => {
    // SQLite only has a single connection, so it's the same connection
    if (dialectName === 'sqlite3') {
      return;
    }

    const { sequelize } = vars;

    await sequelize.transaction(async transaction => {
      await sequelize.withConnection(async connection => {
        const options: Transactionable = { transaction, connection };

        expect(() => setTransactionFromCls(options, sequelize)).to.throw(
          `You are using mismatching "transaction" and "connection" options. Please pass either one of them, or make sure they're both using the same connection.`,
        );
      });
    });
  });
});
