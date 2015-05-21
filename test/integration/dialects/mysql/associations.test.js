'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../../support')
  , DataTypes = require(__dirname + '/../../../../lib/data-types');

if (Support.dialectIsMySQL()) {
  describe('[MYSQL Specific] Associations', function() {
    describe('many-to-many', function() {
      describe('where tables have the same prefix', function() {
        it('should create a table wp_table1wp_table2s', function() {
          var Table2 = this.sequelize.define('wp_table2', {foo: DataTypes.STRING})
            , Table1 = this.sequelize.define('wp_table1', {foo: DataTypes.STRING})
            , self = this;

          Table1.belongsToMany(Table2, { through: 'wp_table1swp_table2s' });
          Table2.belongsToMany(Table1, { through: 'wp_table1swp_table2s' });
          return Table1.sync({ force: true }).then(function() {
            return Table2.sync({ force: true }).then(function() {
              expect(self.sequelize.modelManager.getModel('wp_table1swp_table2s')).to.exist;
            });
          });
        });
      });

      describe('when join table name is specified', function() {
        beforeEach(function() {
          var Table2 = this.sequelize.define('ms_table1', {foo: DataTypes.STRING})
            , Table1 = this.sequelize.define('ms_table2', {foo: DataTypes.STRING});

          Table1.belongsToMany(Table2, {through: 'table1_to_table2'});
          Table2.belongsToMany(Table1, {through: 'table1_to_table2'});
          return Table1.sync({ force: true }).then(function() {
            return Table2.sync({ force: true });
          });
        });

        it('should not use only a specified name', function() {
          expect(this.sequelize.modelManager.getModel('ms_table1sms_table2s')).not.to.exist;
          expect(this.sequelize.modelManager.getModel('table1_to_table2')).to.exist;
        });
      });
    });

    describe('HasMany', function() {
      beforeEach(function() {
        //prevent periods from occurring in the table name since they are used to delimit (table.column)
        this.User = this.sequelize.define('User' + Math.ceil(Math.random() * 10000000), { name: DataTypes.STRING });
        this.Task = this.sequelize.define('Task' + Math.ceil(Math.random() * 10000000), { name: DataTypes.STRING });
        this.users = null;
        this.tasks = null;

        this.User.belongsToMany(this.Task, {as: 'Tasks', through: 'UserTasks'});
        this.Task.belongsToMany(this.User, {as: 'Users', through: 'UserTasks'});

        var self = this
          , users = []
          , tasks = [];

        for (var i = 0; i < 5; ++i) {
          users[users.length] = {name: 'User' + Math.random()};
        }

        for (var x = 0; x < 5; ++x) {
          tasks[tasks.length] = {name: 'Task' + Math.random()};
        }

        return this.sequelize.sync({ force: true }).then(function() {
          return self.User.bulkCreate(users).then(function() {
            return self.Task.bulkCreate(tasks);
          });
        });
      });

      describe('addDAO / getModel', function() {
        beforeEach(function() {
          var self = this;

          self.user = null;
          self.task = null;

          return self.User.findAll().then(function(_users) {
            return self.Task.findAll().then(function(_tasks) {
              self.user = _users[0];
              self.task = _tasks[0];
            });
          });
        });

        it('should correctly add an association to the dao', function() {
          var self = this;

          return self.user.getTasks().then(function(_tasks) {
            expect(_tasks.length).to.equal(0);
            return self.user.addTask(self.task).then(function() {
              return self.user.getTasks().then(function(_tasks) {
                expect(_tasks.length).to.equal(1);
              });
            });
          });
        });
      });

      describe('removeDAO', function() {
        beforeEach(function() {
          var self = this;

          self.user = null;
          self.tasks = null;

          return self.User.findAll().then(function(_users) {
            return self.Task.findAll().then(function(_tasks) {
              self.user = _users[0];
              self.tasks = _tasks;
            });
          });
        });

        it('should correctly remove associated objects', function() {
          var self = this;

          return self.user.getTasks().then(function(__tasks) {
            expect(__tasks.length).to.equal(0);
            return self.user.setTasks(self.tasks).then(function() {
              return self.user.getTasks().then(function(_tasks) {
                expect(_tasks.length).to.equal(self.tasks.length);
                return self.user.removeTask(self.tasks[0]).then(function() {
                  return self.user.getTasks().then(function(_tasks) {
                    expect(_tasks.length).to.equal(self.tasks.length - 1);
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
}
