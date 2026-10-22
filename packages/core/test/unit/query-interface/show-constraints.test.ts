import type { ShowConstraintsOptions, TableNameWithSchema } from '@sequelize/core';
import { QueryTypes } from '@sequelize/core';
import sinon from 'sinon';
import { expectPerDialect, inlineBindParameters, sequelize } from '../../support';

const table: TableNameWithSchema = { tableName: 'myTable', schema: 'mySchema' };

function stubQueryRaw() {
  // sqlite3 reads the constraints from the CREATE TABLE statement
  return sinon.stub(sequelize, 'queryRaw').callsFake(async (_sql, options) => {
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

    await sequelize.queryInterface.showConstraints(table, options);

    const [sql, queryOptions] = stub.getCall(0).args;
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
});
