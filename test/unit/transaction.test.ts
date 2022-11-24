import { Transaction } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { beforeAll2, getTestDialect, sequelize } from '../support';

const dialectName = getTestDialect();

describe('Transaction', () => {
  // IBMiQueryInterface#startTransaction does not pass "START TRANSACTION" queries to queryRaw.
  // Instead, it calls beginTransaction directly on the transaction (as it should be done).
  if (dialectName === 'ibmi') {
    return;
  }

  const vars = beforeAll2(() => {
    return {
      stub: sinon.stub(sequelize, 'queryRaw').resolves([[], {}]),
      stubConnection: sinon.stub(sequelize.connectionManager, 'getConnection')
        .resolves({
          uuid: 'ssfdjd-434fd-43dfg23-2d',
          // @ts-expect-error -- stub
          close() {},
        }),
      stubRelease: sinon.stub(sequelize.connectionManager, 'releaseConnection'),
    };
  });

  beforeEach(() => {
    vars.stub.resetHistory();
    vars.stubConnection.resetHistory();
    vars.stubRelease.resetHistory();
  });

  after(() => {
    vars.stub.restore();
    vars.stubConnection.restore();
  });

  it('should run auto commit query only when needed', async () => {
    const expectations: Record<string, string[]> = {
      all: [
        'START TRANSACTION;',
      ],
      sqlite: [
        'BEGIN DEFERRED TRANSACTION;',
      ],
      db2: [
        'BEGIN TRANSACTION;',
      ],
      mssql: [
        'BEGIN TRANSACTION;',
      ],
    };

    await sequelize.transaction(async () => {
      expect(vars.stub.args.map(arg => arg[0])).to.deep.equal(expectations[dialectName] || expectations.all);
    });
  });

  it('should set isolation level correctly', async () => {
    const expectations: Record<string, string[]> = {
      all: [
        'SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;',
        'START TRANSACTION;',
      ],
      postgres: [
        'START TRANSACTION;',
        'SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;',
      ],
      sqlite: [
        'BEGIN DEFERRED TRANSACTION;',
        'PRAGMA read_uncommitted = ON;',
      ],
      mssql: [
        'BEGIN TRANSACTION;',
        'SET TRANSACTION ISOLATION LEVEL READ UNCOMMITTED;',
      ],
      db2: [
        'BEGIN TRANSACTION',
        'CHANGE ISOLATION LEVEL TO UR;',
      ],
    };

    await sequelize.transaction({ isolationLevel: Transaction.ISOLATION_LEVELS.READ_UNCOMMITTED }, async () => {
      expect(vars.stub.args.map(arg => arg[0])).to.deep.equal(expectations[dialectName] || expectations.all);
    });
  });
});

describe('Sequelize#transaction', () => {
  it('throws if the callback is not provided', async () => {
    // @ts-expect-error -- this test ensures a helpful error is thrown to ease migration.
    await expect(sequelize.transaction()).to.be.rejectedWith('sequelize.transaction requires a callback. If you wish to start an unmanaged transaction, please use sequelize.startUnmanagedTransaction instead');
  });
});
