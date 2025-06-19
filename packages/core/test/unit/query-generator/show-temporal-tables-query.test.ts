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
      mssql: `SELECT t.[name] AS [tableName], s.[name] AS [schema], t.[temporal_type_desc] AS [type], h.[name] AS [historyTableName],
      OBJECT_SCHEMA_NAME(h.object_id) AS [historySchema], t.[history_retention_period] AS [historyRetentionPeriodLength], t.[history_retention_period_unit_desc] AS [historyRetentionPeriodUnit]
      FROM sys.tables t INNER JOIN sys.schemas s ON t.schema_id = s.schema_id LEFT JOIN sys.tables h ON t.history_table_id = h.object_id
      WHERE t.temporal_type_desc = 'SYSTEM_VERSIONED_TEMPORAL_TABLE'`,
    });
  });

  it('generates a query that shows the temporal tables for a table', () => {
    expectsql(() => queryGenerator.showTemporalTablesQuery({ tableOrModel: 'myTable' }), {
      default: notImplementedError,
      mssql: `SELECT t.[name] AS [tableName], s.[name] AS [schema], t.[temporal_type_desc] AS [type], h.[name] AS [historyTableName],
      OBJECT_SCHEMA_NAME(h.object_id) AS [historySchema], t.[history_retention_period] AS [historyRetentionPeriodLength], t.[history_retention_period_unit_desc] AS [historyRetentionPeriodUnit]
      FROM sys.tables t INNER JOIN sys.schemas s ON t.schema_id = s.schema_id LEFT JOIN sys.tables h ON t.history_table_id = h.object_id
      WHERE t.temporal_type_desc = 'SYSTEM_VERSIONED_TEMPORAL_TABLE' AND t.[name] = N'myTable' AND s.[name] = N'${dialect.getDefaultSchema()}'`,
    });
  });

  it('generates a query that shows the temporal tables for a model', () => {
    const MyModel = sequelize.define('MyModel', {});

    expectsql(() => queryGenerator.showTemporalTablesQuery({ tableOrModel: MyModel }), {
      default: notImplementedError,
      mssql: `SELECT t.[name] AS [tableName], s.[name] AS [schema], t.[temporal_type_desc] AS [type], h.[name] AS [historyTableName],
      OBJECT_SCHEMA_NAME(h.object_id) AS [historySchema], t.[history_retention_period] AS [historyRetentionPeriodLength], t.[history_retention_period_unit_desc] AS [historyRetentionPeriodUnit]
      FROM sys.tables t INNER JOIN sys.schemas s ON t.schema_id = s.schema_id LEFT JOIN sys.tables h ON t.history_table_id = h.object_id
      WHERE t.temporal_type_desc = 'SYSTEM_VERSIONED_TEMPORAL_TABLE' AND t.[name] = N'MyModels' AND s.[name] = N'${dialect.getDefaultSchema()}'`,
    });
  });

  it('generates a query that shows the temporal tables for a model definition', () => {
    const MyModel = sequelize.define('MyModel', {});

    expectsql(
      () => queryGenerator.showTemporalTablesQuery({ tableOrModel: MyModel.modelDefinition }),
      {
        default: notImplementedError,
        mssql: `SELECT t.[name] AS [tableName], s.[name] AS [schema], t.[temporal_type_desc] AS [type], h.[name] AS [historyTableName],
        OBJECT_SCHEMA_NAME(h.object_id) AS [historySchema], t.[history_retention_period] AS [historyRetentionPeriodLength], t.[history_retention_period_unit_desc] AS [historyRetentionPeriodUnit]
        FROM sys.tables t INNER JOIN sys.schemas s ON t.schema_id = s.schema_id LEFT JOIN sys.tables h ON t.history_table_id = h.object_id
        WHERE t.temporal_type_desc = 'SYSTEM_VERSIONED_TEMPORAL_TABLE' AND t.[name] = N'MyModels' AND s.[name] = N'${dialect.getDefaultSchema()}'`,
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
        mssql: `SELECT t.[name] AS [tableName], s.[name] AS [schema], t.[temporal_type_desc] AS [type], h.[name] AS [historyTableName],
        OBJECT_SCHEMA_NAME(h.object_id) AS [historySchema], t.[history_retention_period] AS [historyRetentionPeriodLength], t.[history_retention_period_unit_desc] AS [historyRetentionPeriodUnit]
        FROM sys.tables t INNER JOIN sys.schemas s ON t.schema_id = s.schema_id LEFT JOIN sys.tables h ON t.history_table_id = h.object_id
        WHERE t.temporal_type_desc = 'SYSTEM_VERSIONED_TEMPORAL_TABLE' AND t.[name] = N'myTable' AND s.[name] = N'mySchema'`,
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
        mssql: `SELECT t.[name] AS [tableName], s.[name] AS [schema], t.[temporal_type_desc] AS [type], h.[name] AS [historyTableName],
        OBJECT_SCHEMA_NAME(h.object_id) AS [historySchema], t.[history_retention_period] AS [historyRetentionPeriodLength], t.[history_retention_period_unit_desc] AS [historyRetentionPeriodUnit]
        FROM sys.tables t INNER JOIN sys.schemas s ON t.schema_id = s.schema_id LEFT JOIN sys.tables h ON t.history_table_id = h.object_id
        WHERE t.temporal_type_desc = 'SYSTEM_VERSIONED_TEMPORAL_TABLE' AND t.[name] = N'myTable' AND s.[name] = N'${dialect.getDefaultSchema()}'`,
      },
    );
  });

  it('generates a query that shows the temporal tables for a table with a globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.queryGenerator;

    expectsql(() => queryGeneratorSchema.showTemporalTablesQuery({ tableOrModel: 'myTable' }), {
      default: notImplementedError,
      mssql: `SELECT t.[name] AS [tableName], s.[name] AS [schema], t.[temporal_type_desc] AS [type], h.[name] AS [historyTableName],
      OBJECT_SCHEMA_NAME(h.object_id) AS [historySchema], t.[history_retention_period] AS [historyRetentionPeriodLength], t.[history_retention_period_unit_desc] AS [historyRetentionPeriodUnit]
      FROM sys.tables t INNER JOIN sys.schemas s ON t.schema_id = s.schema_id LEFT JOIN sys.tables h ON t.history_table_id = h.object_id
      WHERE t.temporal_type_desc = 'SYSTEM_VERSIONED_TEMPORAL_TABLE' AND t.[name] = N'myTable' AND s.[name] = N'mySchema'`,
    });
  });
});
