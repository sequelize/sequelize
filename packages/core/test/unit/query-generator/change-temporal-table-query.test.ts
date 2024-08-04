import { HistoryRetentionPeriodUnit, TemporalTableType } from '@sequelize/core';
import { createSequelizeInstance, expectsql, getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();
const notSupportedError = new Error(
  `changeTemporalTableQuery has not been implemented in ${dialectName}.`,
);
const biTemporalNotSupportedError = new Error(
  `BITEMPORAL tables are not supported in ${dialectName}.`,
);

describe('QueryGenerator#changeTemporalTableQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('produces an changeTemporalTableQuery query to disable a temporal table', () => {
    expectsql(
      () =>
        queryGenerator.changeTemporalTableQuery('myTable', {
          temporalTableType: TemporalTableType.NON_TEMPORAL,
        }),
      {
        default: notSupportedError,
        mssql: 'ALTER TABLE [myTable] SET (SYSTEM_VERSIONING = OFF)',
      },
    );
  });

  it('produces an changeTemporalTableQuery query to disable a temporal table for a model', () => {
    const MyModel = sequelize.define('MyModel', {});

    expectsql(
      () =>
        queryGenerator.changeTemporalTableQuery(MyModel, {
          temporalTableType: TemporalTableType.NON_TEMPORAL,
        }),
      {
        default: notSupportedError,
        mssql: 'ALTER TABLE [MyModels] SET (SYSTEM_VERSIONING = OFF)',
      },
    );
  });

  it('produces an changeTemporalTableQuery query to disable a temporal table for a model definition', () => {
    const MyModel = sequelize.define('MyModel', {});

    expectsql(
      () =>
        queryGenerator.changeTemporalTableQuery(MyModel.modelDefinition, {
          temporalTableType: TemporalTableType.NON_TEMPORAL,
        }),
      {
        default: notSupportedError,
        mssql: 'ALTER TABLE [MyModels] SET (SYSTEM_VERSIONING = OFF)',
      },
    );
  });

  it('produces an changeTemporalTableQuery query to disable a temporal table with a custom schema', () => {
    expectsql(
      () =>
        queryGenerator.changeTemporalTableQuery(
          { tableName: 'myTable', schema: 'mySchema' },
          { temporalTableType: TemporalTableType.NON_TEMPORAL },
        ),
      {
        default: notSupportedError,
        mssql: 'ALTER TABLE [mySchema].[myTable] SET (SYSTEM_VERSIONING = OFF)',
      },
    );
  });

  it('produces an changeTemporalTableQuery query to disable a temporal table with a default schema', () => {
    expectsql(
      () =>
        queryGenerator.changeTemporalTableQuery(
          { tableName: 'myTable', schema: sequelize.dialect.getDefaultSchema() },
          { temporalTableType: TemporalTableType.NON_TEMPORAL },
        ),
      {
        default: notSupportedError,
        mssql: 'ALTER TABLE [myTable] SET (SYSTEM_VERSIONING = OFF)',
      },
    );
  });

  it('produces an changeTemporalTableQuery query to disable a temporal table with globally set schema', () => {
    const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
    const queryGeneratorSchema = sequelizeSchema.queryGenerator;

    expectsql(
      () =>
        queryGeneratorSchema.changeTemporalTableQuery('myTable', {
          temporalTableType: TemporalTableType.NON_TEMPORAL,
        }),
      {
        default: notSupportedError,
        mssql: 'ALTER TABLE [mySchema].[myTable] SET (SYSTEM_VERSIONING = OFF)',
      },
    );
  });

  describe('Bi-temporal', () => {
    it('produces an changeTemporalTableQuery query to enable a bi-temporal table', () => {
      expectsql(
        () =>
          queryGenerator.changeTemporalTableQuery('myTable', {
            temporalTableType: TemporalTableType.BITEMPORAL,
          }),
        {
          default: notSupportedError,
          mssql: biTemporalNotSupportedError,
        },
      );
    });

    it('produces an changeTemporalTableQuery query to enable a bi-temporal table with a historyTable', () => {
      expectsql(
        () =>
          queryGenerator.changeTemporalTableQuery('myTable', {
            historyTable: 'myTable_history',
            temporalTableType: TemporalTableType.BITEMPORAL,
          }),
        {
          default: notSupportedError,
          mssql: biTemporalNotSupportedError,
        },
      );
    });

    it('produces an changeTemporalTableQuery query to change a history retention period', () => {
      expectsql(
        () =>
          queryGenerator.changeTemporalTableQuery('myTable', {
            historyRetentionPeriod: { length: 3, unit: HistoryRetentionPeriodUnit.MONTH },
            historyTable: 'myTable_history',
            temporalTableType: TemporalTableType.BITEMPORAL,
          }),
        {
          default: notSupportedError,
          mssql: biTemporalNotSupportedError,
        },
      );
    });

    it('produces an changeTemporalTableQuery query to enable a bi-temporal table for a model', () => {
      const MyModel = sequelize.define('MyModel', {});

      expectsql(
        () =>
          queryGenerator.changeTemporalTableQuery(MyModel, {
            temporalTableType: TemporalTableType.BITEMPORAL,
          }),
        {
          default: notSupportedError,
          mssql: biTemporalNotSupportedError,
        },
      );
    });

    it('produces an changeTemporalTableQuery query to enable a bi-temporal table for a model definition', () => {
      const MyModel = sequelize.define('MyModel', {});

      expectsql(
        () =>
          queryGenerator.changeTemporalTableQuery(MyModel.modelDefinition, {
            temporalTableType: TemporalTableType.BITEMPORAL,
          }),
        {
          default: notSupportedError,
          mssql: biTemporalNotSupportedError,
        },
      );
    });

    it('produces an changeTemporalTableQuery query to enable a bi-temporal table with a custom schema', () => {
      expectsql(
        () =>
          queryGenerator.changeTemporalTableQuery(
            { tableName: 'myTable', schema: 'mySchema' },
            { temporalTableType: TemporalTableType.BITEMPORAL },
          ),
        {
          default: notSupportedError,
          mssql: biTemporalNotSupportedError,
        },
      );
    });

    it('produces an changeTemporalTableQuery query to enable a bi-temporal table with a default schema', () => {
      expectsql(
        () =>
          queryGenerator.changeTemporalTableQuery(
            { tableName: 'myTable', schema: sequelize.dialect.getDefaultSchema() },
            { temporalTableType: TemporalTableType.BITEMPORAL },
          ),
        {
          default: notSupportedError,
          mssql: biTemporalNotSupportedError,
        },
      );
    });

    it('produces an changeTemporalTableQuery query to enable a bi-temporal table with globally set schema', () => {
      const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
      const queryGeneratorSchema = sequelizeSchema.queryGenerator;

      expectsql(
        () =>
          queryGeneratorSchema.changeTemporalTableQuery('myTable', {
            temporalTableType: TemporalTableType.BITEMPORAL,
          }),
        {
          default: notSupportedError,
          mssql: biTemporalNotSupportedError,
        },
      );
    });
  });

  describe('System-period', () => {
    it('produces an changeTemporalTableQuery query to enable a system-period table', () => {
      expectsql(
        () =>
          queryGenerator.changeTemporalTableQuery('myTable', {
            historyTable: 'myTableHistory',
            temporalTableType: TemporalTableType.SYSTEM_PERIOD,
          }),
        {
          default: notSupportedError,
          mssql: `ALTER TABLE [myTable] SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = [dbo].[myTableHistory]))`,
        },
      );
    });

    it('produces an changeTemporalTableQuery query to enable a system-period table with a historyTable', () => {
      expectsql(
        () =>
          queryGenerator.changeTemporalTableQuery('myTable', {
            historyTable: 'myTableHistory',
            temporalTableType: TemporalTableType.SYSTEM_PERIOD,
          }),
        {
          default: notSupportedError,
          mssql: `ALTER TABLE [myTable] SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = [dbo].[myTableHistory]))`,
        },
      );
    });

    it('produces an changeTemporalTableQuery query to enable a system-period table with a historyTable and schema', () => {
      expectsql(
        () =>
          queryGenerator.changeTemporalTableQuery('myTable', {
            historyTable: { tableName: 'myTableHistory', schema: 'mySchema' },
            temporalTableType: TemporalTableType.SYSTEM_PERIOD,
          }),
        {
          default: notSupportedError,
          mssql: `ALTER TABLE [myTable] SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = [mySchema].[myTableHistory]))`,
        },
      );
    });

    it('produces an changeTemporalTableQuery query to change a history retention period', () => {
      expectsql(
        () =>
          queryGenerator.changeTemporalTableQuery('myTable', {
            historyRetentionPeriod: { length: 3, unit: HistoryRetentionPeriodUnit.MONTH },
            historyTable: 'myTableHistory',
            temporalTableType: TemporalTableType.SYSTEM_PERIOD,
          }),
        {
          default: notSupportedError,
          mssql: `ALTER TABLE [myTable] SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = [dbo].[myTableHistory], HISTORY_RETENTION_PERIOD = 3 MONTH))`,
        },
      );
    });

    it('produces an changeTemporalTableQuery query to enable a system-period table for a model', () => {
      const MyModel = sequelize.define('MyModel', {});

      expectsql(
        () =>
          queryGenerator.changeTemporalTableQuery(MyModel, {
            historyTable: 'MyModelsHistory',
            temporalTableType: TemporalTableType.SYSTEM_PERIOD,
          }),
        {
          default: notSupportedError,
          mssql: `ALTER TABLE [MyModels] SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = [dbo].[MyModelsHistory]))`,
        },
      );
    });

    it('produces an changeTemporalTableQuery query to enable a system-period table for a model definition', () => {
      const MyModel = sequelize.define('MyModel', {});

      expectsql(
        () =>
          queryGenerator.changeTemporalTableQuery(MyModel.modelDefinition, {
            historyTable: 'MyModelsHistory',
            temporalTableType: TemporalTableType.SYSTEM_PERIOD,
          }),
        {
          default: notSupportedError,
          mssql: `ALTER TABLE [MyModels] SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = [dbo].[MyModelsHistory]))`,
        },
      );
    });

    it('produces an changeTemporalTableQuery query to enable a system-period table with a custom schema', () => {
      expectsql(
        () =>
          queryGenerator.changeTemporalTableQuery(
            { tableName: 'myTable', schema: 'mySchema' },
            {
              historyTable: 'myTableHistory',
              temporalTableType: TemporalTableType.SYSTEM_PERIOD,
            },
          ),
        {
          default: notSupportedError,
          mssql: `ALTER TABLE [mySchema].[myTable] SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = [dbo].[myTableHistory]))`,
        },
      );
    });

    it('produces an changeTemporalTableQuery query to enable a system-period table with a default schema', () => {
      expectsql(
        () =>
          queryGenerator.changeTemporalTableQuery(
            { tableName: 'myTable', schema: sequelize.dialect.getDefaultSchema() },
            {
              historyTable: 'myTableHistory',
              temporalTableType: TemporalTableType.SYSTEM_PERIOD,
            },
          ),
        {
          default: notSupportedError,
          mssql: `ALTER TABLE [myTable] SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = [dbo].[myTableHistory]))`,
        },
      );
    });

    it('produces an changeTemporalTableQuery query to enable a system-period table with globally set schema', () => {
      const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
      const queryGeneratorSchema = sequelizeSchema.queryGenerator;

      expectsql(
        () =>
          queryGeneratorSchema.changeTemporalTableQuery('myTable', {
            historyTable: 'myTableHistory',
            temporalTableType: TemporalTableType.SYSTEM_PERIOD,
          }),
        {
          default: notSupportedError,
          mssql: `ALTER TABLE [mySchema].[myTable] SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = [mySchema].[myTableHistory]))`,
        },
      );
    });
  });
});
