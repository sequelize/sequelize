'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../../support')
  , dialect = Support.getTestDialect()
  , config = require(__dirname + '/../../../config/config')
  , DataTypes = require(__dirname + '/../../../../lib/data-types');

if (dialect.match(/^postgres/)) {
  describe('[POSTGRES Specific] associations', function() {
    describe('many-to-many', function() {
      describe('where tables have the same prefix', function() {
        it('should create a table wp_table1wp_table2s', function() {
          var Table2 = this.sequelize.define('wp_table2', {foo: DataTypes.STRING})
            , Table1 = this.sequelize.define('wp_table1', {foo: DataTypes.STRING});

          Table1.hasMany(Table2);
          Table2.hasMany(Table1);

          expect(this.sequelize.daoFactoryManager.getDAO('wp_table1swp_table2s')).to.exist;
        });
      });

      describe('when join table name is specified', function() {
        beforeEach(function() {
          var Table2 = this.sequelize.define('ms_table1', {foo: DataTypes.STRING})
            , Table1 = this.sequelize.define('ms_table2', {foo: DataTypes.STRING});

          Table1.hasMany(Table2, {joinTableName: 'table1_to_table2'});
          Table2.hasMany(Table1, {joinTableName: 'table1_to_table2'});
        });

        it('should not use a combined name', function() {
          expect(this.sequelize.daoFactoryManager.getDAO('ms_table1sms_table2s')).not.to.exist;
        });

        it('should use the specified name', function() {
          expect(this.sequelize.daoFactoryManager.getDAO('table1_to_table2')).to.exist;
        });
      });
    });

    describe('HasMany', function() {
      describe('addDAO / getDAO', function() {
        beforeEach(function() {
          var self = this;

          //prevent periods from occurring in the table name since they are used to delimit (table.column)
          this.User = this.sequelize.define('User' + config.rand(), { name: DataTypes.STRING });
          this.Task = this.sequelize.define('Task' + config.rand(), { name: DataTypes.STRING });
          this.users = null;
          this.tasks = null;

          this.User.belongsToMany(this.Task, {as: 'Tasks', through: 'usertasks'});
          this.Task.belongsToMany(this.User, {as: 'Users', through: 'usertasks'});

          var users = []
            , tasks = [];

          for (var i = 0; i < 5; ++i) {
            users[users.length] = {name: 'User' + Math.random()};
          }

          for (var x = 0; x < 5; ++x) {
            tasks[tasks.length] = {name: 'Task' + Math.random()};
          }

          return this.sequelize.sync({ force: true }).then(function() {
            return self.User.bulkCreate(users).then(function() {
              return self.Task.bulkCreate(tasks).then(function() {
                return self.User.findAll().then(function(_users) {
                  return self.Task.findAll().then(function(_tasks) {
                    self.user = _users[0];
                    self.task = _tasks[0];
                  });
                });
              });
            });
          });
        });

        it('should correctly add an association to the dao', function() {
          var self = this;

          return self.user.getTasks().then(function(_tasks) {
            expect(_tasks).to.have.length(0);
            return self.user.addTask(self.task).then(function() {
              return self.user.getTasks().then(function(_tasks) {
                expect(_tasks).to.have.length(1);
              });
            });
          });
        });
      });

      describe('removeDAO', function() {
        it('should correctly remove associated objects', function() {
          var self = this
            , users = []
            , tasks = [];

          //prevent periods from occurring in the table name since they are used to delimit (table.column)
          this.User = this.sequelize.define('User' + config.rand(), { name: DataTypes.STRING });
          this.Task = this.sequelize.define('Task' + config.rand(), { name: DataTypes.STRING });
          this.users = null;
          this.tasks = null;

          this.User.hasMany(this.Task, {as: 'Tasks', through: 'usertasks'});
          this.Task.hasMany(this.User, {as: 'Users', through: 'usertasks'});

          for (var i = 0; i < 5; ++i) {
            users[users.length] = {id: i + 1, name: 'User' + Math.random()};
          }

          for (var x = 0; x < 5; ++x) {
            tasks[tasks.length] = {id: x + 1, name: 'Task' + Math.random()};
          }

          return this.sequelize.sync({ force: true }).then(function() {
            return self.User.bulkCreate(users).then(function() {
              return self.Task.bulkCreate(tasks).then(function() {
                return self.User.findAll().then(function(_users) {
                  return self.Task.findAll().then(function(_tasks) {
                    self.user = _users[0];
                    self.task = _tasks[0];
                    self.users = _users;
                    self.tasks = _tasks;

                    return self.user.getTasks().then(function(__tasks) {
                      expect(__tasks).to.have.length(0);
                      return self.user.setTasks(self.tasks).then(function() {
                        return self.user.getTasks().then(function(_tasks) {
                          expect(_tasks).to.have.length(self.tasks.length);
                          return self.user.removeTask(self.tasks[0]).then(function() {
                            return self.user.getTasks().then(function(_tasks) {
                              expect(_tasks).to.have.length(self.tasks.length - 1);
                              return self.user.removeTasks([self.tasks[1], self.tasks[2]]).then(function() {
                                return self.user.getTasks().then(function(_tasks) {
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
