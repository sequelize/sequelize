import { TemporalPeriodType } from '@sequelize/core';
import {
  createSequelizeInstance,
  expectPerDialect,
  getTestDialect,
  sequelize,
  toMatchSql,
} from '../../support';

const dialectName = getTestDialect();
const notSupportedError = new Error(
  `removeTemporalTableQuery has not been implemented in ${dialectName}.`,
);
const periodMissingError = new Error(
  'Temporal periods must be provided to remove a temporal table.',
);
const appPeriodNotSupportedError = new Error(
  `Unsupported temporal period type: ${TemporalPeriodType.APPLICATION}.`,
);

describe('QueryGenerator#removeTemporalTableQuery', () => {
  const queryGenerator = sequelize.queryGenerator;

  it('throws an error if temporalPeriods is not provided', () => {
    // @ts-expect-error -- intentionally passing invalid arguments
    expectPerDialect(() => queryGenerator.removeTemporalTableQuery('myTable', {}), {
      default: notSupportedError,
      mssql: periodMissingError,
    });
  });

  describe('Application-period', () => {
    it('produces a removeTemporalTableQuery query for application periods', () => {
      expectPerDialect(
        () =>
          queryGenerator.removeTemporalTableQuery('myTable', {
            temporalPeriods: [
              {
                name: 'APPLICATION_TIME',
                rowStart: 'app_row_start',
                rowEnd: 'app_row_end',
                type: TemporalPeriodType.APPLICATION,
              },
            ],
          }),
        {
          default: notSupportedError,
          mssql: appPeriodNotSupportedError,
        },
      );
    });

    it('produces a removeTemporalTableQuery query for a model', () => {
      const MyModel = sequelize.define('MyModel', {});

      expectPerDialect(
        () =>
          queryGenerator.removeTemporalTableQuery(MyModel, {
            temporalPeriods: [
              {
                name: 'APPLICATION_TIME',
                rowStart: 'app_row_start',
                rowEnd: 'app_row_end',
                type: TemporalPeriodType.APPLICATION,
              },
            ],
          }),
        {
          default: notSupportedError,
          mssql: appPeriodNotSupportedError,
        },
      );
    });

    it('produces a removeTemporalTableQuery query for a model definition', () => {
      const MyModel = sequelize.define('MyModel', {});

      expectPerDialect(
        () =>
          queryGenerator.removeTemporalTableQuery(MyModel.modelDefinition, {
            temporalPeriods: [
              {
                name: 'APPLICATION_TIME',
                rowStart: 'app_row_start',
                rowEnd: 'app_row_end',
                type: TemporalPeriodType.APPLICATION,
              },
            ],
          }),
        {
          default: notSupportedError,
          mssql: appPeriodNotSupportedError,
        },
      );
    });

    it('produces a removeTemporalTableQuery query with a custom schema', () => {
      expectPerDialect(
        () =>
          queryGenerator.removeTemporalTableQuery(
            { tableName: 'myTable', schema: 'mySchema' },
            {
              temporalPeriods: [
                {
                  name: 'APPLICATION_TIME',
                  rowStart: 'app_row_start',
                  rowEnd: 'app_row_end',
                  type: TemporalPeriodType.APPLICATION,
                },
              ],
            },
          ),
        {
          default: notSupportedError,
          mssql: appPeriodNotSupportedError,
        },
      );
    });

    it('produces a removeTemporalTableQuery query with a default schema', () => {
      expectPerDialect(
        () =>
          queryGenerator.removeTemporalTableQuery(
            { tableName: 'myTable', schema: sequelize.dialect.getDefaultSchema() },
            {
              temporalPeriods: [
                {
                  name: 'APPLICATION_TIME',
                  rowStart: 'app_row_start',
                  rowEnd: 'app_row_end',
                  type: TemporalPeriodType.APPLICATION,
                },
              ],
            },
          ),
        {
          default: notSupportedError,
          mssql: appPeriodNotSupportedError,
        },
      );
    });

    it('produces a removeTemporalTableQuery query with globally set schema', () => {
      const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
      const queryGeneratorSchema = sequelizeSchema.queryGenerator;

      expectPerDialect(
        () =>
          queryGeneratorSchema.removeTemporalTableQuery('myTable', {
            temporalPeriods: [
              {
                name: 'APPLICATION_TIME',
                rowStart: 'app_row_start',
                rowEnd: 'app_row_end',
                type: TemporalPeriodType.APPLICATION,
              },
            ],
          }),
        {
          default: notSupportedError,
          mssql: appPeriodNotSupportedError,
        },
      );
    });
  });

  describe('Bi-temporal', () => {
    it('produces a removeTemporalTableQuery query', () => {
      expectPerDialect(
        () =>
          queryGenerator.removeTemporalTableQuery('myTable', {
            temporalPeriods: [
              {
                name: 'APPLICATION_TIME',
                rowStart: 'app_row_start',
                rowEnd: 'app_row_end',
                type: TemporalPeriodType.APPLICATION,
              },
              {
                name: 'SYSTEM_TIME',
                rowStart: 'sys_row_start',
                rowEnd: 'sys_row_end',
                type: TemporalPeriodType.SYSTEM,
              },
            ],
          }),
        {
          default: notSupportedError,
          mssql: appPeriodNotSupportedError,
        },
      );
    });

    it('produces a removeTemporalTableQuery query for a model', () => {
      const MyModel = sequelize.define('MyModel', {});

      expectPerDialect(
        () =>
          queryGenerator.removeTemporalTableQuery(MyModel, {
            temporalPeriods: [
              {
                name: 'APPLICATION_TIME',
                rowStart: 'app_row_start',
                rowEnd: 'app_row_end',
                type: TemporalPeriodType.APPLICATION,
              },
              {
                name: 'SYSTEM_TIME',
                rowStart: 'sys_row_start',
                rowEnd: 'sys_row_end',
                type: TemporalPeriodType.SYSTEM,
              },
            ],
          }),
        {
          default: notSupportedError,
          mssql: appPeriodNotSupportedError,
        },
      );
    });

    it('produces a removeTemporalTableQuery query for a model definition', () => {
      const MyModel = sequelize.define('MyModel', {});

      expectPerDialect(
        () =>
          queryGenerator.removeTemporalTableQuery(MyModel.modelDefinition, {
            temporalPeriods: [
              {
                name: 'APPLICATION_TIME',
                rowStart: 'app_row_start',
                rowEnd: 'app_row_end',
                type: TemporalPeriodType.APPLICATION,
              },
              {
                name: 'SYSTEM_TIME',
                rowStart: 'sys_row_start',
                rowEnd: 'sys_row_end',
                type: TemporalPeriodType.SYSTEM,
              },
            ],
          }),
        {
          default: notSupportedError,
          mssql: appPeriodNotSupportedError,
        },
      );
    });

    it('produces a removeTemporalTableQuery query with a custom schema', () => {
      expectPerDialect(
        () =>
          queryGenerator.removeTemporalTableQuery(
            { tableName: 'myTable', schema: 'mySchema' },
            {
              temporalPeriods: [
                {
                  name: 'APPLICATION_TIME',
                  rowStart: 'app_row_start',
                  rowEnd: 'app_row_end',
                  type: TemporalPeriodType.APPLICATION,
                },
                {
                  name: 'SYSTEM_TIME',
                  rowStart: 'sys_row_start',
                  rowEnd: 'sys_row_end',
                  type: TemporalPeriodType.SYSTEM,
                },
              ],
            },
          ),
        {
          default: notSupportedError,
          mssql: appPeriodNotSupportedError,
        },
      );
    });

    it('produces a removeTemporalTableQuery query with a default schema', () => {
      expectPerDialect(
        () =>
          queryGenerator.removeTemporalTableQuery(
            { tableName: 'myTable', schema: sequelize.dialect.getDefaultSchema() },
            {
              temporalPeriods: [
                {
                  name: 'APPLICATION_TIME',
                  rowStart: 'app_row_start',
                  rowEnd: 'app_row_end',
                  type: TemporalPeriodType.APPLICATION,
                },
                {
                  name: 'SYSTEM_TIME',
                  rowStart: 'sys_row_start',
                  rowEnd: 'sys_row_end',
                  type: TemporalPeriodType.SYSTEM,
                },
              ],
            },
          ),
        {
          default: notSupportedError,
          mssql: appPeriodNotSupportedError,
        },
      );
    });

    it('produces a removeTemporalTableQuery query with globally set schema', () => {
      const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
      const queryGeneratorSchema = sequelizeSchema.queryGenerator;

      expectPerDialect(
        () =>
          queryGeneratorSchema.removeTemporalTableQuery('myTable', {
            temporalPeriods: [
              {
                name: 'APPLICATION_TIME',
                rowStart: 'app_row_start',
                rowEnd: 'app_row_end',
                type: TemporalPeriodType.APPLICATION,
              },
              {
                name: 'SYSTEM_TIME',
                rowStart: 'sys_row_start',
                rowEnd: 'sys_row_end',
                type: TemporalPeriodType.SYSTEM,
              },
            ],
          }),
        {
          default: notSupportedError,
          mssql: appPeriodNotSupportedError,
        },
      );
    });
  });

  describe('System-versioned', () => {
    it('produces a removeTemporalTableQuery query', () => {
      expectPerDialect(
        () =>
          queryGenerator.removeTemporalTableQuery('myTable', {
            temporalPeriods: [
              {
                name: 'SYSTEM_TIME',
                rowStart: 'sys_row_start',
                rowEnd: 'sys_row_end',
                type: TemporalPeriodType.SYSTEM,
              },
            ],
          }),
        {
          default: notSupportedError,
          mssql: toMatchSql([
            `ALTER TABLE [myTable] SET (SYSTEM_VERSIONING = OFF)`,
            `ALTER TABLE [myTable] DROP PERIOD FOR SYSTEM_TIME`,
          ]),
        },
      );
    });

    it('produces a removeTemporalTableQuery query for a model', () => {
      const MyModel = sequelize.define('MyModel', {});

      expectPerDialect(
        () =>
          queryGenerator.removeTemporalTableQuery(MyModel, {
            temporalPeriods: [
              {
                name: 'SYSTEM_TIME',
                rowStart: 'sys_row_start',
                rowEnd: 'sys_row_end',
                type: TemporalPeriodType.SYSTEM,
              },
            ],
          }),
        {
          default: notSupportedError,
          mssql: toMatchSql([
            `ALTER TABLE [MyModels] SET (SYSTEM_VERSIONING = OFF)`,
            `ALTER TABLE [MyModels] DROP PERIOD FOR SYSTEM_TIME`,
          ]),
        },
      );
    });

    it('produces a removeTemporalTableQuery query for a model definition', () => {
      const MyModel = sequelize.define('MyModel', {});

      expectPerDialect(
        () =>
          queryGenerator.removeTemporalTableQuery(MyModel.modelDefinition, {
            temporalPeriods: [
              {
                name: 'SYSTEM_TIME',
                rowStart: 'sys_row_start',
                rowEnd: 'sys_row_end',
                type: TemporalPeriodType.SYSTEM,
              },
            ],
          }),
        {
          default: notSupportedError,
          mssql: toMatchSql([
            `ALTER TABLE [MyModels] SET (SYSTEM_VERSIONING = OFF)`,
            `ALTER TABLE [MyModels] DROP PERIOD FOR SYSTEM_TIME`,
          ]),
        },
      );
    });

    it('produces a removeTemporalTableQuery query with a custom schema', () => {
      expectPerDialect(
        () =>
          queryGenerator.removeTemporalTableQuery(
            { tableName: 'myTable', schema: 'mySchema' },
            {
              temporalPeriods: [
                {
                  name: 'SYSTEM_TIME',
                  rowStart: 'sys_row_start',
                  rowEnd: 'sys_row_end',
                  type: TemporalPeriodType.SYSTEM,
                },
              ],
            },
          ),
        {
          default: notSupportedError,
          mssql: toMatchSql([
            `ALTER TABLE [mySchema].[myTable] SET (SYSTEM_VERSIONING = OFF)`,
            `ALTER TABLE [mySchema].[myTable] DROP PERIOD FOR SYSTEM_TIME`,
          ]),
        },
      );
    });

    it('produces a removeTemporalTableQuery query with a default schema', () => {
      expectPerDialect(
        () =>
          queryGenerator.removeTemporalTableQuery(
            { tableName: 'myTable', schema: sequelize.dialect.getDefaultSchema() },
            {
              temporalPeriods: [
                {
                  name: 'SYSTEM_TIME',
                  rowStart: 'sys_row_start',
                  rowEnd: 'sys_row_end',
                  type: TemporalPeriodType.SYSTEM,
                },
              ],
            },
          ),
        {
          default: notSupportedError,
          mssql: toMatchSql([
            `ALTER TABLE [myTable] SET (SYSTEM_VERSIONING = OFF)`,
            `ALTER TABLE [myTable] DROP PERIOD FOR SYSTEM_TIME`,
          ]),
        },
      );
    });

    it('produces a removeTemporalTableQuery query with globally set schema', () => {
      const sequelizeSchema = createSequelizeInstance({ schema: 'mySchema' });
      const queryGeneratorSchema = sequelizeSchema.queryGenerator;

      expectPerDialect(
        () =>
          queryGeneratorSchema.removeTemporalTableQuery('myTable', {
            temporalPeriods: [
              {
                name: 'SYSTEM_TIME',
                rowStart: 'sys_row_start',
                rowEnd: 'sys_row_end',
                type: TemporalPeriodType.SYSTEM,
              },
            ],
          }),
        {
          default: notSupportedError,
          mssql: toMatchSql([
            `ALTER TABLE [mySchema].[myTable] SET (SYSTEM_VERSIONING = OFF)`,
            `ALTER TABLE [mySchema].[myTable] DROP PERIOD FOR SYSTEM_TIME`,
          ]),
        },
      );
    });
  });
});
