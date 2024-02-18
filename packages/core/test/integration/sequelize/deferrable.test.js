'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../support');
const { ConstraintChecking, DataTypes, Deferrable, Sequelize } = require('@sequelize/core');

if (Support.sequelize.dialect.supports.constraints.deferrable) {
  describe(Support.getTestDialectTeaser('Sequelize'), () => {
    describe('Deferrable', () => {
      const describeDeferrableTest = (title, defineModels) => {
        describe(title, () => {
          beforeEach(function () {
            this.run = async function (deferrable, options) {
              options ||= {};

              const taskTableName = options.taskTableName || `tasks_${Support.rand()}`;
              const transactionOptions = {
                constraintChecking: ConstraintChecking.DEFERRED,
                ...options,
              };
              const userTableName = `users_${Support.rand()}`;

              const { Task, User } = await defineModels({
                sequelize: this.sequelize,
                userTableName,
                deferrable,
                taskTableName,
              });

              return this.sequelize.transaction(transactionOptions, async t => {
                const task0 = await Task.create(
                  { title: 'a task', user_id: -1 },
                  { transaction: t },
                );

                const [task, user] = await Promise.all([
                  task0,
                  User.create({}, { transaction: t }),
                ]);
                task.user_id = user.id;

                return task.save({ transaction: t });
              });
            };
          });

          describe('NOT', () => {
            it('does not allow the violation of the foreign key constraint', async function () {
              await expect(this.run(Deferrable.NOT)).to.eventually.be.rejectedWith(
                Sequelize.ForeignKeyConstraintError,
              );
            });
          });

          describe('INITIALLY_IMMEDIATE', () => {
            it('allows the violation of the foreign key constraint if the transaction is deferred', async function () {
              const task = await this.run(Deferrable.INITIALLY_IMMEDIATE);

              expect(task.title).to.equal('a task');
              expect(task.user_id).to.equal(1);
            });

            it('does not allow the violation of the foreign key constraint if the transaction is not deferred', async function () {
              await expect(
                this.run(Deferrable.INITIALLY_IMMEDIATE, {
                  constraintChecking: undefined,
                }),
              ).to.eventually.be.rejectedWith(Sequelize.ForeignKeyConstraintError);
            });

            it('allows the violation of the foreign key constraint if the transaction deferred only the foreign key constraint', async function () {
              const taskTableName = `tasks_${Support.rand()}`;

              const task = await this.run(Deferrable.INITIALLY_IMMEDIATE, {
                constraintChecking: ConstraintChecking.DEFERRED([`${taskTableName}_user_id_fkey`]),
                taskTableName,
              });

              expect(task.title).to.equal('a task');
              expect(task.user_id).to.equal(1);
            });
          });

          describe('INITIALLY_DEFERRED', () => {
            it('allows the violation of the foreign key constraint', async function () {
              const task = await this.run(Deferrable.INITIALLY_DEFERRED);

              expect(task.title).to.equal('a task');
              expect(task.user_id).to.equal(1);
            });
          });
        });
      };

      describeDeferrableTest(
        'set in define',
        async ({ deferrable, sequelize, taskTableName, userTableName }) => {
          const User = sequelize.define(
            'User',
            { name: DataTypes.STRING },
            { tableName: userTableName },
          );

          const Task = sequelize.define(
            'Task',
            {
              title: DataTypes.STRING,
              user_id: {
                allowNull: false,
                type: DataTypes.INTEGER,
                references: {
                  table: userTableName,
                  key: 'id',
                  deferrable,
                },
              },
            },
            {
              tableName: taskTableName,
            },
          );

          await User.sync({ force: true });
          await Task.sync({ force: true });

          return { Task, User };
        },
      );

      describeDeferrableTest(
        'set in addConstraint',
        async ({ deferrable, sequelize, taskTableName, userTableName }) => {
          const User = sequelize.define(
            'User',
            { name: DataTypes.STRING },
            { tableName: userTableName },
          );

          const Task = sequelize.define(
            'Task',
            {
              title: DataTypes.STRING,
              user_id: {
                allowNull: false,
                type: DataTypes.INTEGER,
              },
            },
            {
              tableName: taskTableName,
            },
          );

          await User.sync({ force: true });
          await Task.sync({ force: true });

          await sequelize.queryInterface.addConstraint(taskTableName, {
            fields: ['user_id'],
            type: 'FOREIGN KEY',
            name: `${taskTableName}_user_id_fkey`,
            deferrable,
            references: {
              table: userTableName,
              field: 'id',
            },
          });

          return { Task, User };
        },
      );
    });
  });
}
