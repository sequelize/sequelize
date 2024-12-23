import { HistoryRetentionPeriodUnit, TemporalTableType } from '@sequelize/core';
import { buildInvalidOptionReceivedError } from '@sequelize/core/_non-semver-use-at-your-own-risk_/utils/check.js';
import {
  createSequelizeInstance,
  expectPerDialect,
  getTestDialect,
  sequelize,
  toMatchSql,
} from '../../support';

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
    it('throws an error if application row start & end values are not specified', () => {
      expectPerDialect(
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

    it('produces an addTemporalTableQuery query for a table', () => {
      expectPerDialect(
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

      expectPerDialect(
        () =>
          queryGenerator.addTemporalTableQuery(MyModel, {
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

    it('produces an addTemporalTableQuery query for a model definition', () => {
      const MyModel = sequelize.define('MyModel', {});

      expectPerDialect(
        () =>
          queryGenerator.addTemporalTableQuery(MyModel.modelDefinition, {
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

    it('produces an addTemporalTableQuery query for a table with custom schema', () => {
      expectPerDialect(
        () =>
          queryGenerator.addTemporalTableQuery(
            { tableName: 'myTable', schema: 'mySchema' },
            {
              applicationPeriodRowEnd: 'app_row_end',
              applicationPeriodRowStart: 'app_row_start',
              temporalTableType: TemporalTableType.APPLICATION_PERIOD,
            },
          ),
        {
          default: notSupportedError,
          mssql: buildInvalidOptionReceivedError('addTemporalTableQuery', dialectName, [
            'applicationPeriodRowEnd',
            'applicationPeriodRowStart',
          ]),
        },
      );
    });

    it('produces an addTemporalTableQuery query for a table with default schema', () => {
      expectPerDialect(
        () =>
          queryGenerator.addTemporalTableQuery(
            { tableName: 'myTable', schema: sequelize.dialect.getDefaultSchema() },
            {
              applicationPeriodRowEnd: 'app_row_end',
              applicationPeriodRowStart: 'app_row_start',
              temporalTableType: TemporalTableType.APPLICATION_PERIOD,
            },
          ),
        {
          default: notSupportedError,
          mssql: buildInvalidOptionReceivedError('addTemporalTableQuery', dialectName, [
            'applicationPeriodRowEnd',
            'applicationPeriodRowStart',
          ]),
        },
      );
    });

    it('produces an addTemporalTableQuery query for a table with globally set schema', () => {
      const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
      const queryGeneratorSchema = sequelizeSchema.queryGenerator;

      expectPerDialect(
        () =>
          queryGeneratorSchema.addTemporalTableQuery('myTable', {
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
  });

  describe('Bi-temporal', () => {
    it('throws an error if application row start & end values are not specified', () => {
      expectPerDialect(
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

    it('produces an addTemporalTableQuery query for a table', () => {
      expectPerDialect(
        () =>
          queryGenerator.addTemporalTableQuery('myTable', {
            applicationPeriodRowEnd: 'app_row_end',
            applicationPeriodRowStart: 'app_row_start',
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

    it('produces an addTemporalTableQuery query for a table with custom row start and end columns', () => {
      expectPerDialect(
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
      expectPerDialect(
        () =>
          queryGenerator.addTemporalTableQuery('myTable', {
            applicationPeriodRowEnd: 'app_row_end',
            applicationPeriodRowStart: 'app_row_start',
            historyTable: 'myHistory',
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

    it('produces an addTemporalTableQuery query for a table with custom history retention period', () => {
      expectPerDialect(
        () =>
          queryGenerator.addTemporalTableQuery('myTable', {
            applicationPeriodRowEnd: 'app_row_end',
            applicationPeriodRowStart: 'app_row_start',
            historyRetentionPeriod: { length: 3, unit: HistoryRetentionPeriodUnit.MONTH },
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

    it('produces an addTemporalTableQuery query for a table with custom history table name and history retention period', () => {
      expectPerDialect(
        () =>
          queryGenerator.addTemporalTableQuery('myTable', {
            applicationPeriodRowEnd: 'app_row_end',
            applicationPeriodRowStart: 'app_row_start',
            historyTable: 'myHistory',
            historyRetentionPeriod: { length: 3, unit: HistoryRetentionPeriodUnit.MONTH },
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

    it('produces an addTemporalTableQuery query for a model', () => {
      const MyModel = sequelize.define('MyModel', {});

      expectPerDialect(
        () =>
          queryGenerator.addTemporalTableQuery(MyModel, {
            applicationPeriodRowEnd: 'app_row_end',
            applicationPeriodRowStart: 'app_row_start',
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

    it('produces an addTemporalTableQuery query for a model definition', () => {
      const MyModel = sequelize.define('MyModel', {});

      expectPerDialect(
        () =>
          queryGenerator.addTemporalTableQuery(MyModel, {
            applicationPeriodRowEnd: 'app_row_end',
            applicationPeriodRowStart: 'app_row_start',
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

    it('produces an addTemporalTableQuery query for a table with custom schema', () => {
      expectPerDialect(
        () =>
          queryGenerator.addTemporalTableQuery(
            { tableName: 'myTable', schema: 'mySchema' },
            {
              applicationPeriodRowEnd: 'app_row_end',
              applicationPeriodRowStart: 'app_row_start',
              temporalTableType: TemporalTableType.BITEMPORAL,
            },
          ),
        {
          default: notSupportedError,
          mssql: buildInvalidOptionReceivedError('addTemporalTableQuery', dialectName, [
            'applicationPeriodRowEnd',
            'applicationPeriodRowStart',
          ]),
        },
      );
    });

    it('produces an addTemporalTableQuery query for a table with default schema', () => {
      expectPerDialect(
        () =>
          queryGenerator.addTemporalTableQuery(
            { tableName: 'myTable', schema: sequelize.dialect.getDefaultSchema() },
            {
              applicationPeriodRowEnd: 'app_row_end',
              applicationPeriodRowStart: 'app_row_start',
              temporalTableType: TemporalTableType.BITEMPORAL,
            },
          ),
        {
          default: notSupportedError,
          mssql: buildInvalidOptionReceivedError('addTemporalTableQuery', dialectName, [
            'applicationPeriodRowEnd',
            'applicationPeriodRowStart',
          ]),
        },
      );
    });

    it('produces an addTemporalTableQuery query for a table with globally set schema', () => {
      const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
      const queryGeneratorSchema = sequelizeSchema.queryGenerator;

      expectPerDialect(
        () =>
          queryGeneratorSchema.addTemporalTableQuery('myTable', {
            applicationPeriodRowEnd: 'app_row_end',
            applicationPeriodRowStart: 'app_row_start',
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
  });

  describe('System-versioned', () => {
    it('produces an addTemporalTableQuery query for a new table', () => {
      expectPerDialect(
        () =>
          queryGenerator.addTemporalTableQuery('myTable', {
            temporalTableType: TemporalTableType.SYSTEM_PERIOD,
          }),
        {
          default: notSupportedError,
          mssql: toMatchSql([
            `ALTER TABLE [myTable] ADD
            [SysStartTime] DATETIME2 GENERATED ALWAYS AS ROW START HIDDEN NOT NULL CONSTRAINT [DF__myTable__SysStartTime] DEFAULT SYSUTCDATETIME(),
            [SysEndTime] DATETIME2 GENERATED ALWAYS AS ROW END HIDDEN NOT NULL CONSTRAINT [DF__myTable__SysEndTime] DEFAULT CONVERT(DATETIME2, '9999-12-31 23:59:59.99999999'),
            PERIOD FOR SYSTEM_TIME ([SysStartTime], [SysEndTime])`,
            `ALTER TABLE [myTable] SET (SYSTEM_VERSIONING = ON)`,
          ]),
        },
      );
    });

    it('produces an addTemporalTableQuery query for a table with custom row start and end columns', () => {
      expectPerDialect(
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
          mssql: toMatchSql([
            `ALTER TABLE [mySchema].[myTable] ADD
            [sys_row_start] DATETIME2 GENERATED ALWAYS AS ROW START HIDDEN NOT NULL CONSTRAINT [DF__myTable__sys_row_start] DEFAULT SYSUTCDATETIME(),
            [sys_row_end] DATETIME2 GENERATED ALWAYS AS ROW END HIDDEN NOT NULL CONSTRAINT [DF__myTable__sys_row_end] DEFAULT CONVERT(DATETIME2, '9999-12-31 23:59:59.99999999'),
            PERIOD FOR SYSTEM_TIME ([sys_row_start], [sys_row_end])`,
            `ALTER TABLE [mySchema].[myTable] SET (SYSTEM_VERSIONING = ON)`,
          ]),
        },
      );
    });

    it('produces an addTemporalTableQuery query for a table with custom history table name', () => {
      expectPerDialect(
        () =>
          queryGenerator.addTemporalTableQuery('myTable', {
            historyTable: 'myHistory',
            temporalTableType: TemporalTableType.SYSTEM_PERIOD,
          }),
        {
          default: notSupportedError,
          mssql: toMatchSql([
            `ALTER TABLE [myTable] ADD
            [SysStartTime] DATETIME2 GENERATED ALWAYS AS ROW START HIDDEN NOT NULL CONSTRAINT [DF__myTable__SysStartTime] DEFAULT SYSUTCDATETIME(),
            [SysEndTime] DATETIME2 GENERATED ALWAYS AS ROW END HIDDEN NOT NULL CONSTRAINT [DF__myTable__SysEndTime] DEFAULT CONVERT(DATETIME2, '9999-12-31 23:59:59.99999999'),
            PERIOD FOR SYSTEM_TIME ([SysStartTime], [SysEndTime])`,
            `ALTER TABLE [myTable] SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = [dbo].[myHistory]))`,
          ]),
        },
      );
    });

    it('produces an addTemporalTableQuery query for a table with custom history table name and schema', () => {
      expectPerDialect(
        () =>
          queryGenerator.addTemporalTableQuery('myTable', {
            historyTable: { tableName: 'myHistory', schema: 'mySchema' },
            temporalTableType: TemporalTableType.SYSTEM_PERIOD,
          }),
        {
          default: notSupportedError,
          mssql: toMatchSql([
            `ALTER TABLE [myTable] ADD
            [SysStartTime] DATETIME2 GENERATED ALWAYS AS ROW START HIDDEN NOT NULL CONSTRAINT [DF__myTable__SysStartTime] DEFAULT SYSUTCDATETIME(),
            [SysEndTime] DATETIME2 GENERATED ALWAYS AS ROW END HIDDEN NOT NULL CONSTRAINT [DF__myTable__SysEndTime] DEFAULT CONVERT(DATETIME2, '9999-12-31 23:59:59.99999999'),
            PERIOD FOR SYSTEM_TIME ([SysStartTime], [SysEndTime])`,
            `ALTER TABLE [myTable] SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = [mySchema].[myHistory]))`,
          ]),
        },
      );
    });

    it('produces an addTemporalTableQuery query for a table with custom history retention period', () => {
      expectPerDialect(
        () =>
          queryGenerator.addTemporalTableQuery('myTable', {
            historyRetentionPeriod: { length: 3, unit: HistoryRetentionPeriodUnit.MONTH },
            temporalTableType: TemporalTableType.SYSTEM_PERIOD,
          }),
        {
          default: notSupportedError,
          mssql: toMatchSql([
            `ALTER TABLE [myTable] ADD
            [SysStartTime] DATETIME2 GENERATED ALWAYS AS ROW START HIDDEN NOT NULL CONSTRAINT [DF__myTable__SysStartTime] DEFAULT SYSUTCDATETIME(),
            [SysEndTime] DATETIME2 GENERATED ALWAYS AS ROW END HIDDEN NOT NULL CONSTRAINT [DF__myTable__SysEndTime] DEFAULT CONVERT(DATETIME2, '9999-12-31 23:59:59.99999999'),
            PERIOD FOR SYSTEM_TIME ([SysStartTime], [SysEndTime])`,
            `ALTER TABLE [myTable] SET (SYSTEM_VERSIONING = ON (HISTORY_RETENTION_PERIOD = 3 MONTH))`,
          ]),
        },
      );
    });

    it('produces an addTemporalTableQuery query for a table with custom history table name and history retention period', () => {
      expectPerDialect(
        () =>
          queryGenerator.addTemporalTableQuery('myTable', {
            historyTable: 'myHistory',
            historyRetentionPeriod: { length: 3, unit: HistoryRetentionPeriodUnit.MONTH },
            temporalTableType: TemporalTableType.SYSTEM_PERIOD,
          }),
        {
          default: notSupportedError,
          mssql: toMatchSql([
            `ALTER TABLE [myTable] ADD
            [SysStartTime] DATETIME2 GENERATED ALWAYS AS ROW START HIDDEN NOT NULL CONSTRAINT [DF__myTable__SysStartTime] DEFAULT SYSUTCDATETIME(),
            [SysEndTime] DATETIME2 GENERATED ALWAYS AS ROW END HIDDEN NOT NULL CONSTRAINT [DF__myTable__SysEndTime] DEFAULT CONVERT(DATETIME2, '9999-12-31 23:59:59.99999999'),
            PERIOD FOR SYSTEM_TIME ([SysStartTime], [SysEndTime])`,
            `ALTER TABLE [myTable] SET (SYSTEM_VERSIONING = ON (HISTORY_TABLE = [dbo].[myHistory], HISTORY_RETENTION_PERIOD = 3 MONTH))`,
          ]),
        },
      );
    });

    it('produces an addTemporalTableQuery query for a model', () => {
      const MyModel = sequelize.define('MyModel', {});

      expectPerDialect(
        () =>
          queryGenerator.addTemporalTableQuery(MyModel, {
            temporalTableType: TemporalTableType.SYSTEM_PERIOD,
          }),
        {
          default: notSupportedError,
          mssql: toMatchSql([
            `ALTER TABLE [MyModels] ADD
            [SysStartTime] DATETIME2 GENERATED ALWAYS AS ROW START HIDDEN NOT NULL CONSTRAINT [DF__MyModels__SysStartTime] DEFAULT SYSUTCDATETIME(),
            [SysEndTime] DATETIME2 GENERATED ALWAYS AS ROW END HIDDEN NOT NULL CONSTRAINT [DF__MyModels__SysEndTime] DEFAULT CONVERT(DATETIME2, '9999-12-31 23:59:59.99999999'),
            PERIOD FOR SYSTEM_TIME ([SysStartTime], [SysEndTime])`,
            `ALTER TABLE [MyModels] SET (SYSTEM_VERSIONING = ON)`,
          ]),
        },
      );
    });

    it('produces an addTemporalTableQuery query for a model definition', () => {
      const MyModel = sequelize.define('MyModel', {});

      expectPerDialect(
        () =>
          queryGenerator.addTemporalTableQuery(MyModel.modelDefinition, {
            temporalTableType: TemporalTableType.SYSTEM_PERIOD,
          }),
        {
          default: notSupportedError,
          mssql: toMatchSql([
            `ALTER TABLE [MyModels] ADD
            [SysStartTime] DATETIME2 GENERATED ALWAYS AS ROW START HIDDEN NOT NULL CONSTRAINT [DF__MyModels__SysStartTime] DEFAULT SYSUTCDATETIME(),
            [SysEndTime] DATETIME2 GENERATED ALWAYS AS ROW END HIDDEN NOT NULL CONSTRAINT [DF__MyModels__SysEndTime] DEFAULT CONVERT(DATETIME2, '9999-12-31 23:59:59.99999999'),
            PERIOD FOR SYSTEM_TIME ([SysStartTime], [SysEndTime])`,
            `ALTER TABLE [MyModels] SET (SYSTEM_VERSIONING = ON)`,
          ]),
        },
      );
    });

    it('produces an addTemporalTableQuery query for a table with custom schema', () => {
      expectPerDialect(
        () =>
          queryGenerator.addTemporalTableQuery(
            { tableName: 'myTable', schema: 'mySchema' },
            { temporalTableType: TemporalTableType.SYSTEM_PERIOD },
          ),
        {
          default: notSupportedError,
          mssql: toMatchSql([
            `ALTER TABLE [mySchema].[myTable] ADD
            [SysStartTime] DATETIME2 GENERATED ALWAYS AS ROW START HIDDEN NOT NULL CONSTRAINT [DF__myTable__SysStartTime] DEFAULT SYSUTCDATETIME(),
            [SysEndTime] DATETIME2 GENERATED ALWAYS AS ROW END HIDDEN NOT NULL CONSTRAINT [DF__myTable__SysEndTime] DEFAULT CONVERT(DATETIME2, '9999-12-31 23:59:59.99999999'),
            PERIOD FOR SYSTEM_TIME ([SysStartTime], [SysEndTime])`,
            `ALTER TABLE [mySchema].[myTable] SET (SYSTEM_VERSIONING = ON)`,
          ]),
        },
      );
    });

    it('produces an addTemporalTableQuery query for a table with default schema', () => {
      expectPerDialect(
        () =>
          queryGenerator.addTemporalTableQuery(
            { tableName: 'myTable', schema: sequelize.dialect.getDefaultSchema() },
            { temporalTableType: TemporalTableType.SYSTEM_PERIOD },
          ),
        {
          default: notSupportedError,
          mssql: toMatchSql([
            `ALTER TABLE [myTable] ADD
            [SysStartTime] DATETIME2 GENERATED ALWAYS AS ROW START HIDDEN NOT NULL CONSTRAINT [DF__myTable__SysStartTime] DEFAULT SYSUTCDATETIME(),
            [SysEndTime] DATETIME2 GENERATED ALWAYS AS ROW END HIDDEN NOT NULL CONSTRAINT [DF__myTable__SysEndTime] DEFAULT CONVERT(DATETIME2, '9999-12-31 23:59:59.99999999'),
            PERIOD FOR SYSTEM_TIME ([SysStartTime], [SysEndTime])`,
            `ALTER TABLE [myTable] SET (SYSTEM_VERSIONING = ON)`,
          ]),
        },
      );
    });

    it('produces an addTemporalTableQuery query for a table with globally set schema', () => {
      const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
      const queryGeneratorSchema = sequelizeSchema.queryGenerator;

      expectPerDialect(
        () =>
          queryGeneratorSchema.addTemporalTableQuery('myTable', {
            temporalTableType: TemporalTableType.SYSTEM_PERIOD,
          }),
        {
          default: notSupportedError,
          mssql: toMatchSql([
            `ALTER TABLE [mySchema].[myTable] ADD
            [SysStartTime] DATETIME2 GENERATED ALWAYS AS ROW START HIDDEN NOT NULL CONSTRAINT [DF__myTable__SysStartTime] DEFAULT SYSUTCDATETIME(),
            [SysEndTime] DATETIME2 GENERATED ALWAYS AS ROW END HIDDEN NOT NULL CONSTRAINT [DF__myTable__SysEndTime] DEFAULT CONVERT(DATETIME2, '9999-12-31 23:59:59.99999999'),
            PERIOD FOR SYSTEM_TIME ([SysStartTime], [SysEndTime])`,
            `ALTER TABLE [mySchema].[myTable] SET (SYSTEM_VERSIONING = ON)`,
          ]),
        },
      );
    });
  });
});
