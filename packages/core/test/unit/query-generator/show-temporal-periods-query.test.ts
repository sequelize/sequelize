import { createSequelizeInstance, expectsql, sequelize } from '../../support';

const dialect = sequelize.dialect;
const notImplementedError = new Error(
  `showTemporalPeriodsQuery has not been implemented in ${dialect.name}.`,
);

describe('QueryGenerator#showTemporalPeriodsQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('generates a query that shows the temporal periods', () => {
    expectsql(() => queryGenerator.showTemporalPeriodsQuery(), {
      default: notImplementedError,
    });
  });

  it('generates a query that shows the temporal periods of a table', () => {
    expectsql(() => queryGenerator.showTemporalPeriodsQuery({ tableOrModel: 'myTable' }), {
      default: notImplementedError,
    });
  });

  it('generates a query that shows the temporal periods for a model', () => {
    const MyModel = sequelize.define('MyModel', {});

    expectsql(() => queryGenerator.showTemporalPeriodsQuery({ tableOrModel: MyModel }), {
      default: notImplementedError,
    });
  });

  it('generates a query that shows the temporal periods for a model definition', () => {
    const MyModel = sequelize.define('MyModel', {});

    expectsql(
      () => queryGenerator.showTemporalPeriodsQuery({ tableOrModel: MyModel.modelDefinition }),
      {
        default: notImplementedError,
      },
    );
  });

  it('generates a query that shows the temporal periods of a table with a schema', () => {
    expectsql(
      () =>
        queryGenerator.showTemporalPeriodsQuery({
          tableOrModel: { tableName: 'myTable', schema: 'mySchema' },
        }),
      {
        default: notImplementedError,
      },
    );
  });

  it('generates a query that shows the temporal periods of a table with a default schema', () => {
    expectsql(
      () =>
        queryGenerator.showTemporalPeriodsQuery({
          tableOrModel: { tableName: 'myTable', schema: dialect.getDefaultSchema() },
        }),
      {
        default: notImplementedError,
      },
    );
  });

  it('generates a query that shows the temporal periods of a table with a globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.queryGenerator;

    expectsql(() => queryGeneratorSchema.showTemporalPeriodsQuery({ tableOrModel: 'myTable' }), {
      default: notImplementedError,
    });
  });
});
