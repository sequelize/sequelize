import type { TableNameWithSchema } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import {
  allowDeprecationsInSuite,
  createSequelizeInstance,
  expectPerDialect,
  inlineBindParameters,
  sequelize,
} from '../../support';

describe('QueryInterface#showIndex', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('runs the query generator query, with the names as bind parameters in Oracle', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);
    const table: TableNameWithSchema = { tableName: 'myTable', schema: 'mySchema' };

    await sequelize.queryInterface.showIndex(table, { useMaster: true });

    expect(stub.callCount).to.equal(1);
    const [sql, options] = stub.getCall(0).args;
    expect(options?.useMaster).to.equal(true);
    expect(inlineBindParameters(sql, options?.bind)).to.equal(
      sequelize.queryGenerator.showIndexesQuery(table),
    );
    expectPerDialect(
      () => ({ bind: options?.bind, logQueryParameters: options?.logQueryParameters }),
      {
        default: { bind: undefined, logQueryParameters: undefined },
        oracle: {
          bind: { sequelize_1: 'myTable', sequelize_2: 'mySchema' },
          logQueryParameters: true,
        },
      },
    );
  });

  it('uses the default schema', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);

    await sequelize.queryInterface.showIndex('myTable');

    const [sql, options] = stub.getCall(0).args;
    expect(inlineBindParameters(sql, options?.bind)).to.equal(
      sequelize.queryGenerator.showIndexesQuery('myTable'),
    );
    expectPerDialect(() => options?.bind, {
      default: undefined,
      oracle: { sequelize_1: 'myTable', sequelize_2: sequelize.dialect.getDefaultSchema() },
    });
  });

  it('works without a default schema', async () => {
    sinon.stub(sequelize.dialect, 'getDefaultSchema').returns('');
    const stub = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);

    await sequelize.queryInterface.showIndex('myTable');

    const [sql, options] = stub.getCall(0).args;
    expect(inlineBindParameters(sql, options?.bind)).to.equal(
      sequelize.queryGenerator.showIndexesQuery('myTable'),
    );
    expectPerDialect(() => options?.bind, {
      default: undefined,
      oracle: { sequelize_1: 'myTable' },
    });
  });

  it('does not let the bind option override its bind parameters', async () => {
    const stub = sinon.stub(sequelize, 'queryRaw').resolves([[], 0]);

    await sequelize.queryInterface.showIndex('myTable', { bind: { sequelize_1: 'otherTable' } });

    expectPerDialect(() => stub.getCall(0).args[1]?.bind, {
      default: { sequelize_1: 'otherTable' },
      oracle: { sequelize_1: 'myTable', sequelize_2: sequelize.dialect.getDefaultSchema() },
    });
  });

  if (sequelize.dialect.name === 'oracle') {
    it('sends the names to the driver as positional bind parameters', async () => {
      const execute = sinon.stub().resolves({ rows: [] });

      await sequelize.queryInterface.showIndex(
        { tableName: 'myTable', schema: 'mySchema' },
        { connection: { execute, uuid: 'fake' } as any },
      );

      const [sql, parameters] = execute.getCall(0).args;
      expect(sql).to.include('WHERE i.table_name = :1 AND u.table_owner = :2 ');
      expect(parameters).to.deep.equal(['myTable', 'mySchema']);
    });
  }

  describe('with quoteIdentifiers: false', () => {
    allowDeprecationsInSuite(['SEQUELIZE0023']);

    let unquotedSequelize: ReturnType<typeof createSequelizeInstance>;

    before(() => {
      unquotedSequelize = createSequelizeInstance({ quoteIdentifiers: false });
    });

    after(async () => {
      await unquotedSequelize.close();
    });

    it('uses the names as they are stored in the catalog', async () => {
      const stub = sinon.stub(unquotedSequelize, 'queryRaw').resolves([[], 0]);
      const table: TableNameWithSchema = { tableName: 'myTable', schema: 'mySchema' };

      await unquotedSequelize.queryInterface.showIndex(table);

      const [sql, options] = stub.getCall(0).args;
      expect(inlineBindParameters(sql, options?.bind, unquotedSequelize)).to.equal(
        unquotedSequelize.queryGenerator.showIndexesQuery(table),
      );
      expectPerDialect(() => options?.bind, {
        default: undefined,
        oracle: { sequelize_1: 'MYTABLE', sequelize_2: 'MYSCHEMA' },
      });
    });
  });
});
