'use strict';

const _ = require('lodash'),
  chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../support'),
  Sequelize = require(__dirname + '/../../../index'),
  config = require(__dirname + '/../../config/config')
  ;

if (!Support.sequelize.dialect.supports.deferrableConstraints) {
  return;
}

describe(Support.getTestDialectTeaser('Sequelize'), () => {
  describe('Deferrable', () => {
    beforeEach(function() {
      this.run = function(deferrable, options) {
        options = options || {};

        const taskTableName      = options.taskTableName || 'tasks_' + config.rand();
        const transactionOptions = _.assign({}, { deferrable: Sequelize.Deferrable.SET_DEFERRED }, options);
        const userTableName      = 'users_' + config.rand();

        const User = this.sequelize.define(
          'User', { name: Sequelize.STRING }, { tableName: userTableName }
        );

        const Task = this.sequelize.define(
          'Task', {
            title: Sequelize.STRING,
            user_id: {
              allowNull: false,
              type: Sequelize.INTEGER,
              references: {
                model: userTableName,
                key: 'id',
                deferrable
              }
            }
          }, {
            tableName: taskTableName
          }
        );

        return User.sync({ force: true }).bind(this).then(() => {
          return Task.sync({ force: true });
        }).then(function() {
          return this.sequelize.transaction(transactionOptions, t => {
            return Task
              .create({ title: 'a task', user_id: -1 }, { transaction: t })
              .then(task => {
                return [task, User.create({}, { transaction: t })];
              })
              .spread((task, user) => {
                task.user_id = user.id;
                return task.save({ transaction: t });
              });
          });
        });
      };
    });

    describe('NOT', () => {
      it('does not allow the violation of the foreign key constraint', function() {
        return expect(this.run(Sequelize.Deferrable.NOT)).to.eventually.be.rejectedWith(Sequelize.ForeignKeyConstraintError);
      });
    });

    describe('INITIALLY_IMMEDIATE', () => {
      it('allows the violation of the foreign key constraint if the transaction is deferred', function() {
        return this
          .run(Sequelize.Deferrable.INITIALLY_IMMEDIATE)
          .then(task => {
            expect(task.title).to.equal('a task');
            expect(task.user_id).to.equal(1);
          });
      });

      it('does not allow the violation of the foreign key constraint if the transaction is not deffered', function() {
        return expect(this.run(Sequelize.Deferrable.INITIALLY_IMMEDIATE, {
          deferrable: undefined
        })).to.eventually.be.rejectedWith(Sequelize.ForeignKeyConstraintError);
      });

      it('allows the violation of the foreign key constraint if the transaction deferres only the foreign key constraint', function() {
        const taskTableName = 'tasks_' + config.rand();

        return this
          .run(Sequelize.Deferrable.INITIALLY_IMMEDIATE, {
            deferrable: Sequelize.Deferrable.SET_DEFERRED([taskTableName + '_user_id_fkey']),
            taskTableName
          })
          .then(task => {
            expect(task.title).to.equal('a task');
            expect(task.user_id).to.equal(1);
          });
      });
    });

    describe('INITIALLY_DEFERRED', () => {
      it('allows the violation of the foreign key constraint', function() {
        return this
          .run(Sequelize.Deferrable.INITIALLY_DEFERRED)
          .then(task => {
            expect(task.title).to.equal('a task');
            expect(task.user_id).to.equal(1);
          });
      });
    });
  });
});
