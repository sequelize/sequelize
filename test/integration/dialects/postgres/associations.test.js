'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../../support'),
  dialect = Support.getTestDialect(),
  config = require('../../../config/config'),
  DataTypes = require('../../../../lib/data-types');

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES Specific] associations', () => {
    describe('many-to-many', () => {
      describe('where tables have the same prefix', () => {
        it('should create a table wp_table1wp_table2s', function() {
          const Table2 = this.sequelize.define('wp_table2', { foo: DataTypes.STRING }),
            Table1 = this.sequelize.define('wp_table1', { foo: DataTypes.STRING });

          Table1.belongsToMany(Table2, { through: 'wp_table1swp_table2s' });
          Table2.belongsToMany(Table1, { through: 'wp_table1swp_table2s' });

          expect(this.sequelize.modelManager.getModel('wp_table1swp_table2s')).to.exist;
        });
      });

      describe('when join table name is specified', () => {
        beforeEach(function() {
          const Table2 = this.sequelize.define('ms_table1', { foo: DataTypes.STRING }),
            Table1 = this.sequelize.define('ms_table2', { foo: DataTypes.STRING });

          Table1.belongsToMany(Table2, { through: 'table1_to_table2' });
          Table2.belongsToMany(Table1, { through: 'table1_to_table2' });
        });

        it('should not use a combined name', function() {
          expect(this.sequelize.modelManager.getModel('ms_table1sms_table2s')).not.to.exist;
        });

        it('should use the specified name', function() {
          expect(this.sequelize.modelManager.getModel('table1_to_table2')).to.exist;
        });
      });
    });

    describe('HasMany', () => {
      describe('addDAO / getModel', () => {
        beforeEach(function() {
          //prevent periods from occurring in the table name since they are used to delimit (table.column)
          this.User = this.sequelize.define(`User${config.rand()}`, { name: DataTypes.STRING });
          this.Task = this.sequelize.define(`Task${config.rand()}`, { name: DataTypes.STRING });
          this.users = null;
          this.tasks = null;

          this.User.belongsToMany(this.Task, { as: 'Tasks', through: 'usertasks' });
          this.Task.belongsToMany(this.User, { as: 'Users', through: 'usertasks' });

          const users = [],
            tasks = [];

          for (let i = 0; i < 5; ++i) {
            users[i] = { name: `User${Math.random()}` };
            tasks[i] = { name: `Task${Math.random()}` };
          }

          return this.sequelize.sync({ force: true }).then(() => {
            return this.User.bulkCreate(users).then(() => {
              return this.Task.bulkCreate(tasks).then(() => {
                return this.User.findAll().then(_users => {
                  return this.Task.findAll().then(_tasks => {
                    this.user = _users[0];
                    this.task = _tasks[0];
                  });
                });
              });
            });
          });
        });

        it('should correctly add an association to the dao', function() {
          return this.user.getTasks().then(_tasks => {
            expect(_tasks).to.have.length(0);
            return this.user.addTask(this.task).then(() => {
              return this.user.getTasks().then(_tasks => {
                expect(_tasks).to.have.length(1);
              });
            });
          });
        });
      });

      describe('removeDAO', () => {
        it('should correctly remove associated objects', function() {
          const users = [],
            tasks = [];

          //prevent periods from occurring in the table name since they are used to delimit (table.column)
          this.User = this.sequelize.define(`User${config.rand()}`, { name: DataTypes.STRING });
          this.Task = this.sequelize.define(`Task${config.rand()}`, { name: DataTypes.STRING });
          this.users = null;
          this.tasks = null;

          this.User.belongsToMany(this.Task, { as: 'Tasks', through: 'usertasks' });
          this.Task.belongsToMany(this.User, { as: 'Users', through: 'usertasks' });

          for (let i = 0; i < 5; ++i) {
            users[i] = { id: i + 1, name: `User${Math.random()}` };
            tasks[i] = { id: i + 1, name: `Task${Math.random()}` };
          }

          return this.sequelize.sync({ force: true }).then(() => {
            return this.User.bulkCreate(users).then(() => {
              return this.Task.bulkCreate(tasks).then(() => {
                return this.User.findAll().then(_users => {
                  return this.Task.findAll().then(_tasks => {
                    this.user = _users[0];
                    this.task = _tasks[0];
                    this.users = _users;
                    this.tasks = _tasks;

                    return this.user.getTasks().then(__tasks => {
                      expect(__tasks).to.have.length(0);
                      return this.user.setTasks(this.tasks).then(() => {
                        return this.user.getTasks().then(_tasks => {
                          expect(_tasks).to.have.length(this.tasks.length);
                          return this.user.removeTask(this.tasks[0]).then(() => {
                            return this.user.getTasks().then(_tasks => {
                              expect(_tasks).to.have.length(this.tasks.length - 1);
                              return this.user.removeTasks([this.tasks[1], this.tasks[2]]).then(() => {
                                return this.user.getTasks().then(_tasks => {
                                  expect(_tasks).to.have.length(this.tasks.length - 3);
                                });
                              });
                            });
                          });
                        });
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  });
}
