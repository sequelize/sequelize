import type { TableNameWithSchema } from '@sequelize/core';
import { QueryTypes } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import { expectPerDialect, inlineBindParameters, sequelize } from '../../support';

function stubQueryRaw() {
  // sqlite3 also queries the indexes and the CREATE TABLE statement
  return sinon.stub(sequelize, 'queryRaw').callsFake(async (_sql, options) => {
    switch (options?.type) {
      case QueryTypes.DESCRIBE:
        return { id: {} } as any;
      case QueryTypes.SELECT:
        return [{ sql: 'CREATE TABLE `myTable` (`id` INTEGER)' }] as any;
      default:
        return [] as any;
    }
  });
}

describe('QueryInterface#describeTable', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('runs the query generator query, with the names as bind parameters in Oracle', async () => {
    const stub = stubQueryRaw();
    const table: TableNameWithSchema = { tableName: 'myTable', schema: 'mySchema' };

    await sequelize.queryInterface.describeTable(table);

    const [sql, options] = stub.getCall(0).args;
    expect(inlineBindParameters(sql, options?.bind)).to.equal(
      sequelize.queryGenerator.describeTableQuery(table),
    );
    expectPerDialect(
      () => ({ bind: options?.bind, logQueryParameters: options?.logQueryParameters }),
      {
        default: { bind: undefined, logQueryParameters: undefined },
        oracle: {
          bind: { sequelize_1: 'mySchema', sequelize_2: 'myTable' },
          logQueryParameters: true,
        },
      },
    );
  });

  it('does not let the bind option override its bind parameters', async () => {
    const stub = stubQueryRaw();

    await sequelize.queryInterface.describeTable(
      { tableName: 'myTable', schema: 'mySchema' },
      { bind: { sequelize_2: 'otherTable' } },
    );

    expectPerDialect(() => stub.getCall(0).args[1]?.bind, {
      default: { sequelize_2: 'otherTable' },
      oracle: { sequelize_1: 'mySchema', sequelize_2: 'myTable' },
    });
  });
});
