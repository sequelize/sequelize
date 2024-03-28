import { HistoryRetentionPeriodUnit, TemporalTableType } from '@sequelize/core';
import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import { createSequelizeInstance, expectsql, getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();
const notSupportedError = new Error(
  `addTemporalTableQuery has not been implemented in ${dialectName}.`,
);
const biTemporalNotSupportedError = new Error(
  `BITEMPORAL tables are not supported in ${dialectName}.`,
);
const applicationPeriodNotSupportedError = new Error(
  `APPLICATION_PERIOD tables are not supported in ${dialectName}.`,
);

describe('QueryGenerator#addTemporalTableQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  describe('Application-period', () => {
    it('produces an addTemporalTableQuery query for a table', () => {
      expectsql(
        () =>
          queryGenerator.addTemporalTableQuery('myTable', {
            temporalTableType: TemporalTableType.APPLICATION_PERIOD,
          }),
        {
          default: notSupportedError,
          mssql: applicationPeriodNotSupportedError,
        },
      );
    });

    it('produces an addTemporalTableQuery query for a table with custom row start and end columns', () => {
      expectsql(
        () =>
          queryGenerator.addTemporalTableQuery('myTable', {
            applicationPeriodRowEnd: 'app_row_end',
            applicationPeriodRowStart: 'app_row_start',
            temporalTableType: TemporalTableType.APPLICATION_PERIOD,
          }),
        {
          default: notSupportedError,
          mssql: buildInvalidOptionReceivedError('addTemporalTableQuery', dialectName, [
            'applicationPeriodRowEnd',
            'applicationPeriodRowStart',
          ]),
        },
      );
    });

    it('produces an addTemporalTableQuery query for a model', () => {
      const MyModel = sequelize.define('MyModel', {});

      expectsql(
        () =>
          queryGenerator.addTemporalTableQuery(MyModel, {
            temporalTableType: TemporalTableType.APPLICATION_PERIOD,
          }),
        {
          default: notSupportedError,
          mssql: applicationPeriodNotSupportedError,
        },
      );
    });

    it('produces an addTemporalTableQuery query for a model definition', () => {
      const MyModel = sequelize.define('MyModel', {});

      expectsql(
        () =>
          queryGenerator.addTemporalTableQuery(MyModel.modelDefinition, {
            temporalTableType: TemporalTableType.APPLICATION_PERIOD,
          }),
        {
          default: notSupportedError,
          mssql: applicationPeriodNotSupportedError,
        },
      );
    });

    it('produces an addTemporalTableQuery query for a table with custom schema', () => {
      expectsql(
        () =>
          queryGenerator.addTemporalTableQuery(
            { tableName: 'myTable', schema: 'mySchema' },
            { temporalTableType: TemporalTableType.APPLICATION_PERIOD },
          ),
        {
          default: notSupportedError,
          mssql: applicationPeriodNotSupportedError,
        },
      );
    });

    it('produces an addTemporalTableQuery query for a table with default schema', () => {
      expectsql(
        () =>
          queryGenerator.addTemporalTableQuery(
            { tableName: 'myTable', schema: sequelize.dialect.getDefaultSchema() },
            { temporalTableType: TemporalTableType.APPLICATION_PERIOD },
          ),
        {
          default: notSupportedError,
          mssql: applicationPeriodNotSupportedError,
        },
      );
    });

    it('produces an addTemporalTableQuery query for a table with globally set schema', () => {
      const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
      const queryGeneratorSchema = sequelizeSchema.queryGenerator;

      expectsql(
        () =>
          queryGeneratorSchema.addTemporalTableQuery('myTable', {
            temporalTableType: TemporalTableType.APPLICATION_PERIOD,
          }),
        {
          default: notSupportedError,
          mssql: applicationPeriodNotSupportedError,
        },
      );
    });
  });

  describe('Bi-temporal', () => {
    it('produces an addTemporalTableQuery query for a new table', () => {
      expectsql(
        () =>
          queryGenerator.addTemporalTableQuery('myTable', {
            temporalTableType: TemporalTableType.BITEMPORAL,
          }),
        {
          default: notSupportedError,
          mssql: biTemporalNotSupportedError,
        },
      );
    });

    it('produces an addTemporalTableQuery query for a table with custom row start and end columns', () => {
      expectsql(
        () =>
          queryGenerator.addTemporalTableQuery('myTable', {
            applicationPeriodRowEnd: 'app_row_end',
            applicationPeriodRowStart: 'app_row_start',
            systemPeriodRowEnd: 'sys_row_end',
            systemPeriodRowStart: 'sys_row_start',
            temporalTableType: TemporalTableType.BITEMPORAL,
          }),
        {
          default: notSupportedError,
          mssql: buildInvalidOptionReceivedError('addTemporalTableQuery', dialectName, [
            'applicationPeriodRowEnd',
            'applicationPeriodRowStart',
          ]),
        },
      );
    });

    it('produces an addTemporalTableQuery query for a table with custom history table name', () => {
      expectsql(
        () =>
          queryGenerator.addTemporalTableQuery('myTable', {
            historyTableName: 'myHistory',
            temporalTableType: TemporalTableType.BITEMPORAL,
          }),
        {
          default: notSupportedError,
          mssql: biTemporalNotSupportedError,
        },
      );
    });

    it('produces an addTemporalTableQuery query for a table with custom history retention period', () => {
      expectsql(
        () =>
          queryGenerator.addTemporalTableQuery('myTable', {
            historyRetentionPeriod: { length: 3, unit: HistoryRetentionPeriodUnit.MONTH },
            temporalTableType: TemporalTableType.BITEMPORAL,
          }),
        {
          default: notSupportedError,
          mssql: biTemporalNotSupportedError,
        },
      );
    });

    it('produces an addTemporalTableQuery query for a table with custom history table name and history retention period', () => {
      expectsql(
        () =>
          queryGenerator.addTemporalTableQuery('myTable', {
            historyTableName: 'myHistory',
            historyRetentionPeriod: { length: 3, unit: HistoryRetentionPeriodUnit.MONTH },
            temporalTableType: TemporalTableType.BITEMPORAL,
          }),
        {
          default: notSupportedError,
          mssql: biTemporalNotSupportedError,
        },
      );
    });

    it('produces an addTemporalTableQuery query for a model', () => {
      const MyModel = sequelize.define('MyModel', {});

      expectsql(
        () =>
          queryGenerator.addTemporalTableQuery(MyModel, {
            temporalTableType: TemporalTableType.BITEMPORAL,
          }),
        {
          default: notSupportedError,
          mssql: biTemporalNotSupportedError,
        },
      );
    });

    it('produces an addTemporalTableQuery query for a model definition', () => {
      const MyModel = sequelize.define('MyModel', {});

      expectsql(
        () =>
          queryGenerator.addTemporalTableQuery(MyModel, {
            temporalTableType: TemporalTableType.BITEMPORAL,
          }),
        {
          default: notSupportedError,
          mssql: biTemporalNotSupportedError,
        },
      );
    });

    it('produces an addTemporalTableQuery query for a table with custom schema', () => {
      expectsql(
        () =>
          queryGenerator.addTemporalTableQuery(
            { tableName: 'myTable', schema: 'mySchema' },
            { temporalTableType: TemporalTableType.BITEMPORAL },
          ),
        {
          default: notSupportedError,
          mssql: biTemporalNotSupportedError,
        },
      );
    });

    it('produces an addTemporalTableQuery query for a table with default schema', () => {
      expectsql(
        () =>
          queryGenerator.addTemporalTableQuery(
            { tableName: 'myTable', schema: sequelize.dialect.getDefaultSchema() },
            { temporalTableType: TemporalTableType.BITEMPORAL },
          ),
        {
          default: notSupportedError,
          mssql: biTemporalNotSupportedError,
        },
      );
    });

    it('produces an addTemporalTableQuery query for a table with globally set schema', () => {
      const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
      const queryGeneratorSchema = sequelizeSchema.queryGenerator;

      expectsql(
        () =>
          queryGeneratorSchema.addTemporalTableQuery('myTable', {
            temporalTableType: TemporalTableType.BITEMPORAL,
          }),
        {
          default: notSupportedError,
          mssql: biTemporalNotSupportedError,
        },
      );
    });
  });

  describe('System-versioned', () => {
    it('produces an addTemporalTableQuery query for a new table', () => {
      expectsql(
        () =>
          queryGenerator.addTemporalTableQuery('myTable', {
            temporalTableType: TemporalTableType.SYSTEM_PERIOD,
          }),
        {
          default: notSupportedError,
          mssql: `ALTER TABLE [myTable] ADD
        [SysStartTime] DATETIME2 GENERATED ALWAYS AS ROW START HIDDEN NOT NULL DEFAULT SYSUTCDATETIME(),
        [SysEndTime] DATETIME2 GENERATED ALWAYS AS ROW END HIDDEN NOT NULL DEFAULT CONVERT(DATETIME2, '9999-12-31 23:59:59.99999999'),
        PERIOD FOR SYSTEM_TIME ([SysStartTime], [SysEndTime]);
        ALTER TABLE [myTable] SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = [dbo].[myTable_history]));`,
        },
      );
    });

    it('produces an addTemporalTableQuery query for a table with custom row start and end columns', () => {
      expectsql(
        () =>
          queryGenerator.addTemporalTableQuery(
            { tableName: 'myTable', schema: 'mySchema' },
            {
              systemPeriodRowEnd: 'sys_row_end',
              systemPeriodRowStart: 'sys_row_start',
              temporalTableType: TemporalTableType.SYSTEM_PERIOD,
            },
          ),
        {
          default: notSupportedError,
          mssql: `ALTER TABLE [mySchema].[myTable] ADD
        [sys_row_start] DATETIME2 GENERATED ALWAYS AS ROW START HIDDEN NOT NULL DEFAULT SYSUTCDATETIME(),
        [sys_row_end] DATETIME2 GENERATED ALWAYS AS ROW END HIDDEN NOT NULL DEFAULT CONVERT(DATETIME2, '9999-12-31 23:59:59.99999999'),
        PERIOD FOR SYSTEM_TIME ([sys_row_start], [sys_row_end]);
        ALTER TABLE [mySchema].[myTable] SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = [mySchema].[myTable_history]));`,
        },
      );
    });

    it('produces an addTemporalTableQuery query for a table with custom history table name', () => {
      expectsql(
        () =>
          queryGenerator.addTemporalTableQuery('myTable', {
            historyTableName: 'myHistory',
            temporalTableType: TemporalTableType.SYSTEM_PERIOD,
          }),
        {
          default: notSupportedError,
          mssql: `ALTER TABLE [myTable] ADD
        [SysStartTime] DATETIME2 GENERATED ALWAYS AS ROW START HIDDEN NOT NULL DEFAULT SYSUTCDATETIME(),
        [SysEndTime] DATETIME2 GENERATED ALWAYS AS ROW END HIDDEN NOT NULL DEFAULT CONVERT(DATETIME2, '9999-12-31 23:59:59.99999999'),
        PERIOD FOR SYSTEM_TIME ([SysStartTime], [SysEndTime]);
        ALTER TABLE [myTable] SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = [dbo].[myHistory]));`,
        },
      );
    });

    it('produces an addTemporalTableQuery query for a table with custom history retention period', () => {
      expectsql(
        () =>
          queryGenerator.addTemporalTableQuery('myTable', {
            historyRetentionPeriod: { length: 3, unit: HistoryRetentionPeriodUnit.MONTH },
            temporalTableType: TemporalTableType.SYSTEM_PERIOD,
          }),
        {
          default: notSupportedError,
          mssql: `ALTER TABLE [myTable] ADD
        [SysStartTime] DATETIME2 GENERATED ALWAYS AS ROW START HIDDEN NOT NULL DEFAULT SYSUTCDATETIME(),
        [SysEndTime] DATETIME2 GENERATED ALWAYS AS ROW END HIDDEN NOT NULL DEFAULT CONVERT(DATETIME2, '9999-12-31 23:59:59.99999999'),
        PERIOD FOR SYSTEM_TIME ([SysStartTime], [SysEndTime]);
        ALTER TABLE [myTable] SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = [dbo].[myTable_history], HISTORY_RETENTION_PERIOD = 3 MONTH));`,
        },
      );
    });

    it('produces an addTemporalTableQuery query for a table with custom history table name and history retention period', () => {
      expectsql(
        () =>
          queryGenerator.addTemporalTableQuery('myTable', {
            historyTableName: 'myHistory',
            historyRetentionPeriod: { length: 3, unit: HistoryRetentionPeriodUnit.MONTH },
            temporalTableType: TemporalTableType.SYSTEM_PERIOD,
          }),
        {
          default: notSupportedError,
          mssql: `ALTER TABLE [myTable] ADD
        [SysStartTime] DATETIME2 GENERATED ALWAYS AS ROW START HIDDEN NOT NULL DEFAULT SYSUTCDATETIME(),
        [SysEndTime] DATETIME2 GENERATED ALWAYS AS ROW END HIDDEN NOT NULL DEFAULT CONVERT(DATETIME2, '9999-12-31 23:59:59.99999999'),
        PERIOD FOR SYSTEM_TIME ([SysStartTime], [SysEndTime]);
        ALTER TABLE [myTable] SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = [dbo].[myHistory], HISTORY_RETENTION_PERIOD = 3 MONTH));`,
        },
      );
    });

    it('produces an addTemporalTableQuery query for a model', () => {
      const MyModel = sequelize.define('MyModel', {});

      expectsql(
        () =>
          queryGenerator.addTemporalTableQuery(MyModel, {
            temporalTableType: TemporalTableType.SYSTEM_PERIOD,
          }),
        {
          default: notSupportedError,
          mssql: `ALTER TABLE [MyModels] ADD
        [SysStartTime] DATETIME2 GENERATED ALWAYS AS ROW START HIDDEN NOT NULL DEFAULT SYSUTCDATETIME(),
        [SysEndTime] DATETIME2 GENERATED ALWAYS AS ROW END HIDDEN NOT NULL DEFAULT CONVERT(DATETIME2, '9999-12-31 23:59:59.99999999'),
        PERIOD FOR SYSTEM_TIME ([SysStartTime], [SysEndTime]);
        ALTER TABLE [MyModels] SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = [dbo].[MyModels_history]));`,
        },
      );
    });

    it('produces an addTemporalTableQuery query for a model definition', () => {
      const MyModel = sequelize.define('MyModel', {});

      expectsql(
        () =>
          queryGenerator.addTemporalTableQuery(MyModel.modelDefinition, {
            temporalTableType: TemporalTableType.SYSTEM_PERIOD,
          }),
        {
          default: notSupportedError,
          mssql: `ALTER TABLE [MyModels] ADD
        [SysStartTime] DATETIME2 GENERATED ALWAYS AS ROW START HIDDEN NOT NULL DEFAULT SYSUTCDATETIME(),
        [SysEndTime] DATETIME2 GENERATED ALWAYS AS ROW END HIDDEN NOT NULL DEFAULT CONVERT(DATETIME2, '9999-12-31 23:59:59.99999999'),
        PERIOD FOR SYSTEM_TIME ([SysStartTime], [SysEndTime]);
        ALTER TABLE [MyModels] SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = [dbo].[MyModels_history]));`,
        },
      );
    });

    it('produces an addTemporalTableQuery query for a table with custom schema', () => {
      expectsql(
        () =>
          queryGenerator.addTemporalTableQuery(
            { tableName: 'myTable', schema: 'mySchema' },
            { temporalTableType: TemporalTableType.SYSTEM_PERIOD },
          ),
        {
          default: notSupportedError,
          mssql: `ALTER TABLE [mySchema].[myTable] ADD
        [SysStartTime] DATETIME2 GENERATED ALWAYS AS ROW START HIDDEN NOT NULL DEFAULT SYSUTCDATETIME(),
        [SysEndTime] DATETIME2 GENERATED ALWAYS AS ROW END HIDDEN NOT NULL DEFAULT CONVERT(DATETIME2, '9999-12-31 23:59:59.99999999'),
        PERIOD FOR SYSTEM_TIME ([SysStartTime], [SysEndTime]);
        ALTER TABLE [mySchema].[myTable] SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = [mySchema].[myTable_history]));`,
        },
      );
    });

    it('produces an addTemporalTableQuery query for a table with default schema', () => {
      expectsql(
        () =>
          queryGenerator.addTemporalTableQuery(
            { tableName: 'myTable', schema: sequelize.dialect.getDefaultSchema() },
            { temporalTableType: TemporalTableType.SYSTEM_PERIOD },
          ),
        {
          default: notSupportedError,
          mssql: `ALTER TABLE [myTable] ADD
        [SysStartTime] DATETIME2 GENERATED ALWAYS AS ROW START HIDDEN NOT NULL DEFAULT SYSUTCDATETIME(),
        [SysEndTime] DATETIME2 GENERATED ALWAYS AS ROW END HIDDEN NOT NULL DEFAULT CONVERT(DATETIME2, '9999-12-31 23:59:59.99999999'),
        PERIOD FOR SYSTEM_TIME ([SysStartTime], [SysEndTime]);
        ALTER TABLE [myTable] SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = [dbo].[myTable_history]));`,
        },
      );
    });

    it('produces an addTemporalTableQuery query for a table with globally set schema', () => {
      const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
      const queryGeneratorSchema = sequelizeSchema.queryGenerator;

      expectsql(
        () =>
          queryGeneratorSchema.addTemporalTableQuery('myTable', {
            temporalTableType: TemporalTableType.SYSTEM_PERIOD,
          }),
        {
          default: notSupportedError,
          mssql: `ALTER TABLE [mySchema].[myTable] ADD
        [SysStartTime] DATETIME2 GENERATED ALWAYS AS ROW START HIDDEN NOT NULL DEFAULT SYSUTCDATETIME(),
        [SysEndTime] DATETIME2 GENERATED ALWAYS AS ROW END HIDDEN NOT NULL DEFAULT CONVERT(DATETIME2, '9999-12-31 23:59:59.99999999'),
        PERIOD FOR SYSTEM_TIME ([SysStartTime], [SysEndTime]);
        ALTER TABLE [mySchema].[myTable] SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = [mySchema].[myTable_history]));`,
        },
      );
    });
  });
});
