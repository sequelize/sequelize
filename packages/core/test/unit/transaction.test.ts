import { IsolationLevel, TransactionNestMode } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { beforeAll2, getTestDialect, sequelize } from '../support';

const dialectName = getTestDialect();

describe('Transaction', () => {
  // These dialects do not pass transaction queries to queryRaw.
  // Instead, they call connection transaction methods directly.
  if (sequelize.dialect.supports.connectionTransactionMethods) {
    return;
  }

  const vars = beforeAll2(() => {
    sequelize.setDatabaseVersion('does not matter, prevents the SHOW SERVER_VERSION query');

    return {
      stub: sinon.stub(sequelize, 'queryRaw').resolves([[], {}]),
      stubConnection: sinon.stub(sequelize.dialect.connectionManager, 'connect').resolves({
        uuid: 'ssfdjd-434fd-43dfg23-2d',
        close() {},
      }),
      stubValidate: sinon.stub(sequelize.dialect.connectionManager, 'validate').returns(true),
      stubRelease: sinon.stub(sequelize.dialect.connectionManager, 'disconnect'),
      stubTransactionId: sinon
        .stub(sequelize.queryGenerator, 'generateTransactionId')
        .returns('123'),
    };
  });

  beforeEach(() => {
    vars.stub.resetHistory();
    vars.stubConnection.resetHistory();
    vars.stubValidate.resetHistory();
    vars.stubRelease.resetHistory();
  });

  after(() => {
    vars.stub.restore();
    vars.stubConnection.restore();
    vars.stubValidate.restore();
    vars.stubRelease.restore();
    vars.stubTransactionId.restore();
  });

  it('should run auto commit query only when needed', async () => {
    sequelize.setDatabaseVersion('does not matter, prevents the SHOW SERVER_VERSION query');

    const expectations: Record<string, string[]> = {
      all: ['START TRANSACTION'],
      snowflake: ['START TRANSACTION NAME "123"'],
      sqlite3: ['BEGIN DEFERRED TRANSACTION'],
      oracle: ['BEGIN TRANSACTION'],
    };

    await sequelize.transaction(async () => {
      expect(vars.stub.args.map(arg => arg[0])).to.deep.equal(
        expectations[dialectName] || expectations.all,
      );
    });
  });

  it('should set isolation level correctly', async () => {
    const expectations: Record<string, string[]> = {
      all: ['SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED', 'START TRANSACTION'],
      postgres: ['START TRANSACTION', 'SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED'],
      sqlite3: ['BEGIN DEFERRED TRANSACTION', 'PRAGMA read_uncommitted = 1'],
      oracle: ['BEGIN TRANSACTION', 'SET TRANSACTION ISOLATION LEVEL READ COMMITTED'],
    };

    try {
      await sequelize.transaction({ isolationLevel: IsolationLevel.READ_UNCOMMITTED }, async () => {
        expect(vars.stub.args.map(arg => arg[0])).to.deep.equal(
          expectations[dialectName] || expectations.all,
        );
      });
    } catch (error) {
      if (!sequelize.dialect.supports.isolationLevels) {
        expect(error).to.be.instanceOf(
          Error,
          `Isolation levels are not supported by ${dialectName}.`,
        );
      } else {
        throw error;
      }
    }
  });

  // https://github.com/sequelize/sequelize/issues/18207
  it('uses a unique name for each nested savepoint', async function () {
    if (!sequelize.dialect.supports.savepoints) {
      return this.skip();
    }

    // Hand out a distinct id on every call so the savepoint names can only
    // collide if they are derived from something other than a fresh id.
    let counter = 0;
    vars.stubTransactionId.callsFake(() => `txn-${counter++}`);

    await sequelize.transaction(async t1 => {
      await sequelize.transaction(
        { transaction: t1, nestMode: TransactionNestMode.savepoint },
        async t2 => {
          await sequelize.transaction(
            { transaction: t2, nestMode: TransactionNestMode.savepoint },
            async () => {},
          );
        },
      );
    });

    const isSavepointCreation = (sql: string) =>
      (sql.includes('SAVEPOINT') || sql.includes('SAVE TRANSACTION')) &&
      !sql.includes('RELEASE') &&
      !sql.includes('ROLLBACK');

    const savepointCreations = vars.stub.args
      .map(args => String(args[0]))
      .filter(isSavepointCreation);

    expect(savepointCreations).to.have.lengthOf(2);
    // Both nested savepoints previously resolved to the same name (e.g.
    // `<id>-sp-0`), so a rollback could target the wrong savepoint.
    expect(new Set(savepointCreations).size).to.equal(2);
  });
});

describe('Sequelize#transaction', () => {
  it('throws if the callback is not provided', async () => {
    // @ts-expect-error -- this test ensures a helpful error is thrown to ease migration.
    await expect(sequelize.transaction()).to.be.rejectedWith(
      'sequelize.transaction requires a callback. If you wish to start an unmanaged transaction, please use sequelize.startUnmanagedTransaction instead',
    );
  });
});
