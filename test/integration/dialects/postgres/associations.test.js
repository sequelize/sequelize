'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require(__dirname + '/../../support'),
  dialect = Support.getTestDialect(),
  config = require(__dirname + '/../../../config/config'),
  DataTypes = require(__dirname + '/../../../../lib/data-types');

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES Specific] associations', () => {
    describe('many-to-many', () => {
      describe('where tables have the same prefix', () => {
        it('should create a table wp_table1wp_table2s', function() {
          const Table2 = this.sequelize.define('wp_table2', {foo: DataTypes.STRING}),
            Table1 = this.sequelize.define('wp_table1', {foo: DataTypes.STRING});

          Table1.belongsToMany(Table2, { through: 'wp_table1swp_table2s' });
          Table2.belongsToMany(Table1, { through: 'wp_table1swp_table2s' });

          expect(this.sequelize.modelManager.getModel('wp_table1swp_table2s')).to.exist;
        });
      });

      describe('when join table name is specified', () => {
        beforeEach(function() {
          const Table2 = this.sequelize.define('ms_table1', {foo: DataTypes.STRING}),
            Table1 = this.sequelize.define('ms_table2', {foo: DataTypes.STRING});

          Table1.belongsToMany(Table2, {through: 'table1_to_table2'});
          Table2.belongsToMany(Table1, {through: 'table1_to_table2'});
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
          const self = this;

          //prevent periods from occurring in the table name since they are used to delimit (table.column)
          this.User = this.sequelize.define('User' + config.rand(), { name: DataTypes.STRING });
          this.Task = this.sequelize.define('Task' + config.rand(), { name: DataTypes.STRING });
          this.users = null;
          this.tasks = null;

          this.User.belongsToMany(this.Task, {as: 'Tasks', through: 'usertasks'});
          this.Task.belongsToMany(this.User, {as: 'Users', through: 'usertasks'});

          const users = [],
            tasks = [];

          for (let i = 0; i < 5; ++i) {
            users[users.length] = {name: 'User' + Math.random()};
          }

          for (let x = 0; x < 5; ++x) {
            tasks[tasks.length] = {name: 'Task' + Math.random()};
          }

          return this.sequelize.sync({ force: true }).then(() => {
            return self.User.bulkCreate(users).then(() => {
              return self.Task.bulkCreate(tasks).then(() => {
                return self.User.findAll().then((_users) => {
                  return self.Task.findAll().then((_tasks) => {
                    self.user = _users[0];
                    self.task = _tasks[0];
                  });
                });
              });
            });
          });
        });

        it('should correctly add an association to the dao', function() {
          const self = this;

          return self.user.getTasks().then((_tasks) => {
            expect(_tasks).to.have.length(0);
            return self.user.addTask(self.task).then(() => {
              return self.user.getTasks().then((_tasks) => {
                expect(_tasks).to.have.length(1);
              });
            });
          });
        });
      });

      describe('removeDAO', () => {
        it('should correctly remove associated objects', function() {
          const self = this,
            users = [],
            tasks = [];

          //prevent periods from occurring in the table name since they are used to delimit (table.column)
          this.User = this.sequelize.define('User' + config.rand(), { name: DataTypes.STRING });
          this.Task = this.sequelize.define('Task' + config.rand(), { name: DataTypes.STRING });
          this.users = null;
          this.tasks = null;

          this.User.belongsToMany(this.Task, {as: 'Tasks', through: 'usertasks'});
          this.Task.belongsToMany(this.User, {as: 'Users', through: 'usertasks'});

          for (let i = 0; i < 5; ++i) {
            users[users.length] = {id: i + 1, name: 'User' + Math.random()};
          }

          for (let x = 0; x < 5; ++x) {
            tasks[tasks.length] = {id: x + 1, name: 'Task' + Math.random()};
          }

          return this.sequelize.sync({ force: true }).then(() => {
            return self.User.bulkCreate(users).then(() => {
              return self.Task.bulkCreate(tasks).then(() => {
                return self.User.findAll().then((_users) => {
                  return self.Task.findAll().then((_tasks) => {
                    self.user = _users[0];
                    self.task = _tasks[0];
                    self.users = _users;
                    self.tasks = _tasks;

                    return self.user.getTasks().then((__tasks) => {
                      expect(__tasks).to.have.length(0);
                      return self.user.setTasks(self.tasks).then(() => {
                        return self.user.getTasks().then((_tasks) => {
                          expect(_tasks).to.have.length(self.tasks.length);
                          return self.user.removeTask(self.tasks[0]).then(() => {
                            return self.user.getTasks().then((_tasks) => {
                              expect(_tasks).to.have.length(self.tasks.length - 1);
                              return self.user.removeTasks([self.tasks[1], self.tasks[2]]).then(() => {
                                return self.user.getTasks().then((_tasks) => {
                                  expect(_tasks).to.have.length(self.tasks.length - 3);
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
