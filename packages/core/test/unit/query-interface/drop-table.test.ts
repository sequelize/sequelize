import { expect } from 'chai';
import sinon from 'sinon';
import { expectsql, getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();

describe('QueryInterface#dropTable', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('produces a DROP TABLE query with cascade', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw').returns(Promise.resolve([[], {}]));
    if (sequelize.dialect.supports.dropTable.cascade) {
      await sequelize.queryInterface.dropTable('myTable', { cascade: true });

      expect(stub.callCount).to.eq(1);
      const firstCall = stub.getCall(0);
      expectsql(firstCall.args[0], {
        default: 'DROP TABLE IF EXISTS [myTable] CASCADE',
      });
    } else {
      await expect(
        sequelize.queryInterface.dropTable('myTable', { cascade: true }),
      ).to.be.rejectedWith(
        `The following options are not supported by dropTableQuery in ${dialectName}: cascade`,
      );
    }
  });

  it('produces a DROP TABLE query with dropHistoryTable', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw').returns(Promise.resolve([[], {}]));
    if (sequelize.dialect.supports.temporalTables.historyTable) {
      await sequelize.queryInterface.dropTable('myTable', { dropHistoryTable: true });

      expect(stub.callCount).to.eq(2);
      const firstCall = stub.getCall(1);
      expectsql(firstCall.args[0], {
        default: 'DROP TABLE IF EXISTS [myTable]',
      });
    } else {
      await expect(
        sequelize.queryInterface.dropTable('myTable', { dropHistoryTable: true }),
      ).to.be.rejectedWith(
        `The following options are not supported by dropTableQuery in ${dialectName}: dropHistoryTable`,
      );
    }
  });
});
