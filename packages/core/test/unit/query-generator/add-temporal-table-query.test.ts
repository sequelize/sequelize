import { HistoryRetentionPeriodUnit, TemporalTableType } from '@sequelize/core';
import {
  createSequelizeInstance,
  expectPerDialect,
  getTestDialect,
  sequelize,
} from '../../support';

const dialectName = getTestDialect();
const notSupportedError = new Error(
  `addTemporalTableQuery has not been implemented in ${dialectName}.`,
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
        },
      );
    });
  });
});
