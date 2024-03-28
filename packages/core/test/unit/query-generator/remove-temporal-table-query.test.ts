import { createSequelizeInstance, expectsql, getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();
const notSupportedError = new Error(
  `removeTemporalTableQuery has not been implemented in ${dialectName}.`,
);

describe('QueryGenerator#removeTemporalTableQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('produces a removeTemporalTableQuery query', () => {
    expectsql(() => queryGenerator.removeTemporalTableQuery('myTable'), {
      default: notSupportedError,
      mssql: `ALTER TABLE [myTable] SET (SYSTEM_VERSIONING = OFF);
      ALTER TABLE [myTable] DROP PERIOD FOR SYSTEM_TIME;`,
    });
  });

  it('produces a removeTemporalTableQuery query for a model', () => {
    const MyModel = sequelize.define('MyModel', {});

    expectsql(() => queryGenerator.removeTemporalTableQuery(MyModel), {
      default: notSupportedError,
      mssql: `ALTER TABLE [MyModels] SET (SYSTEM_VERSIONING = OFF);
      ALTER TABLE [MyModels] DROP PERIOD FOR SYSTEM_TIME;`,
    });
  });

  it('produces a removeTemporalTableQuery query for a model definition', () => {
    const MyModel = sequelize.define('MyModel', {});

    expectsql(() => queryGenerator.removeTemporalTableQuery(MyModel.modelDefinition), {
      default: notSupportedError,
      mssql: `ALTER TABLE [MyModels] SET (SYSTEM_VERSIONING = OFF);
      ALTER TABLE [MyModels] DROP PERIOD FOR SYSTEM_TIME;`,
    });
  });

  it('produces a removeTemporalTableQuery query with a custom schema', () => {
    expectsql(
      () => queryGenerator.removeTemporalTableQuery({ tableName: 'myTable', schema: 'mySchema' }),
      {
        default: notSupportedError,
        mssql: `ALTER TABLE [mySchema].[myTable] SET (SYSTEM_VERSIONING = OFF);
      ALTER TABLE [mySchema].[myTable] DROP PERIOD FOR SYSTEM_TIME;`,
      },
    );
  });

  it('produces a removeTemporalTableQuery query with a default schema', () => {
    expectsql(
      () =>
        queryGenerator.removeTemporalTableQuery({
          tableName: 'myTable',
          schema: sequelize.dialect.getDefaultSchema(),
        }),
      {
        default: notSupportedError,
        mssql: `ALTER TABLE [myTable] SET (SYSTEM_VERSIONING = OFF);
      ALTER TABLE [myTable] DROP PERIOD FOR SYSTEM_TIME;`,
      },
    );
  });

  it('produces a removeTemporalTableQuery query with globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.queryGenerator;

    expectsql(() => queryGeneratorSchema.removeTemporalTableQuery('myTable'), {
      default: notSupportedError,
      mssql: `ALTER TABLE [mySchema].[myTable] SET (SYSTEM_VERSIONING = OFF);
      ALTER TABLE [mySchema].[myTable] DROP PERIOD FOR SYSTEM_TIME;`,
    });
  });
});
