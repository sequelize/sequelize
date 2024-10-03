import { createSequelizeInstance, expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;
const notImplementedError = new Error(
  `showTemporalTablesQuery has not been implemented in ${dialect.name}.`,
);

describe('QueryGenerator#showTemporalTablesQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('generates a query that shows the temporal tables', () => {
    expectsql(() => queryGenerator.showTemporalTablesQuery(), {
      default: notImplementedError,
    });
  });

  it('generates a query that shows the temporal tables for a table', () => {
    expectsql(() => queryGenerator.showTemporalTablesQuery({ tableOrModel: 'myTable' }), {
      default: notImplementedError,
    });
  });

  it('generates a query that shows the temporal tables for a model', () => {
    const MyModel = sequelize.define('MyModel', {});

    expectsql(() => queryGenerator.showTemporalTablesQuery({ tableOrModel: MyModel }), {
      default: notImplementedError,
    });
  });

  it('generates a query that shows the temporal tables for a model definition', () => {
    const MyModel = sequelize.define('MyModel', {});

    expectsql(
      () => queryGenerator.showTemporalTablesQuery({ tableOrModel: MyModel.modelDefinition }),
      {
        default: notImplementedError,
      },
    );
  });

  it('generates a query that shows the temporal tables for a table with a schema', () => {
    expectsql(
      () =>
        queryGenerator.showTemporalTablesQuery({
          tableOrModel: { tableName: 'myTable', schema: 'mySchema' },
        }),
      {
        default: notImplementedError,
      },
    );
  });

  it('generates a query that shows the temporal tables for a table with a default schema', () => {
    expectsql(
      () =>
        queryGenerator.showTemporalTablesQuery({
          tableOrModel: { tableName: 'myTable', schema: dialect.getDefaultSchema() },
        }),
      {
        default: notImplementedError,
      },
    );
  });

  it('generates a query that shows the temporal tables for a table with a globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.queryGenerator;

    expectsql(() => queryGeneratorSchema.showTemporalTablesQuery({ tableOrModel: 'myTable' }), {
      default: notImplementedError,
    });
  });
});
