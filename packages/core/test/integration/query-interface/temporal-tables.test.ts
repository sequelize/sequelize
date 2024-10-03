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
  start: Date;
  end: Date;
}

declare type UserCreationAttributes = Omit<UserAttributes, 'id'>;

describe(getTestDialectTeaser('QueryInterface#Temporal Tables'), () => {
  describe('addTemporalTable', () => {
    let User: ModelDefined<UserAttributes, UserCreationAttributes>;
    beforeEach(async () => {
      User = sequelize.define('User', {
        name: { type: DataTypes.STRING },
        start: { type: DataTypes.DATE },
        end: { type: DataTypes.DATE },
      });

      await User.sync({ force: true });
    });

    if (sequelize.dialect.supports.temporalTables.applicationPeriod) {
      describe('Application-period', () => {
        it('should add an application-period temporal table', async () => {
          const [descr, period, tableInfo] = await Promise.all([
            User.describe(),
            sequelize.queryInterface.showTemporalPeriods({ tableOrModel: User }),
            sequelize.queryInterface.showTemporalTables({ tableOrModel: User }),
          ]);

          expect(descr).to.have.ownProperty('name');
          expect(descr).to.have.ownProperty('end');
          expect(descr).to.have.ownProperty('start');
          expect(period).to.deep.equal([]);
          expect(tableInfo).to.deep.equal([]);

          await queryInterface.addTemporalTable(User, {
            applicationPeriodRowEnd: 'end',
            applicationPeriodRowStart: 'start',
            temporalTableType: TemporalTableType.APPLICATION_PERIOD,
          });

          const [descr1, period1, tableInfo1] = await Promise.all([
            User.describe(),
            sequelize.queryInterface.showTemporalPeriods({ tableOrModel: User }),
            sequelize.queryInterface.showTemporalTables({ tableOrModel: User }),
          ]);

          expect(descr1).to.have.ownProperty('name');
          expect(descr1).to.have.ownProperty('end');
          expect(descr1).to.have.ownProperty('start');
          expect(period1).to.deep.equal([
            {
              name: 'APPLICATION_TIME',
              rowEnd: 'end',
              rowStart: 'start',
              type: TemporalPeriodType.APPLICATION,
            },
          ]);
          expect(tableInfo1).to.have.length(1);
          const [table] = tableInfo1;
          expect(table).to.have.ownProperty('tableName', User.table.tableName);
          expect(table).to.have.ownProperty('schema', User.table.schema);
          expect(table).to.have.ownProperty(
            'temporalTableType',
            TemporalTableType.APPLICATION_PERIOD,
          );
        });
      });
    }

    if (sequelize.dialect.supports.temporalTables.biTemporal) {
      describe('Bi-Temporal', () => {
        it('should add a bi-temporal table', async () => {
          const [descr, period, tableInfo] = await Promise.all([
            User.describe(),
            sequelize.queryInterface.showTemporalPeriods({ tableOrModel: User }),
            sequelize.queryInterface.showTemporalTables({ tableOrModel: User }),
          ]);

          expect(descr).to.have.ownProperty('name');
          expect(descr).to.have.ownProperty('end');
          expect(descr).to.have.ownProperty('start');
          expect(descr).to.not.have.ownProperty('SysEndTime');
          expect(descr).to.not.have.ownProperty('SysStartTime');
          expect(period).to.deep.equal([]);
          expect(tableInfo).deep.equal([]);

          await queryInterface.addTemporalTable(User, {
            applicationPeriodRowEnd: 'end',
            applicationPeriodRowStart: 'start',
            temporalTableType: TemporalTableType.BITEMPORAL,
          });

          const [descr1, period1, tableInfo1] = await Promise.all([
            User.describe(),
            sequelize.queryInterface.showTemporalPeriods({ tableOrModel: User }),
            sequelize.queryInterface.showTemporalTables({ tableOrModel: User }),
          ]);

          expect(descr1).to.have.ownProperty('name');
          expect(descr1).to.have.ownProperty('end');
          expect(descr1).to.have.ownProperty('start');
          expect(descr1).to.have.ownProperty('SysEndTime');
          expect(descr1).to.have.ownProperty('SysStartTime');
          expect(period1).to.deep.equal([
            {
              name: 'SYSTEM_TIME',
              rowEnd: 'SysEndTime',
              rowStart: 'SysStartTime',
              type: TemporalPeriodType.SYSTEM,
            },
            {
              name: 'APPLICATION_TIME',
              rowEnd: 'end',
              rowStart: 'start',
              type: TemporalPeriodType.APPLICATION,
            },
          ]);
          expect(tableInfo1).to.have.length(1);
          const [table] = tableInfo1;
          expect(table).to.have.ownProperty('tableName', User.table.tableName);
          expect(table).to.have.ownProperty('schema', User.table.schema);
          expect(table).to.have.ownProperty('temporalTableType', TemporalTableType.BITEMPORAL);
        });

        it('should add an bi-temporal table with custom row start and end columns', async () => {
          const [descr, period, tableInfo] = await Promise.all([
            User.describe(),
            sequelize.queryInterface.showTemporalPeriods({ tableOrModel: User }),
            sequelize.queryInterface.showTemporalTables({ tableOrModel: User }),
          ]);

          expect(descr).to.have.ownProperty('name');
          expect(descr).to.have.ownProperty('end');
          expect(descr).to.have.ownProperty('start');
          expect(descr).to.not.have.ownProperty('sys_time_end');
          expect(descr).to.not.have.ownProperty('sys_time_start');
          expect(period).to.deep.equal([]);
          expect(tableInfo).to.deep.equal([]);

          await queryInterface.addTemporalTable(User, {
            applicationPeriodRowEnd: 'end',
            applicationPeriodRowStart: 'start',
            systemPeriodRowEnd: 'sys_time_end',
            systemPeriodRowStart: 'sys_time_start',
            temporalTableType: TemporalTableType.BITEMPORAL,
          });

          const [descr1, period1, tableInfo1] = await Promise.all([
            User.describe(),
            sequelize.queryInterface.showTemporalPeriods({ tableOrModel: User }),
            sequelize.queryInterface.showTemporalTables({ tableOrModel: User }),
          ]);

          expect(descr1).to.have.ownProperty('name');
          expect(descr1).to.have.ownProperty('end');
          expect(descr1).to.have.ownProperty('start');
          expect(descr1).to.have.ownProperty('sys_time_end');
          expect(descr1).to.have.ownProperty('sys_time_start');
          expect(period1).to.deep.equal([
            {
              name: 'SYSTEM_TIME',
              rowEnd: 'sys_time_end',
              rowStart: 'sys_time_start',
              type: TemporalPeriodType.SYSTEM,
            },
            {
              name: 'APPLICATION_TIME',
              rowEnd: 'end',
              rowStart: 'start',
              type: TemporalPeriodType.APPLICATION,
            },
          ]);
          expect(tableInfo1).to.have.length(1);
          const [table] = tableInfo1;
          expect(table).to.have.ownProperty('tableName', User.table.tableName);
          expect(table).to.have.ownProperty('schema', User.table.schema);
          expect(table).to.have.ownProperty('temporalTableType', TemporalTableType.BITEMPORAL);
        });

        if (sequelize.dialect.supports.temporalTables.historyTable) {
          it('should add a bi-temporal table with a history table', async () => {
            const tableInfo = await sequelize.queryInterface.showTemporalTables({
              tableOrModel: User,
            });
            expect(tableInfo).to.deep.equal([]);

            await queryInterface.addTemporalTable(User, {
              applicationPeriodRowEnd: 'end',
              applicationPeriodRowStart: 'start',
              temporalTableType: TemporalTableType.BITEMPORAL,
            });

            const tableInfo1 = await sequelize.queryInterface.showTemporalTables({
              tableOrModel: User,
            });
            expect(tableInfo1).to.have.length(1);
            const [table] = tableInfo1;
            expect(table).to.have.ownProperty('tableName', User.table.tableName);
            expect(table).to.have.ownProperty('schema', User.table.schema);
            expect(table).to.have.ownProperty('temporalTableType', TemporalTableType.BITEMPORAL);
            expect(table).to.have.ownProperty('historyTable');
          });

          it('should add a bi-temporal table with a custom history table', async () => {
            const tableInfo = await sequelize.queryInterface.showTemporalTables({
              tableOrModel: User,
            });
            expect(tableInfo).to.deep.equal([]);

            await queryInterface.addTemporalTable(User, {
              applicationPeriodRowEnd: 'end',
              applicationPeriodRowStart: 'start',
              historyTable: 'UserHistory',
              temporalTableType: TemporalTableType.BITEMPORAL,
            });

            const tableInfo1 = await sequelize.queryInterface.showTemporalTables({
              tableOrModel: User,
            });
            expect(tableInfo1).to.have.length(1);
            const [table] = tableInfo1;
            expect(table).to.have.ownProperty('tableName', User.table.tableName);
            expect(table).to.have.ownProperty('schema', User.table.schema);
            expect(table).to.have.ownProperty('temporalTableType', TemporalTableType.BITEMPORAL);
            expect(table).to.have.ownProperty('historyTable');
            expect(table.historyTable).to.deep.equal({
              tableName: 'UserHistory',
              schema: sequelize.dialect.getDefaultSchema(),
            });
          });

          if (sequelize.dialect.supports.temporalTables.historyRetentionPeriod) {
            it('should add a bi-temporal table with a history table and custom history retention period', async () => {
              const tableInfo = await sequelize.queryInterface.showTemporalTables({
                tableOrModel: User,
              });
              expect(tableInfo).to.deep.equal([]);

              await queryInterface.addTemporalTable(User, {
                applicationPeriodRowEnd: 'end',
                applicationPeriodRowStart: 'start',
                historyRetentionPeriod: {
                  unit: HistoryRetentionPeriodUnit.MONTH,
                  length: 3,
                },
                historyTable: 'UserHistory',
                temporalTableType: TemporalTableType.BITEMPORAL,
              });

              const tableInfo1 = await sequelize.queryInterface.showTemporalTables({
                tableOrModel: User,
              });
              expect(tableInfo1).to.have.length(1);
              const [table] = tableInfo1;
              expect(table).to.have.ownProperty('tableName', User.table.tableName);
              expect(table).to.have.ownProperty('schema', User.table.schema);
              expect(table).to.have.ownProperty('temporalTableType', TemporalTableType.BITEMPORAL);
              expect(table).to.have.ownProperty('historyTable');
              expect(table.historyTable).to.deep.equal({
                tableName: 'UserHistory',
                schema: sequelize.dialect.getDefaultSchema(),
              });
              expect(table).to.have.ownProperty('historyRetentionPeriod');
              expect(table.historyRetentionPeriod).to.deep.equal({
                length: 3,
                unit: HistoryRetentionPeriodUnit.MONTH,
              });
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
            sequelize.queryInterface.showTemporalPeriods({ tableOrModel: User }),
            sequelize.queryInterface.showTemporalTables({ tableOrModel: User }),
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
            sequelize.queryInterface.showTemporalPeriods({ tableOrModel: User }),
            sequelize.queryInterface.showTemporalTables({ tableOrModel: User }),
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
          expect(tableInfo1).to.have.length(1);
          const [table] = tableInfo1;
          expect(table).to.have.ownProperty('tableName', User.table.tableName);
          expect(table).to.have.ownProperty('schema', User.table.schema);
          expect(table).to.have.ownProperty('temporalTableType', TemporalTableType.SYSTEM_PERIOD);
        });

        it('should add a system-period temporal table with custom row start and end columns', async () => {
          const [descr, period, tableInfo] = await Promise.all([
            User.describe(),
            sequelize.queryInterface.showTemporalPeriods({ tableOrModel: User }),
            sequelize.queryInterface.showTemporalTables({ tableOrModel: User }),
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
            sequelize.queryInterface.showTemporalPeriods({ tableOrModel: User }),
            sequelize.queryInterface.showTemporalTables({ tableOrModel: User }),
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
          expect(tableInfo1).to.have.length(1);
          const [table] = tableInfo1;
          expect(table).to.have.ownProperty('tableName', User.table.tableName);
          expect(table).to.have.ownProperty('schema', User.table.schema);
          expect(table).to.have.ownProperty('temporalTableType', TemporalTableType.SYSTEM_PERIOD);
        });

        if (sequelize.dialect.supports.temporalTables.historyTable) {
          it('should add a system-period temporal table with a history table', async () => {
            const tableInfo = await sequelize.queryInterface.showTemporalTables({
              tableOrModel: User,
            });
            expect(tableInfo).to.deep.equal([]);

            await queryInterface.addTemporalTable(User, {
              temporalTableType: TemporalTableType.SYSTEM_PERIOD,
            });

            const tableInfo1 = await sequelize.queryInterface.showTemporalTables({
              tableOrModel: User,
            });
            expect(tableInfo1).to.have.length(1);
            const [table] = tableInfo1;
            expect(table).to.have.ownProperty('tableName', User.table.tableName);
            expect(table).to.have.ownProperty('schema', User.table.schema);
            expect(table).to.have.ownProperty('temporalTableType', TemporalTableType.SYSTEM_PERIOD);
            expect(table).to.have.ownProperty('historyTable');
          });

          it('should add a system-period temporal table with a custom history table', async () => {
            const tableInfo = await sequelize.queryInterface.showTemporalTables({
              tableOrModel: User,
            });
            expect(tableInfo).to.deep.equal([]);

            await queryInterface.addTemporalTable(User, {
              historyTable: 'UserHistory',
              temporalTableType: TemporalTableType.SYSTEM_PERIOD,
            });

            const tableInfo1 = await sequelize.queryInterface.showTemporalTables({
              tableOrModel: User,
            });
            expect(tableInfo1).to.have.length(1);
            const [table] = tableInfo1;
            expect(table).to.have.ownProperty('tableName', User.table.tableName);
            expect(table).to.have.ownProperty('schema', User.table.schema);
            expect(table).to.have.ownProperty('temporalTableType', TemporalTableType.SYSTEM_PERIOD);
            expect(table).to.have.ownProperty('historyTable');
            expect(table.historyTable).to.deep.equal({
              tableName: 'UserHistory',
              schema: sequelize.dialect.getDefaultSchema(),
            });
          });

          if (sequelize.dialect.supports.temporalTables.historyRetentionPeriod) {
            it('should add a system-period temporal table with a history table and custom history retention period', async () => {
              const tableInfo = await sequelize.queryInterface.showTemporalTables({
                tableOrModel: User,
              });
              expect(tableInfo).to.deep.equal([]);

              await queryInterface.addTemporalTable(User, {
                historyRetentionPeriod: {
                  unit: HistoryRetentionPeriodUnit.MONTH,
                  length: 3,
                },
                historyTable: 'UserHistory',
                temporalTableType: TemporalTableType.SYSTEM_PERIOD,
              });

              const tableInfo1 = await sequelize.queryInterface.showTemporalTables({
                tableOrModel: User,
              });
              expect(tableInfo1).to.have.length(1);
              const [table] = tableInfo1;
              expect(table).to.have.ownProperty('tableName', User.table.tableName);
              expect(table).to.have.ownProperty('schema', User.table.schema);
              expect(table).to.have.ownProperty(
                'temporalTableType',
                TemporalTableType.SYSTEM_PERIOD,
              );
              expect(table).to.have.ownProperty('historyTable');
              expect(table.historyTable).to.deep.equal({
                tableName: 'UserHistory',
                schema: sequelize.dialect.getDefaultSchema(),
              });
              expect(table).to.have.ownProperty('historyRetentionPeriod');
              expect(table.historyRetentionPeriod).to.deep.equal({
                length: 3,
                unit: HistoryRetentionPeriodUnit.MONTH,
              });
            });
          }
        }
      });
    }
  });

  describe('changeTemporalTable', () => {
    if (sequelize.dialect.supports.temporalTables.biTemporal) {
      describe('Bi-temporal', () => {
        it('should disable the bi-temporal table', async () => {
          const User = sequelize.define(
            'User',
            {
              name: { type: DataTypes.STRING },
              start: { type: DataTypes.DATE },
              end: { type: DataTypes.DATE },
            },
            {
              applicationPeriodRowEnd: 'end',
              applicationPeriodRowStart: 'start',
              temporalTableType: TemporalTableType.BITEMPORAL,
            },
          );

          await User.sync({ force: true });

          const [period, tableInfo] = await Promise.all([
            sequelize.queryInterface.showTemporalPeriods({ tableOrModel: User }),
            sequelize.queryInterface.showTemporalTables({ tableOrModel: User }),
          ]);

          expect(period).to.deep.equal([
            {
              name: 'SYSTEM_TIME',
              rowEnd: 'SysEndTime',
              rowStart: 'SysStartTime',
              type: TemporalPeriodType.SYSTEM,
            },
            {
              name: 'APPLICATION_TIME',
              rowEnd: 'end',
              rowStart: 'start',
              type: TemporalPeriodType.APPLICATION,
            },
          ]);
          expect(tableInfo).to.have.length(1);
          const [table] = tableInfo;
          expect(table).to.have.ownProperty('tableName', User.table.tableName);
          expect(table).to.have.ownProperty('schema', User.table.schema);
          expect(table).to.have.ownProperty('temporalTableType', TemporalTableType.BITEMPORAL);

          await queryInterface.changeTemporalTable(User, {
            temporalTableType: TemporalTableType.NON_TEMPORAL,
          });

          const [period1, tableInfo1] = await Promise.all([
            sequelize.queryInterface.showTemporalPeriods({ tableOrModel: User }),
            sequelize.queryInterface.showTemporalTables({ tableOrModel: User }),
          ]);

          expect(period1).to.deep.equal(period);
          expect(tableInfo1).to.deep.equal([]);
        });

        it('should disable and re-enable the bi-temporal table', async () => {
          const User = sequelize.define(
            'User',
            {
              name: { type: DataTypes.STRING },
              start: { type: DataTypes.DATE },
              end: { type: DataTypes.DATE },
            },
            {
              applicationPeriodRowEnd: 'end',
              applicationPeriodRowStart: 'start',
              temporalTableType: TemporalTableType.BITEMPORAL,
            },
          );

          await User.sync({ force: true });

          const [period, tableInfo] = await Promise.all([
            sequelize.queryInterface.showTemporalPeriods({ tableOrModel: User }),
            sequelize.queryInterface.showTemporalTables({ tableOrModel: User }),
          ]);

          expect(period).to.deep.equal([
            {
              name: 'SYSTEM_TIME',
              rowEnd: 'SysEndTime',
              rowStart: 'SysStartTime',
              type: TemporalPeriodType.SYSTEM,
            },
            {
              name: 'APPLICATION_TIME',
              rowEnd: 'end',
              rowStart: 'start',
              type: TemporalPeriodType.APPLICATION,
            },
          ]);
          expect(tableInfo).to.have.length(1);
          const [table] = tableInfo;
          expect(table).to.have.ownProperty('tableName', User.table.tableName);
          expect(table).to.have.ownProperty('schema', User.table.schema);
          expect(table).to.have.ownProperty('temporalTableType', TemporalTableType.BITEMPORAL);

          await queryInterface.changeTemporalTable(User, {
            temporalTableType: TemporalTableType.NON_TEMPORAL,
          });

          await queryInterface.changeTemporalTable(User, {
            temporalTableType: TemporalTableType.BITEMPORAL,
          });

          const [period1, tableInfo1] = await Promise.all([
            sequelize.queryInterface.showTemporalPeriods({ tableOrModel: User }),
            sequelize.queryInterface.showTemporalTables({ tableOrModel: User }),
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
                start: { type: DataTypes.DATE },
                end: { type: DataTypes.DATE },
              },
              {
                applicationPeriodRowEnd: 'end',
                applicationPeriodRowStart: 'start',
                historyTable: 'UserHistory',
                temporalTableType: TemporalTableType.BITEMPORAL,
              },
            );

            await User.sync({ force: true });

            const tableInfo = await sequelize.queryInterface.showTemporalTables({
              tableOrModel: User,
            });
            expect(tableInfo).to.have.length(1);
            const [table] = tableInfo;
            expect(table).to.have.ownProperty('tableName', User.table.tableName);
            expect(table).to.have.ownProperty('schema', User.table.schema);
            expect(table).to.have.ownProperty('temporalTableType', TemporalTableType.BITEMPORAL);
            expect(table).to.have.ownProperty('historyTable');
            expect(table.historyTable).to.deep.equal({
              tableName: 'UserHistory',
              schema: sequelize.dialect.getDefaultSchema(),
            });
            expect(table).to.have.ownProperty('historyRetentionPeriod');
            expect(table.historyRetentionPeriod).to.deep.equal({
              length: -1,
              unit: HistoryRetentionPeriodUnit.INFINITE,
            });

            await queryInterface.changeTemporalTable(User, {
              historyTable: 'UserHistory',
              historyRetentionPeriod: { length: 3, unit: HistoryRetentionPeriodUnit.MONTH },
              temporalTableType: TemporalTableType.BITEMPORAL,
            });

            const tableInfo1 = await sequelize.queryInterface.showTemporalTables({
              tableOrModel: User,
            });
            expect(tableInfo1).to.have.length(1);
            const [table1] = tableInfo1;
            expect(table1).to.have.ownProperty('tableName', User.table.tableName);
            expect(table1).to.have.ownProperty('schema', User.table.schema);
            expect(table1).to.have.ownProperty('temporalTableType', TemporalTableType.BITEMPORAL);
            expect(table1).to.have.ownProperty('historyTable');
            expect(table1.historyTable).to.deep.equal({
              tableName: 'UserHistory',
              schema: sequelize.dialect.getDefaultSchema(),
            });
            expect(table1).to.have.ownProperty('historyRetentionPeriod');
            expect(table1.historyRetentionPeriod).to.deep.equal({
              length: 3,
              unit: HistoryRetentionPeriodUnit.MONTH,
            });
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
            sequelize.queryInterface.showTemporalPeriods({ tableOrModel: User }),
            sequelize.queryInterface.showTemporalTables({ tableOrModel: User }),
          ]);

          expect(period).to.deep.equal([
            {
              name: 'SYSTEM_TIME',
              rowEnd: 'SysEndTime',
              rowStart: 'SysStartTime',
              type: TemporalPeriodType.SYSTEM,
            },
          ]);
          expect(tableInfo).to.have.length(1);
          const [table] = tableInfo;
          expect(table).to.have.ownProperty('tableName', User.table.tableName);
          expect(table).to.have.ownProperty('schema', User.table.schema);
          expect(table).to.have.ownProperty('temporalTableType', TemporalTableType.SYSTEM_PERIOD);

          await queryInterface.changeTemporalTable(User, {
            temporalTableType: TemporalTableType.NON_TEMPORAL,
          });

          const [period1, tableInfo1] = await Promise.all([
            sequelize.queryInterface.showTemporalPeriods({ tableOrModel: User }),
            sequelize.queryInterface.showTemporalTables({ tableOrModel: User }),
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
            {
              temporalTableType: TemporalTableType.SYSTEM_PERIOD,
              ...(sequelize.dialect.supports.temporalTables.historyTable
                ? { historyTable: 'UserHistory' }
                : {}),
            },
          );

          await User.sync({ force: true });

          const [period, tableInfo] = await Promise.all([
            sequelize.queryInterface.showTemporalPeriods({ tableOrModel: User }),
            sequelize.queryInterface.showTemporalTables({ tableOrModel: User }),
          ]);

          expect(period).to.deep.equal([
            {
              name: 'SYSTEM_TIME',
              rowEnd: 'SysEndTime',
              rowStart: 'SysStartTime',
              type: TemporalPeriodType.SYSTEM,
            },
          ]);
          expect(tableInfo).to.have.length(1);
          const [table] = tableInfo;
          expect(table).to.have.ownProperty('tableName', User.table.tableName);
          expect(table).to.have.ownProperty('schema', User.table.schema);
          expect(table).to.have.ownProperty('temporalTableType', TemporalTableType.SYSTEM_PERIOD);

          await queryInterface.changeTemporalTable(User, {
            temporalTableType: TemporalTableType.NON_TEMPORAL,
          });

          await queryInterface.changeTemporalTable(User, {
            temporalTableType: TemporalTableType.SYSTEM_PERIOD,
            ...(sequelize.dialect.supports.temporalTables.historyTable
              ? { historyTable: 'UserHistory' }
              : {}),
          });

          const [period1, tableInfo1] = await Promise.all([
            sequelize.queryInterface.showTemporalPeriods({ tableOrModel: User }),
            sequelize.queryInterface.showTemporalTables({ tableOrModel: User }),
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
                historyTable: 'UserHistory',
                temporalTableType: TemporalTableType.SYSTEM_PERIOD,
              },
            );

            await User.sync({ force: true });

            const tableInfo = await sequelize.queryInterface.showTemporalTables({
              tableOrModel: User,
            });
            expect(tableInfo).to.have.length(1);
            const [table] = tableInfo;
            expect(table).to.have.ownProperty('tableName', User.table.tableName);
            expect(table).to.have.ownProperty('schema', User.table.schema);
            expect(table).to.have.ownProperty('temporalTableType', TemporalTableType.SYSTEM_PERIOD);
            expect(table).to.have.ownProperty('historyTable');
            expect(table.historyTable).to.deep.equal({
              tableName: 'UserHistory',
              schema: sequelize.dialect.getDefaultSchema(),
            });
            expect(table).to.have.ownProperty('historyRetentionPeriod');
            expect(table.historyRetentionPeriod).to.deep.equal({
              length: -1,
              unit: HistoryRetentionPeriodUnit.INFINITE,
            });

            await queryInterface.changeTemporalTable(User, {
              historyTable: 'UserHistory',
              historyRetentionPeriod: { length: 3, unit: HistoryRetentionPeriodUnit.MONTH },
              temporalTableType: TemporalTableType.SYSTEM_PERIOD,
            });

            const tableInfo1 = await sequelize.queryInterface.showTemporalTables({
              tableOrModel: User,
            });
            expect(tableInfo1).to.have.length(1);
            const [table1] = tableInfo1;
            expect(table1).to.have.ownProperty('tableName', User.table.tableName);
            expect(table1).to.have.ownProperty('schema', User.table.schema);
            expect(table1).to.have.ownProperty(
              'temporalTableType',
              TemporalTableType.SYSTEM_PERIOD,
            );
            expect(table1).to.have.ownProperty('historyTable');
            expect(table1.historyTable).to.deep.equal({
              tableName: 'UserHistory',
              schema: sequelize.dialect.getDefaultSchema(),
            });
            expect(table1).to.have.ownProperty('historyRetentionPeriod');
            expect(table1.historyRetentionPeriod).to.deep.equal({
              length: 3,
              unit: HistoryRetentionPeriodUnit.MONTH,
            });
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
              start: { type: DataTypes.DATE },
              end: { type: DataTypes.DATE },
            },
            {
              applicationPeriodRowEnd: 'end',
              applicationPeriodRowStart: 'start',
              temporalTableType: TemporalTableType.APPLICATION_PERIOD,
            },
          );

          await User.sync({ force: true });

          await queryInterface.removeTemporalTable(User);

          const [descr, period, tableInfo] = await Promise.all([
            User.describe(),
            sequelize.queryInterface.showTemporalPeriods({ tableOrModel: User }),
            sequelize.queryInterface.showTemporalTables({ tableOrModel: User }),
          ]);

          expect(descr).to.have.ownProperty('name');
          expect(descr).to.have.ownProperty('end');
          expect(descr).to.have.ownProperty('start');
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
              start: { type: DataTypes.DATE },
              end: { type: DataTypes.DATE },
            },
            {
              applicationPeriodRowEnd: 'end',
              applicationPeriodRowStart: 'start',
              temporalTableType: TemporalTableType.BITEMPORAL,
            },
          );

          await User.sync({ force: true });

          await queryInterface.removeTemporalTable(User);

          const [descr, period, tableInfo] = await Promise.all([
            User.describe(),
            sequelize.queryInterface.showTemporalPeriods({ tableOrModel: User }),
            sequelize.queryInterface.showTemporalTables({ tableOrModel: User }),
          ]);

          expect(descr).to.have.ownProperty('name');
          expect(descr).to.have.ownProperty('end');
          expect(descr).to.have.ownProperty('start');
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
                start: { type: DataTypes.DATE },
                end: { type: DataTypes.DATE },
              },
              {
                applicationPeriodRowEnd: 'end',
                applicationPeriodRowStart: 'start',
                historyTable: 'UserHistory',
                temporalTableType: TemporalTableType.BITEMPORAL,
              },
            );

            await User.sync({ force: true });

            await queryInterface.removeTemporalTable(User);

            const allTables = await sequelize.queryInterface.listTables();
            const oldHistoryTable = allTables.find(t => t.tableName === 'UserHistory');
            assert(oldHistoryTable);
          });

          it('should remove a bi-temporal table and drop history table', async () => {
            const User = sequelize.define(
              'User',
              {
                name: { type: DataTypes.STRING },
                start: { type: DataTypes.DATE },
                end: { type: DataTypes.DATE },
              },
              {
                applicationPeriodRowEnd: 'end',
                applicationPeriodRowStart: 'start',
                historyTable: 'UserHistory',
                temporalTableType: TemporalTableType.BITEMPORAL,
              },
            );

            await User.sync({ force: true });

            await queryInterface.removeTemporalTable(User, { dropHistoryTable: true });

            const allTables = await sequelize.queryInterface.listTables();
            const oldHistoryTable = allTables.find(t => t.tableName === 'UserHistory');
            assert(!oldHistoryTable);
          });
        }
      });
    }

    if (sequelize.dialect.supports.temporalTables.systemPeriod) {
      describe('System-period', () => {
        it('should remove a system-period temporal table and drop columns', async () => {
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
            sequelize.queryInterface.showTemporalPeriods({ tableOrModel: User }),
            sequelize.queryInterface.showTemporalTables({ tableOrModel: User }),
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
                historyTable: 'UserHistory',
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
              {
                historyTable: 'UserHistory',
                temporalTableType: TemporalTableType.SYSTEM_PERIOD,
              },
            );

            await User.sync({ force: true });

            await queryInterface.removeTemporalTable(User, { dropHistoryTable: true });

            const allTables = await sequelize.queryInterface.listTables();
            const oldHistoryTable = allTables.find(t => t.tableName === 'UserHistory');
            assert(!oldHistoryTable);
          });
        }
      });
    }
  });
});
