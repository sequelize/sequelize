import { HistoryRetentionPeriodUnit, TemporalTableType } from '@sequelize/core';
import { createSequelizeInstance, expectsql, getTestDialect, sequelize } from '../../support';

const dialectName = getTestDialect();
const notSupportedError = new Error(
  `addTemporalTableQuery has not been implemented in ${dialectName}.`,
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
        },
      );
    });
  });
});
