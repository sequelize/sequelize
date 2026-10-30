import type { ShowConstraintsOptions, TableNameWithSchema } from '@sequelize/core';
import { QueryTypes } from '@sequelize/core';
import { expect } from 'chai';
import sinon from 'sinon';
import {
  allowDeprecationsInSuite,
  createSequelizeInstance,
  expectPerDialect,
  inlineBindParameters,
  sequelize,
} from '../../support';

const table: TableNameWithSchema = { tableName: 'myTable', schema: 'mySchema' };

function stubQueryRaw(sequelizeInstance = sequelize) {
  // sqlite3 reads the constraints from the CREATE TABLE statement
  return sinon.stub(sequelizeInstance, 'queryRaw').callsFake(async (_sql, options) => {
    if (options?.type === QueryTypes.SELECT) {
      return [{ sql: 'CREATE TABLE `myTable` (`id` INTEGER)' }] as any;
    }

    return [] as any;
  });
}

describe('QueryInterface#showConstraints', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('runs the query generator query, with the names as bind parameters in Oracle', async () => {
    const stub = stubQueryRaw();
    const options: ShowConstraintsOptions = {
      constraintName: 'myConstraint',
      constraintType: 'UNIQUE',
    };

    await sequelize.queryInterface.showConstraints(table, { ...options, useMaster: true });

    const [sql, queryOptions] = stub.getCall(0).args;
    expect(queryOptions).to.include({ useMaster: true, raw: true });
    expectPerDialect(() => inlineBindParameters(sql, queryOptions?.bind), {
      default: sequelize.queryGenerator.showConstraintsQuery(table, options),
      sqlite3: "SELECT sql FROM sqlite_master WHERE tbl_name = 'mySchema.myTable';",
    });
    expectPerDialect(
      () => ({ bind: queryOptions?.bind, logQueryParameters: queryOptions?.logQueryParameters }),
      {
        default: { bind: undefined, logQueryParameters: undefined },
        oracle: {
          bind: {
            sequelize_1: 'myTable',
            sequelize_2: 'mySchema',
            sequelize_3: 'myConstraint',
            sequelize_4: 'U',
          },
          logQueryParameters: true,
        },
      },
    );
  });

  it('runs the foreign key query, with the names as bind parameters in Oracle', async () => {
    const stub = stubQueryRaw();
    const options: ShowConstraintsOptions = { constraintType: 'FOREIGN KEY' };

    await sequelize.queryInterface.showConstraints(table, options);

    const [sql, queryOptions] = stub.getCall(0).args;
    expectPerDialect(() => inlineBindParameters(sql, queryOptions?.bind), {
      default: sequelize.queryGenerator.showConstraintsQuery(table, options),
      sqlite3: "SELECT sql FROM sqlite_master WHERE tbl_name = 'mySchema.myTable';",
    });
    expectPerDialect(() => queryOptions?.bind, {
      default: undefined,
      oracle: { sequelize_1: 'myTable', sequelize_2: 'mySchema' },
    });
  });

  it('works without a default schema', async () => {
    sinon.stub(sequelize.dialect, 'getDefaultSchema').returns('');
    const stub = stubQueryRaw();

    await sequelize.queryInterface.showConstraints('myTable');

    const [sql, queryOptions] = stub.getCall(0).args;
    expectPerDialect(() => inlineBindParameters(sql, queryOptions?.bind), {
      default: sequelize.queryGenerator.showConstraintsQuery('myTable'),
      sqlite3: "SELECT sql FROM sqlite_master WHERE tbl_name = 'myTable';",
    });
    expectPerDialect(() => queryOptions?.bind, {
      default: undefined,
      oracle: { sequelize_1: 'myTable' },
    });
  });

  it('does not let the bind option override its bind parameters', async () => {
    const stub = stubQueryRaw();

    await sequelize.queryInterface.showConstraints('myTable', {
      bind: { sequelize_1: 'otherTable' },
    });

    expectPerDialect(() => stub.getCall(0).args[1]?.bind, {
      default: { sequelize_1: 'otherTable' },
      oracle: { sequelize_1: 'myTable', sequelize_2: sequelize.dialect.getDefaultSchema() },
    });
  });

  if (sequelize.dialect.name === 'oracle') {
    it('rejects names that are not strings', async () => {
      stubQueryRaw();

      await expect(
        sequelize.queryInterface.showConstraints('myTable', {
          constraintName: { dir: 3003, maxSize: 1e9 } as any,
        }),
      ).to.be.rejectedWith(TypeError, 'Catalog queries only accept strings as bind parameters');
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
      const stub = stubQueryRaw(unquotedSequelize);

      await unquotedSequelize.queryInterface.showConstraints(table);

      const [sql, queryOptions] = stub.getCall(0).args;
      expectPerDialect(() => inlineBindParameters(sql, queryOptions?.bind, unquotedSequelize), {
        default: unquotedSequelize.queryGenerator.showConstraintsQuery(table),
        sqlite3: "SELECT sql FROM sqlite_master WHERE tbl_name = 'mySchema.myTable';",
      });
      expectPerDialect(() => queryOptions?.bind, {
        default: undefined,
        oracle: { sequelize_1: 'MYTABLE', sequelize_2: 'MYSCHEMA' },
      });
    });
  });
});
