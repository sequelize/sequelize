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
      mssql: `SELECT p.name, p.period_type_desc AS [type], rowStart.name AS [rowStart], rowEnd.name AS [rowEnd] FROM sys.periods p
      INNER JOIN sys.columns rowStart ON p.object_id = rowStart.object_id AND p.start_column_id = rowStart.column_id
      INNER JOIN sys.columns rowEnd ON p.object_id = rowEnd.object_id AND p.end_column_id = rowEnd.column_id`,
    });
  });

  it('generates a query that shows the temporal periods of a table', () => {
    expectsql(() => queryGenerator.showTemporalPeriodsQuery({ tableOrModel: 'myTable' }), {
      default: notImplementedError,
      mssql: `SELECT p.name, p.period_type_desc AS [type], rowStart.name AS [rowStart], rowEnd.name AS [rowEnd] FROM sys.periods p
      INNER JOIN sys.columns rowStart ON p.object_id = rowStart.object_id AND p.start_column_id = rowStart.column_id
      INNER JOIN sys.columns rowEnd ON p.object_id = rowEnd.object_id AND p.end_column_id = rowEnd.column_id
      WHERE p.object_id = OBJECT_ID('[myTable]', 'U')`,
    });
  });

  it('generates a query that shows the temporal periods for a model', () => {
    const MyModel = sequelize.define('MyModel', {});

    expectsql(() => queryGenerator.showTemporalPeriodsQuery({ tableOrModel: MyModel }), {
      default: notImplementedError,
      mssql: `SELECT p.name, p.period_type_desc AS [type], rowStart.name AS [rowStart], rowEnd.name AS [rowEnd] FROM sys.periods p
      INNER JOIN sys.columns rowStart ON p.object_id = rowStart.object_id AND p.start_column_id = rowStart.column_id
      INNER JOIN sys.columns rowEnd ON p.object_id = rowEnd.object_id AND p.end_column_id = rowEnd.column_id
      WHERE p.object_id = OBJECT_ID('[MyModels]', 'U')`,
    });
  });

  it('generates a query that shows the temporal periods for a model definition', () => {
    const MyModel = sequelize.define('MyModel', {});

    expectsql(
      () => queryGenerator.showTemporalPeriodsQuery({ tableOrModel: MyModel.modelDefinition }),
      {
        default: notImplementedError,
        mssql: `SELECT p.name, p.period_type_desc AS [type], rowStart.name AS [rowStart], rowEnd.name AS [rowEnd] FROM sys.periods p
        INNER JOIN sys.columns rowStart ON p.object_id = rowStart.object_id AND p.start_column_id = rowStart.column_id
        INNER JOIN sys.columns rowEnd ON p.object_id = rowEnd.object_id AND p.end_column_id = rowEnd.column_id
        WHERE p.object_id = OBJECT_ID('[MyModels]', 'U')`,
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
        mssql: `SELECT p.name, p.period_type_desc AS [type], rowStart.name AS [rowStart], rowEnd.name AS [rowEnd] FROM sys.periods p
        INNER JOIN sys.columns rowStart ON p.object_id = rowStart.object_id AND p.start_column_id = rowStart.column_id
        INNER JOIN sys.columns rowEnd ON p.object_id = rowEnd.object_id AND p.end_column_id = rowEnd.column_id
        WHERE p.object_id = OBJECT_ID('[mySchema].[myTable]', 'U')`,
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
        mssql: `SELECT p.name, p.period_type_desc AS [type], rowStart.name AS [rowStart], rowEnd.name AS [rowEnd] FROM sys.periods p
        INNER JOIN sys.columns rowStart ON p.object_id = rowStart.object_id AND p.start_column_id = rowStart.column_id
        INNER JOIN sys.columns rowEnd ON p.object_id = rowEnd.object_id AND p.end_column_id = rowEnd.column_id
        WHERE p.object_id = OBJECT_ID('[myTable]', 'U')`,
      },
    );
  });

  it('generates a query that shows the temporal periods of a table with a globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.queryGenerator;

    expectsql(() => queryGeneratorSchema.showTemporalPeriodsQuery({ tableOrModel: 'myTable' }), {
      default: notImplementedError,
      mssql: `SELECT p.name, p.period_type_desc AS [type], rowStart.name AS [rowStart], rowEnd.name AS [rowEnd] FROM sys.periods p
      INNER JOIN sys.columns rowStart ON p.object_id = rowStart.object_id AND p.start_column_id = rowStart.column_id
      INNER JOIN sys.columns rowEnd ON p.object_id = rowEnd.object_id AND p.end_column_id = rowEnd.column_id
      WHERE p.object_id = OBJECT_ID('[mySchema].[myTable]', 'U')`,
    });
  });
});
