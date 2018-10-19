'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require('../../support');
const dialect = Support.getTestDialect();
const Sequelize = require('../../../../index');
const DataTypes = require('../../../../lib/data-types');

if (dialect === 'mysql') {
  describe('[MYSQL Specific] Errors', () => {

    const validateError = (promise, errClass, errValues) => {
      const wanted = Object.assign({}, errValues);

      return expect(promise).to.have.been.rejectedWith(errClass).then(() =>
        promise.catch(err => Object.keys(wanted).forEach(k => expect(err[k]).to.eql(wanted[k]))));
    };

    describe('ForeignKeyConstraintError', () => {
      beforeEach(function() {
        this.Task = this.sequelize.define('task', { title: DataTypes.STRING });
        this.User = this.sequelize.define('user', { username: DataTypes.STRING });
        this.UserTasks = this.sequelize.define('tasksusers', { userId: DataTypes.INTEGER, taskId: DataTypes.INTEGER });

        this.User.belongsToMany(this.Task, { onDelete: 'RESTRICT', through: 'tasksusers' });
        this.Task.belongsToMany(this.User, { onDelete: 'RESTRICT', through: 'tasksusers' });

        this.Task.belongsTo(this.User, { foreignKey: 'primaryUserId', as: 'primaryUsers' });
      });

      it('in context of DELETE restriction', function() {
        const ctx = {};
        return this.sequelize.sync({ force: true }).then(() => {
          return Promise.all([
            this.User.create({ id: 67, username: 'foo' }),
            this.Task.create({ id: 52, title: 'task' })
          ]);
        }).then(([user1, task1]) => {
          ctx.user1 = user1;
          ctx.task1 = task1;
          return user1.setTasks([task1]);
        }).then(() => {
          return Promise.all([
            validateError(ctx.user1.destroy(), Sequelize.ForeignKeyConstraintError, {
              fields: ['userId'],
              table: 'users',
              value: undefined,
              index: 'tasksusers_ibfk_1',
              reltype: 'parent'
            }),
            validateError(ctx.task1.destroy(), Sequelize.ForeignKeyConstraintError, {
              fields: ['taskId'],
              table: 'tasks',
              value: undefined,
              index: 'tasksusers_ibfk_2',
              reltype: 'parent'
            })
          ]);
        });
      });

      it('in context of missing relation', function() {
        return this.sequelize.sync({ force: true }).then(() =>
          validateError(this.Task.create({ title: 'task', primaryUserId: 5 }), Sequelize.ForeignKeyConstraintError, {
            fields: ['primaryUserId'],
            table: 'users',
            value: 5,
            index: 'tasks_ibfk_1',
            reltype: 'child'
          }));
      });

    });
  });
}
