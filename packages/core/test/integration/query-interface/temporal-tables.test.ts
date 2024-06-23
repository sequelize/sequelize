import type { ModelDefined } from '@sequelize/core';
import {
  DataTypes,
  HistoryRetentionPeriodUnit,
  TemporalPeriodType,
  TemporalTableType,
} from '@sequelize/core';
import { assert, expect } from 'chai';
import { getTestDialectTeaser } from '../../support';
import { sequelize } from '../support';

const queryInterface = sequelize.queryInterface;

declare interface UserAttributes {
  id: number;
  name: string;
}

declare type UserCreationAttributes = Omit<UserAttributes, 'id'>;

describe(getTestDialectTeaser('QueryInterface#Temporal Tables'), () => {
  describe('addTemporalTable', () => {
    let User: ModelDefined<UserAttributes, UserCreationAttributes>;
    beforeEach(async () => {
      User = sequelize.define('User', {
        name: { type: DataTypes.STRING },
      });

      await User.sync({ force: true });
    });

    if (sequelize.dialect.supports.temporalTables.applicationPeriod) {
      describe('Application-period', () => {
        it('should add an application-period temporal table', async () => {
          const [descr, period, tableInfo] = await Promise.all([
            User.describe(),
            sequelize.queryInterface.showTemporalPeriods(User),
            sequelize.queryInterface.showTemporalTables(User),
          ]);

          expect(descr).to.have.ownProperty('name');
          expect(descr).to.not.have.ownProperty('AppEndTime');
          expect(descr).to.not.have.ownProperty('AppStartTime');
          expect(period).to.deep.equal([]);
          expect(tableInfo).to.deep.equal([]);

          await queryInterface.addTemporalTable(User, {
            temporalTableType: TemporalTableType.APPLICATION_PERIOD,
          });

          const [descr1, period1, tableInfo1] = await Promise.all([
            User.describe(),
            sequelize.queryInterface.showTemporalPeriods(User),
            sequelize.queryInterface.showTemporalTables(User),
          ]);

          expect(descr1).to.have.ownProperty('name');
          expect(descr1).to.have.ownProperty('AppEndTime');
          expect(descr1).to.have.ownProperty('AppStartTime');
          expect(period1).to.deep.equal([
            {
              rowEnd: 'AppEndTime',
              rowStart: 'AppStartTime',
              type: TemporalPeriodType.APPLICATION,
            },
          ]);
          expect(tableInfo1).to.deep.equal([
            {
              tableName: User.table.tableName,
              schema: User.table.schema,
              temporalTableType: TemporalTableType.APPLICATION_PERIOD,
            },
          ]);
        });

        it('should add an application-period temporal table with custom row start and end columns', async () => {
          const [descr, period, tableInfo] = await Promise.all([
            User.describe(),
            sequelize.queryInterface.showTemporalPeriods(User),
            sequelize.queryInterface.showTemporalTables(User),
          ]);

          expect(descr).to.have.ownProperty('name');
          expect(descr).to.not.have.ownProperty('app_time_end');
          expect(descr).to.not.have.ownProperty('app_time_start');
          expect(period).to.deep.equal([]);
          expect(tableInfo).to.deep.equal([]);

          await queryInterface.addTemporalTable(User, {
            historyTableName: 'UserHistory',
            applicationPeriodRowEnd: 'app_time_end',
            applicationPeriodRowStart: 'app_time_start',
            temporalTableType: TemporalTableType.APPLICATION_PERIOD,
          });

          const [descr1, period1, tableInfo1] = await Promise.all([
            User.describe(),
            sequelize.queryInterface.showTemporalPeriods(User),
            sequelize.queryInterface.showTemporalTables(User),
          ]);

          expect(descr1).to.have.ownProperty('name');
          expect(descr1).to.have.ownProperty('app_time_end');
          expect(descr1).to.have.ownProperty('app_time_start');
          expect(period1).to.deep.equal([
            {
              rowEnd: 'app_time_end',
              rowStart: 'app_time_start',
              type: TemporalPeriodType.APPLICATION,
            },
          ]);
          expect(tableInfo1).to.deep.equal([
            {
              tableName: User.table.tableName,
              schema: User.table.schema,
              temporalTableType: TemporalTableType.APPLICATION_PERIOD,
            },
          ]);
        });
      });
    }

    if (sequelize.dialect.supports.temporalTables.biTemporal) {
      describe('Bi-Temporal', () => {
        it('should add a bi-temporal table', async () => {
          const [descr, period, tableInfo] = await Promise.all([
            User.describe(),
            sequelize.queryInterface.showTemporalPeriods(User),
            sequelize.queryInterface.showTemporalTables(User),
          ]);

          expect(descr).to.have.ownProperty('name');
          expect(descr).to.not.have.ownProperty('AppEndTime');
          expect(descr).to.not.have.ownProperty('AppStartTime');
          expect(descr).to.not.have.ownProperty('SysEndTime');
          expect(descr).to.not.have.ownProperty('SysStartTime');
          expect(period).to.deep.equal([]);
          expect(tableInfo).deep.equal([]);

          await queryInterface.addTemporalTable(User, {
            temporalTableType: TemporalTableType.BITEMPORAL,
          });

          const [descr1, period1, tableInfo1] = await Promise.all([
            User.describe(),
            sequelize.queryInterface.showTemporalPeriods(User),
            sequelize.queryInterface.showTemporalTables(User),
          ]);

          expect(descr1).to.have.ownProperty('name');
          expect(descr1).to.have.ownProperty('AppEndTime');
          expect(descr1).to.have.ownProperty('AppStartTime');
          expect(descr1).to.have.ownProperty('SysEndTime');
          expect(descr1).to.have.ownProperty('SysStartTime');
          expect(period1).to.deep.equal([
            {
              rowEnd: 'AppEndTime',
              rowStart: 'AppStartTime',
              type: TemporalPeriodType.APPLICATION,
            },
            {
              rowEnd: 'SysEndTime',
              rowStart: 'SysStartTime',
              type: TemporalPeriodType.SYSTEM,
            },
          ]);
          expect(tableInfo1).deep.equal([
            {
              tableName: User.table.tableName,
              schema: User.table.schema,
              temporalTableType: TemporalTableType.BITEMPORAL,
              ...(sequelize.dialect.supports.temporalTables.historyTable
                ? { historyTableName: `${User.table.tableName}_history` }
                : {}),
            },
          ]);
        });

        it('should add an bi-temporal table with custom row start and end columns', async () => {
          const [descr, period, tableInfo] = await Promise.all([
            User.describe(),
            sequelize.queryInterface.showTemporalPeriods(User),
            sequelize.queryInterface.showTemporalTables(User),
          ]);

          expect(descr).to.have.ownProperty('name');
          expect(descr).to.not.have.ownProperty('app_time_end');
          expect(descr).to.not.have.ownProperty('app_time_start');
          expect(descr).to.not.have.ownProperty('sys_time_end');
          expect(descr).to.not.have.ownProperty('sys_time_start');
          expect(period).to.deep.equal([]);
          expect(tableInfo).to.deep.equal([]);

          await queryInterface.addTemporalTable(User, {
            historyTableName: 'UserHistory',
            applicationPeriodRowEnd: 'app_time_end',
            applicationPeriodRowStart: 'app_time_start',
            systemPeriodRowEnd: 'sys_time_end',
            systemPeriodRowStart: 'sys_time_start',
            temporalTableType: TemporalTableType.BITEMPORAL,
          });

          const [descr1, period1, tableInfo1] = await Promise.all([
            User.describe(),
            sequelize.queryInterface.showTemporalPeriods(User),
            sequelize.queryInterface.showTemporalTables(User),
          ]);

          expect(descr1).to.have.ownProperty('name');
          expect(descr1).to.have.ownProperty('app_time_end');
          expect(descr1).to.have.ownProperty('app_time_start');
          expect(descr1).to.have.ownProperty('sys_time_end');
          expect(descr1).to.have.ownProperty('sys_time_start');
          expect(period1).to.deep.equal([
            {
              rowEnd: 'app_time_end',
              rowStart: 'app_time_start',
              type: TemporalPeriodType.APPLICATION,
            },
            {
              rowEnd: 'sys_time_end',
              rowStart: 'sys_time_start',
              type: TemporalPeriodType.SYSTEM,
            },
          ]);
          expect(tableInfo1).to.deep.equal([
            {
              tableName: User.table.tableName,
              schema: User.table.schema,
              temporalTableType: TemporalTableType.BITEMPORAL,
              ...(sequelize.dialect.supports.temporalTables.historyTable
                ? { historyTableName: `${User.table.tableName}_history` }
                : {}),
            },
          ]);
        });

        if (sequelize.dialect.supports.temporalTables.historyTable) {
          it('should add a bi-temporal table with a history table', async () => {
            const tableInfo = await sequelize.queryInterface.showTemporalTables(User);
            expect(tableInfo).to.deep.equal([]);

            await queryInterface.addTemporalTable(User, {
              temporalTableType: TemporalTableType.BITEMPORAL,
            });

            const tableInfo1 = await sequelize.queryInterface.showTemporalTables(User);
            expect(tableInfo1).to.deep.equal([
              {
                tableName: User.table.tableName,
                schema: User.table.schema,
                historyTableName: `${User.table.tableName}_history`,
                temporalTableType: TemporalTableType.BITEMPORAL,
              },
            ]);
          });

          it('should add a bi-temporal table with a custom history table', async () => {
            const tableInfo = await sequelize.queryInterface.showTemporalTables(User);
            expect(tableInfo).to.deep.equal([]);

            await queryInterface.addTemporalTable(User, {
              historyTableName: 'UserHistory',
              temporalTableType: TemporalTableType.BITEMPORAL,
            });

            const tableInfo1 = await sequelize.queryInterface.showTemporalTables(User);
            expect(tableInfo1).to.deep.equal([
              {
                tableName: User.table.tableName,
                schema: User.table.schema,
                historyTableName: 'UserHistory',
                temporalTableType: TemporalTableType.BITEMPORAL,
              },
            ]);
          });

          if (sequelize.dialect.supports.temporalTables.historyRetentionPeriod) {
            it('should add a bi-temporal table with a history table and custom history retention period', async () => {
              const tableInfo = await sequelize.queryInterface.showTemporalTables(User);
              expect(tableInfo).to.deep.equal([]);

              await queryInterface.addTemporalTable(User, {
                historyRetentionPeriod: {
                  unit: HistoryRetentionPeriodUnit.MONTH,
                  length: 3,
                },
                historyTableName: 'UserHistory',
                temporalTableType: TemporalTableType.BITEMPORAL,
              });

              const tableInfo1 = await sequelize.queryInterface.showTemporalTables(User);
              expect(tableInfo1).to.deep.equal([
                {
                  tableName: User.table.tableName,
                  schema: User.table.schema,
                  historyTableName: 'UserHistory',
                  historyRetentionPeriod: {
                    unit: HistoryRetentionPeriodUnit.MONTH,
                    length: 3,
                  },
                  temporalTableType: TemporalTableType.BITEMPORAL,
                },
              ]);
            });
          }
        }
      });
    }

    if (sequelize.dialect.supports.temporalTables.systemPeriod) {
      describe('System-period', () => {
        it('should add a system-period temporal table', async () => {
          const [descr, period, tableInfo] = await Promise.all([
            User.describe(),
            sequelize.queryInterface.showTemporalPeriods(User),
            sequelize.queryInterface.showTemporalTables(User),
          ]);

          expect(descr).to.have.ownProperty('name');
          expect(descr).to.not.have.ownProperty('SysEndTime');
          expect(descr).to.not.have.ownProperty('SysStartTime');
          expect(period).to.deep.equal([]);
          expect(tableInfo).to.deep.equal([]);

          await queryInterface.addTemporalTable(User, {
            temporalTableType: TemporalTableType.SYSTEM_PERIOD,
          });

          const [descr1, period1, tableInfo1] = await Promise.all([
            User.describe(),
            sequelize.queryInterface.showTemporalPeriods(User),
            sequelize.queryInterface.showTemporalTables(User),
          ]);

          expect(descr1).to.have.ownProperty('name');
          expect(descr1).to.have.ownProperty('SysEndTime');
          expect(descr1).to.have.ownProperty('SysStartTime');
          expect(period1).to.deep.equal([
            {
              name: 'SYSTEM_TIME',
              rowEnd: 'SysEndTime',
              rowStart: 'SysStartTime',
              type: TemporalPeriodType.SYSTEM,
            },
          ]);
          expect(tableInfo1).to.deep.equal([
            {
              tableName: User.table.tableName,
              schema: User.table.schema,
              temporalTableType: TemporalTableType.SYSTEM_PERIOD,
              ...(sequelize.dialect.supports.temporalTables.historyTable
                ? { historyTableName: `${User.table.tableName}_history` }
                : {}),
              ...(sequelize.dialect.supports.temporalTables.historyRetentionPeriod
                ? { historyRetentionPeriod: { length: -1, unit: 'INFINITE' } }
                : {}),
            },
          ]);
        });

        it('should add a system-period temporal table with custom row start and end columns', async () => {
          const [descr, period, tableInfo] = await Promise.all([
            User.describe(),
            sequelize.queryInterface.showTemporalPeriods(User),
            sequelize.queryInterface.showTemporalTables(User),
          ]);

          expect(descr).to.have.ownProperty('name');
          expect(descr).to.not.have.ownProperty('sys_time_end');
          expect(descr).to.not.have.ownProperty('sys_time_start');
          expect(period).to.deep.equal([]);
          expect(tableInfo).to.deep.equal([]);

          await queryInterface.addTemporalTable(User, {
            systemPeriodRowEnd: 'sys_time_end',
            systemPeriodRowStart: 'sys_time_start',
            temporalTableType: TemporalTableType.SYSTEM_PERIOD,
          });

          const [descr1, period1, tableInfo1] = await Promise.all([
            User.describe(),
            sequelize.queryInterface.showTemporalPeriods(User),
            sequelize.queryInterface.showTemporalTables(User),
          ]);

          expect(descr1).to.have.ownProperty('name');
          expect(descr1).to.have.ownProperty('sys_time_end');
          expect(descr1).to.have.ownProperty('sys_time_start');
          expect(period1).to.deep.equal([
            {
              name: 'SYSTEM_TIME',
              rowEnd: 'sys_time_end',
              rowStart: 'sys_time_start',
              type: TemporalPeriodType.SYSTEM,
            },
          ]);
          expect(tableInfo1).to.deep.equal([
            {
              tableName: User.table.tableName,
              schema: User.table.schema,
              temporalTableType: TemporalTableType.SYSTEM_PERIOD,
              ...(sequelize.dialect.supports.temporalTables.historyTable
                ? { historyTableName: `${User.table.tableName}_history` }
                : {}),
              ...(sequelize.dialect.supports.temporalTables.historyRetentionPeriod
                ? { historyRetentionPeriod: { length: -1, unit: 'INFINITE' } }
                : {}),
            },
          ]);
        });

        if (sequelize.dialect.supports.temporalTables.historyTable) {
          it('should add a system-period temporal table with a history table', async () => {
            const tableInfo = await sequelize.queryInterface.showTemporalTables(User);
            expect(tableInfo).to.deep.equal([]);

            await queryInterface.addTemporalTable(User, {
              temporalTableType: TemporalTableType.SYSTEM_PERIOD,
            });

            const tableInfo1 = await sequelize.queryInterface.showTemporalTables(User);
            expect(tableInfo1).to.deep.equal([
              {
                tableName: User.table.tableName,
                schema: User.table.schema,
                historyTableName: `${User.table.tableName}_history`,
                temporalTableType: TemporalTableType.SYSTEM_PERIOD,
                ...(sequelize.dialect.supports.temporalTables.historyRetentionPeriod
                  ? { historyRetentionPeriod: { length: -1, unit: 'INFINITE' } }
                  : {}),
              },
            ]);
          });

          it('should add a system-period temporal table with a custom history table', async () => {
            const tableInfo = await sequelize.queryInterface.showTemporalTables(User);
            expect(tableInfo).to.deep.equal([]);

            await queryInterface.addTemporalTable(User, {
              historyTableName: 'UserHistory',
              temporalTableType: TemporalTableType.SYSTEM_PERIOD,
            });

            const tableInfo1 = await sequelize.queryInterface.showTemporalTables(User);
            expect(tableInfo1).to.deep.equal([
              {
                tableName: User.table.tableName,
                schema: User.table.schema,
                historyTableName: 'UserHistory',
                temporalTableType: TemporalTableType.SYSTEM_PERIOD,
                ...(sequelize.dialect.supports.temporalTables.historyRetentionPeriod
                  ? { historyRetentionPeriod: { length: -1, unit: 'INFINITE' } }
                  : {}),
              },
            ]);
          });

          if (sequelize.dialect.supports.temporalTables.historyRetentionPeriod) {
            it('should add a system-period temporal table with a history table and custom history retention period', async () => {
              const tableInfo = await sequelize.queryInterface.showTemporalTables(User);
              expect(tableInfo).to.deep.equal([]);

              await queryInterface.addTemporalTable(User, {
                historyRetentionPeriod: {
                  unit: HistoryRetentionPeriodUnit.MONTH,
                  length: 3,
                },
                historyTableName: 'UserHistory',
                temporalTableType: TemporalTableType.SYSTEM_PERIOD,
              });

              const tableInfo1 = await sequelize.queryInterface.showTemporalTables(User);
              expect(tableInfo1).to.deep.equal([
                {
                  tableName: User.table.tableName,
                  schema: User.table.schema,
                  historyTableName: 'UserHistory',
                  historyRetentionPeriod: {
                    unit: HistoryRetentionPeriodUnit.MONTH,
                    length: 3,
                  },
                  temporalTableType: TemporalTableType.SYSTEM_PERIOD,
                },
              ]);
            });
          }
        }
      });
    }
  });

  describe('changeTemporalTable', () => {
    if (sequelize.dialect.supports.temporalTables.applicationPeriod) {
      describe('Application-period', () => {
        it('should disable the application-period temporal table', async () => {
          const User = sequelize.define(
            'User',
            {
              name: { type: DataTypes.STRING },
            },
            { temporalTableType: TemporalTableType.APPLICATION_PERIOD },
          );

          await User.sync({ force: true });

          const [period, tableInfo] = await Promise.all([
            sequelize.queryInterface.showTemporalPeriods(User),
            sequelize.queryInterface.showTemporalTables(User),
          ]);

          expect(period).to.deep.equal([
            {
              rowEnd: 'AppEndTime',
              rowStart: 'AppStartTime',
              type: TemporalPeriodType.APPLICATION,
            },
          ]);
          expect(tableInfo).to.deep.equal([
            {
              tableName: User.table.tableName,
              schema: User.table.schema,
              temporalTableType: TemporalTableType.APPLICATION_PERIOD,
            },
          ]);

          await queryInterface.changeTemporalTable(User, {
            temporalTableType: TemporalTableType.NON_TEMPORAL,
          });

          const [period1, tableInfo1] = await Promise.all([
            sequelize.queryInterface.showTemporalPeriods(User),
            sequelize.queryInterface.showTemporalTables(User),
          ]);

          expect(period1).to.deep.equal(period);
          expect(tableInfo1).to.deep.equal([]);
        });

        it('should disable and re-enable the application-period temporal table', async () => {
          const User = sequelize.define(
            'User',
            {
              name: { type: DataTypes.STRING },
            },
            { temporalTableType: TemporalTableType.APPLICATION_PERIOD },
          );

          await User.sync({ force: true });

          const [period, tableInfo] = await Promise.all([
            sequelize.queryInterface.showTemporalPeriods(User),
            sequelize.queryInterface.showTemporalTables(User),
          ]);

          expect(period).to.deep.equal([
            {
              rowEnd: 'AppEndTime',
              rowStart: 'AppStartTime',
              type: TemporalPeriodType.APPLICATION,
            },
          ]);
          expect(tableInfo).to.deep.equal([
            {
              tableName: User.table.tableName,
              schema: User.table.schema,
              temporalTableType: TemporalTableType.APPLICATION_PERIOD,
            },
          ]);

          await queryInterface.changeTemporalTable(User, {
            temporalTableType: TemporalTableType.NON_TEMPORAL,
          });

          await queryInterface.changeTemporalTable(User, {
            temporalTableType: TemporalTableType.APPLICATION_PERIOD,
          });

          const [period1, tableInfo1] = await Promise.all([
            sequelize.queryInterface.showTemporalPeriods(User),
            sequelize.queryInterface.showTemporalTables(User),
          ]);

          expect(period1).to.deep.equal(period);
          expect(tableInfo1).to.deep.equal(tableInfo);
        });
      });
    }

    if (sequelize.dialect.supports.temporalTables.biTemporal) {
      describe('Bi-temporal', () => {
        it('should disable the bi-temporal table', async () => {
          const User = sequelize.define(
            'User',
            {
              name: { type: DataTypes.STRING },
            },
            { temporalTableType: TemporalTableType.BITEMPORAL },
          );

          await User.sync({ force: true });

          const [period, tableInfo] = await Promise.all([
            sequelize.queryInterface.showTemporalPeriods(User),
            sequelize.queryInterface.showTemporalTables(User),
          ]);

          expect(period).to.deep.equal([
            {
              rowEnd: 'AppEndTime',
              rowStart: 'AppStartTime',
              type: TemporalPeriodType.APPLICATION,
            },
            {
              rowEnd: 'SysEndTime',
              rowStart: 'SysStartTime',
              type: TemporalPeriodType.SYSTEM,
            },
          ]);
          expect(tableInfo).to.deep.equal([
            {
              tableName: User.table.tableName,
              schema: User.table.schema,
              temporalTableType: TemporalTableType.BITEMPORAL,
            },
          ]);

          await queryInterface.changeTemporalTable(User, {
            temporalTableType: TemporalTableType.NON_TEMPORAL,
          });

          const [period1, tableInfo1] = await Promise.all([
            sequelize.queryInterface.showTemporalPeriods(User),
            sequelize.queryInterface.showTemporalTables(User),
          ]);

          expect(period1).to.deep.equal(period);
          expect(tableInfo1).to.deep.equal([]);
        });

        it('should disable and re-enable the bi-temporal table', async () => {
          const User = sequelize.define(
            'User',
            {
              name: { type: DataTypes.STRING },
            },
            { temporalTableType: TemporalTableType.BITEMPORAL },
          );

          await User.sync({ force: true });

          const [period, tableInfo] = await Promise.all([
            sequelize.queryInterface.showTemporalPeriods(User),
            sequelize.queryInterface.showTemporalTables(User),
          ]);

          expect(period).to.deep.equal([
            {
              rowEnd: 'AppEndTime',
              rowStart: 'AppStartTime',
              type: TemporalPeriodType.APPLICATION,
            },
            {
              rowEnd: 'SysEndTime',
              rowStart: 'SysStartTime',
              type: TemporalPeriodType.SYSTEM,
            },
          ]);
          expect(tableInfo).to.deep.equal([
            {
              tableName: User.table.tableName,
              schema: User.table.schema,
              temporalTableType: TemporalTableType.BITEMPORAL,
            },
          ]);

          await queryInterface.changeTemporalTable(User, {
            temporalTableType: TemporalTableType.NON_TEMPORAL,
          });

          await queryInterface.changeTemporalTable(User, {
            temporalTableType: TemporalTableType.BITEMPORAL,
          });

          const [period1, tableInfo1] = await Promise.all([
            sequelize.queryInterface.showTemporalPeriods(User),
            sequelize.queryInterface.showTemporalTables(User),
          ]);

          expect(period1).to.deep.equal(period);
          expect(tableInfo1).to.deep.equal(tableInfo);
        });

        if (sequelize.dialect.supports.temporalTables.historyRetentionPeriod) {
          it('should change the history table retention period', async () => {
            const User = sequelize.define(
              'User',
              {
                name: { type: DataTypes.STRING },
              },
              { temporalTableType: TemporalTableType.BITEMPORAL },
            );

            await User.sync({ force: true });

            const tableInfo = await sequelize.queryInterface.showTemporalTables(User);

            expect(tableInfo).to.deep.equal([
              {
                tableName: User.table.tableName,
                schema: User.table.schema,
                historyTableName: `${User.table.tableName}_history`,
                historyRetentionPeriod: {
                  length: null,
                  unit: HistoryRetentionPeriodUnit.INFINITE,
                },
                temporalTableType: TemporalTableType.BITEMPORAL,
              },
            ]);

            await queryInterface.changeTemporalTable(User, {
              historyTableName: 'Users_history',
              historyRetentionPeriod: { length: 3, unit: HistoryRetentionPeriodUnit.MONTH },
              temporalTableType: TemporalTableType.BITEMPORAL,
            });

            const tableInfo1 = await sequelize.queryInterface.showTemporalTables(User);
            expect(tableInfo1).to.deep.equal([
              {
                tableName: User.table.tableName,
                schema: User.table.schema,
                historyTableName: `${User.table.tableName}_history`,
                temporalTableType: TemporalTableType.BITEMPORAL,
                historyRetentionPeriod: {
                  length: 3,
                  unit: HistoryRetentionPeriodUnit.MONTH,
                },
              },
            ]);
          });
        }
      });
    }

    if (sequelize.dialect.supports.temporalTables.systemPeriod) {
      describe('System-period', () => {
        it('should disable the system-period temporal table', async () => {
          const User = sequelize.define(
            'User',
            {
              name: { type: DataTypes.STRING },
            },
            { temporalTableType: TemporalTableType.SYSTEM_PERIOD },
          );

          await User.sync({ force: true });

          const [period, tableInfo] = await Promise.all([
            sequelize.queryInterface.showTemporalPeriods(User),
            sequelize.queryInterface.showTemporalTables(User),
          ]);

          expect(period).to.deep.equal([
            {
              name: 'SYSTEM_TIME',
              rowEnd: 'SysEndTime',
              rowStart: 'SysStartTime',
              type: TemporalPeriodType.SYSTEM,
            },
          ]);
          expect(tableInfo).to.deep.equal([
            {
              tableName: User.table.tableName,
              schema: User.table.schema,
              temporalTableType: TemporalTableType.SYSTEM_PERIOD,
              ...(sequelize.dialect.supports.temporalTables.historyTable
                ? { historyTableName: `${User.table.tableName}_history` }
                : {}),
              ...(sequelize.dialect.supports.temporalTables.historyRetentionPeriod
                ? { historyRetentionPeriod: { length: -1, unit: 'INFINITE' } }
                : {}),
            },
          ]);

          await queryInterface.changeTemporalTable(User, {
            temporalTableType: TemporalTableType.NON_TEMPORAL,
          });

          const [period1, tableInfo1] = await Promise.all([
            sequelize.queryInterface.showTemporalPeriods(User),
            sequelize.queryInterface.showTemporalTables(User),
          ]);

          expect(period1).to.deep.equal(period);
          expect(tableInfo1).to.deep.equal([]);
        });

        it('should disable and re-enable the system-period temporal table', async () => {
          const User = sequelize.define(
            'User',
            {
              name: { type: DataTypes.STRING },
            },
            { temporalTableType: TemporalTableType.SYSTEM_PERIOD },
          );

          await User.sync({ force: true });

          const [period, tableInfo] = await Promise.all([
            sequelize.queryInterface.showTemporalPeriods(User),
            sequelize.queryInterface.showTemporalTables(User),
          ]);

          expect(period).to.deep.equal([
            {
              name: 'SYSTEM_TIME',
              rowEnd: 'SysEndTime',
              rowStart: 'SysStartTime',
              type: TemporalPeriodType.SYSTEM,
            },
          ]);
          expect(tableInfo).to.deep.equal([
            {
              tableName: User.table.tableName,
              schema: User.table.schema,
              temporalTableType: TemporalTableType.SYSTEM_PERIOD,
              ...(sequelize.dialect.supports.temporalTables.historyTable
                ? { historyTableName: `${User.table.tableName}_history` }
                : {}),
              ...(sequelize.dialect.supports.temporalTables.historyRetentionPeriod
                ? { historyRetentionPeriod: { length: -1, unit: 'INFINITE' } }
                : {}),
            },
          ]);

          await queryInterface.changeTemporalTable(User, {
            temporalTableType: TemporalTableType.NON_TEMPORAL,
          });

          await queryInterface.changeTemporalTable(User, {
            temporalTableType: TemporalTableType.SYSTEM_PERIOD,
          });

          const [period1, tableInfo1] = await Promise.all([
            sequelize.queryInterface.showTemporalPeriods(User),
            sequelize.queryInterface.showTemporalTables(User),
          ]);

          expect(period1).to.deep.equal(period);
          expect(tableInfo1).to.deep.equal(tableInfo);
        });

        if (sequelize.dialect.supports.temporalTables.historyRetentionPeriod) {
          it('should change the history table retention period', async () => {
            const User = sequelize.define(
              'User',
              {
                name: { type: DataTypes.STRING },
              },
              {
                historyTableName: 'UserHistory',
                temporalTableType: TemporalTableType.SYSTEM_PERIOD,
              },
            );

            await User.sync({ force: true });

            const tableInfo = await sequelize.queryInterface.showTemporalTables(User);
            expect(tableInfo).to.deep.equal([
              {
                tableName: User.table.tableName,
                schema: User.table.schema,
                historyTableName: 'UserHistory',
                historyRetentionPeriod: {
                  length: -1,
                  unit: HistoryRetentionPeriodUnit.INFINITE,
                },
                temporalTableType: TemporalTableType.SYSTEM_PERIOD,
              },
            ]);

            await queryInterface.changeTemporalTable(User, {
              historyTableName: 'UserHistory',
              historyRetentionPeriod: { length: 3, unit: HistoryRetentionPeriodUnit.MONTH },
              temporalTableType: TemporalTableType.SYSTEM_PERIOD,
            });

            const tableInfo1 = await sequelize.queryInterface.showTemporalTables(User);
            expect(tableInfo1).to.deep.equal([
              {
                tableName: User.table.tableName,
                schema: User.table.schema,
                historyTableName: 'UserHistory',
                temporalTableType: TemporalTableType.SYSTEM_PERIOD,
                historyRetentionPeriod: {
                  length: 3,
                  unit: HistoryRetentionPeriodUnit.MONTH,
                },
              },
            ]);
          });
        }
      });
    }
  });

  describe('removeTemporalTable', () => {
    if (sequelize.dialect.supports.temporalTables.applicationPeriod) {
      describe('Application-period', () => {
        it('should remove an application-period temporal table', async () => {
          const User = sequelize.define(
            'User',
            {
              name: { type: DataTypes.STRING },
            },
            { temporalTableType: TemporalTableType.APPLICATION_PERIOD },
          );

          await User.sync({ force: true });

          await queryInterface.removeTemporalTable(User);

          const [descr, period, tableInfo] = await Promise.all([
            User.describe(),
            sequelize.queryInterface.showTemporalPeriods(User),
            sequelize.queryInterface.showTemporalTables(User),
          ]);

          expect(descr).to.have.ownProperty('name');
          expect(descr).to.have.ownProperty('AppEndTime');
          expect(descr).to.have.ownProperty('AppStartTime');
          expect(period).to.deep.equal([]);
          expect(tableInfo).to.deep.equal([]);
        });

        it('should remove an application-period temporal table and drop columns', async () => {
          const User = sequelize.define(
            'User',
            {
              name: { type: DataTypes.STRING },
            },
            { temporalTableType: TemporalTableType.APPLICATION_PERIOD },
          );

          await User.sync({ force: true });

          await queryInterface.removeTemporalTable(User, { dropColumns: true });

          const [descr, period, tableInfo] = await Promise.all([
            User.describe(),
            sequelize.queryInterface.showTemporalPeriods(User),
            sequelize.queryInterface.showTemporalTables(User),
          ]);

          expect(descr).to.have.ownProperty('name');
          expect(descr).to.not.have.ownProperty('AppEndTime');
          expect(descr).to.not.have.ownProperty('AppStartTime');
          expect(period).to.deep.equal([]);
          expect(tableInfo).to.deep.equal([]);
        });
      });
    }

    if (sequelize.dialect.supports.temporalTables.biTemporal) {
      describe('Bi-temporal', () => {
        it('should remove a bi-temporal table', async () => {
          const User = sequelize.define(
            'User',
            {
              name: { type: DataTypes.STRING },
            },
            { temporalTableType: TemporalTableType.BITEMPORAL },
          );

          await User.sync({ force: true });

          await queryInterface.removeTemporalTable(User);

          const [descr, period, tableInfo] = await Promise.all([
            User.describe(),
            sequelize.queryInterface.showTemporalPeriods(User),
            sequelize.queryInterface.showTemporalTables(User),
          ]);

          expect(descr).to.have.ownProperty('name');
          expect(descr).to.have.ownProperty('AppEndTime');
          expect(descr).to.have.ownProperty('AppStartTime');
          expect(descr).to.have.ownProperty('SysEndTime');
          expect(descr).to.have.ownProperty('SysStartTime');
          expect(period).to.deep.equal([]);
          expect(tableInfo).to.deep.equal([]);
        });

        it('should remove a bi-temporal table and drop columns', async () => {
          const User = sequelize.define(
            'User',
            {
              name: { type: DataTypes.STRING },
            },
            { temporalTableType: TemporalTableType.SYSTEM_PERIOD },
          );

          await User.sync({ force: true });

          await queryInterface.removeTemporalTable(User, { dropColumns: true });

          const [descr, period, tableInfo] = await Promise.all([
            User.describe(),
            sequelize.queryInterface.showTemporalPeriods(User),
            sequelize.queryInterface.showTemporalTables(User),
          ]);

          expect(descr).to.have.ownProperty('name');
          expect(descr).to.not.have.ownProperty('AppEndTime');
          expect(descr).to.not.have.ownProperty('AppStartTime');
          expect(descr).to.not.have.ownProperty('SysEndTime');
          expect(descr).to.not.have.ownProperty('SysStartTime');
          expect(period).to.deep.equal([]);
          expect(tableInfo).to.deep.equal([]);
        });

        if (sequelize.dialect.supports.temporalTables.historyTable) {
          it('should remove a bi-temporal table and keep history table', async () => {
            const User = sequelize.define(
              'User',
              {
                name: { type: DataTypes.STRING },
              },
              { temporalTableType: TemporalTableType.SYSTEM_PERIOD },
            );

            await User.sync({ force: true });

            await queryInterface.removeTemporalTable(User);

            const allTables = await sequelize.queryInterface.listTables();
            const oldHistoryTable = allTables.find(
              t => t.tableName === `${User.table.tableName}_history`,
            );
            assert(oldHistoryTable);
          });

          it('should remove a bi-temporal table and drop history table', async () => {
            const User = sequelize.define(
              'User',
              {
                name: { type: DataTypes.STRING },
              },
              { temporalTableType: TemporalTableType.SYSTEM_PERIOD },
            );

            await User.sync({ force: true });

            await queryInterface.removeTemporalTable(User, { dropHistoryTable: true });

            const allTables = await sequelize.queryInterface.listTables();
            const oldHistoryTable = allTables.find(
              t => t.tableName === `${User.table.tableName}_history`,
            );
            assert(!oldHistoryTable);
          });
        }
      });
    }

    if (sequelize.dialect.supports.temporalTables.systemPeriod) {
      describe('System-period', () => {
        it('should remove a system-period temporal table', async () => {
          const User = sequelize.define(
            'User',
            {
              name: { type: DataTypes.STRING },
            },
            { temporalTableType: TemporalTableType.SYSTEM_PERIOD },
          );

          await User.sync({ force: true });

          await queryInterface.removeTemporalTable(User);

          const [descr, period, tableInfo] = await Promise.all([
            User.describe(),
            sequelize.queryInterface.showTemporalPeriods(User),
            sequelize.queryInterface.showTemporalTables(User),
          ]);

          expect(descr).to.have.ownProperty('name');
          expect(descr).to.have.ownProperty('SysEndTime');
          expect(descr).to.have.ownProperty('SysStartTime');
          expect(period).to.deep.equal([]);
          expect(tableInfo).to.deep.equal([]);
        });

        it('should remove a system-period temporal table and drop columns', async () => {
          const User = sequelize.define(
            'User',
            {
              name: { type: DataTypes.STRING },
            },
            { temporalTableType: TemporalTableType.SYSTEM_PERIOD },
          );

          await User.sync({ force: true });

          await queryInterface.removeTemporalTable(User, { dropColumns: true });

          const [descr, period, tableInfo] = await Promise.all([
            User.describe(),
            sequelize.queryInterface.showTemporalPeriods(User),
            sequelize.queryInterface.showTemporalTables(User),
          ]);

          expect(descr).to.have.ownProperty('name');
          expect(descr).to.not.have.ownProperty('SysEndTime');
          expect(descr).to.not.have.ownProperty('SysStartTime');
          expect(period).to.deep.equal([]);
          expect(tableInfo).to.deep.equal([]);
        });

        if (sequelize.dialect.supports.temporalTables.historyTable) {
          it('should remove a system-period temporal table and keep history table', async () => {
            const User = sequelize.define(
              'User',
              {
                name: { type: DataTypes.STRING },
              },
              {
                historyTableName: 'UserHistory',
                temporalTableType: TemporalTableType.SYSTEM_PERIOD,
              },
            );

            await User.sync({ force: true });

            await queryInterface.removeTemporalTable(User);

            const allTables = await sequelize.queryInterface.listTables();
            const oldHistoryTable = allTables.find(t => t.tableName === 'UserHistory');
            assert(oldHistoryTable);
          });

          it('should remove a system-period temporal table and drop history table', async () => {
            const User = sequelize.define(
              'User',
              {
                name: { type: DataTypes.STRING },
              },
              { temporalTableType: TemporalTableType.SYSTEM_PERIOD },
            );

            await User.sync({ force: true });

            await queryInterface.removeTemporalTable(User, { dropHistoryTable: true });

            const allTables = await sequelize.queryInterface.listTables();
            const oldHistoryTable = allTables.find(
              t => t.tableName === `${User.table.tableName}_history`,
            );
            assert(!oldHistoryTable);
          });
        }
      });
    }
  });
});
