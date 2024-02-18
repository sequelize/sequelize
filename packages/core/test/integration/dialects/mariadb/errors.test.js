'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../../support');

const dialect = Support.getTestDialect();
const { DataTypes } = require('@sequelize/core');

if (dialect === 'mariadb') {
  describe('[MariaDB Specific] Errors', () => {
    const validateError = async (promise, errClass, errValues) => {
      const wanted = { ...errValues };

      await expect(promise).to.have.been.rejectedWith(errClass);

      try {
        return await promise;
      } catch (error) {
        return Object.keys(wanted).forEach(k => expect(error[k]).to.eql(wanted[k]));
      }
    };

    describe('ForeignKeyConstraintError', () => {
      beforeEach(function () {
        this.Task = this.sequelize.define('task', { title: DataTypes.STRING });
        this.User = this.sequelize.define('user', { username: DataTypes.STRING });
        this.UserTasks = this.sequelize.define('tasksusers', {
          userId: DataTypes.INTEGER,
          taskId: DataTypes.INTEGER,
        });

        this.User.belongsToMany(this.Task, {
          foreignKey: { onDelete: 'RESTRICT' },
          through: 'tasksusers',
          otherKey: { onDelete: 'RESTRICT' },
        });

        this.Task.belongsTo(this.User, { foreignKey: 'primaryUserId', as: 'primaryUsers' });
      });

      it('in context of DELETE restriction', async function () {
        const ForeignKeyConstraintError = this.sequelize.ForeignKeyConstraintError;
        await this.sequelize.sync({ force: true });

        const [user1, task1] = await Promise.all([
          this.User.create({ id: 67, username: 'foo' }),
          this.Task.create({ id: 52, title: 'task' }),
        ]);

        await user1.setTasks([task1]);

        await Promise.all([
          validateError(user1.destroy(), ForeignKeyConstraintError, {
            fields: ['userId'],
            table: 'users',
            value: undefined,
            index: 'tasksusers_ibfk_1',
            reltype: 'parent',
          }),
          validateError(task1.destroy(), ForeignKeyConstraintError, {
            fields: ['taskId'],
            table: 'tasks',
            value: undefined,
            index: 'tasksusers_ibfk_2',
            reltype: 'parent',
          }),
        ]);
      });

      it('in context of missing relation', async function () {
        const ForeignKeyConstraintError = this.sequelize.ForeignKeyConstraintError;

        await this.sequelize.sync({ force: true });

        await validateError(
          this.Task.create({ title: 'task', primaryUserId: 5 }),
          ForeignKeyConstraintError,
          {
            fields: ['primaryUserId'],
            table: 'users',
            value: 5,
            index: 'tasks_ibfk_1',
            reltype: 'child',
          },
        );
      });
    });
  });
}
