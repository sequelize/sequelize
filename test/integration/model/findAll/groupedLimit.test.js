'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../../support')
  , Sequelize = Support.Sequelize
  , DataTypes = require(__dirname + '/../../../../lib/data-types')
  , current = Support.sequelize
  , Promise = current.Promise
  , _ = require('lodash');

if (current.dialect.supports['UNION ALL']) {
  describe(Support.getTestDialectTeaser('Model'), function() {
    describe('findAll', function () {
      describe('groupedLimit', function () {
        beforeEach(function () {
          this.User = this.sequelize.define('user', {
            age: Sequelize.INTEGER
          });
          this.Project = this.sequelize.define('project', {
            title: DataTypes.STRING
          });
          this.Task = this.sequelize.define('task');

          this.ProjectUser = this.sequelize.define('project_user', {}, {timestamps: false});
          this.ProjectUserParanoid = this.sequelize.define('project_user_paranoid', {}, {
            timestamps: true,
            paranoid: true,
            createdAt: false,
            updatedAt: false
          });

          this.User.Projects = this.User.belongsToMany(this.Project, {through: this.ProjectUser});
          this.Project.belongsToMany(this.User, {as: 'members', through: this.ProjectUser});

          this.User.ParanoidProjects = this.User.belongsToMany(this.Project, {through: this.ProjectUserParanoid});
          this.Project.belongsToMany(this.User, {as: 'paranoidMembers', through: this.ProjectUserParanoid});

          this.User.Tasks = this.User.hasMany(this.Task);

          return this.sequelize.sync({force: true}).bind(this).then(function() {
            return Promise.join(
              this.User.bulkCreate([{age: -5}, {age: 45}, {age: 7}, {age: -9}, {age: 8}, {age: 15}, {age: -9}]),
              this.Project.bulkCreate([{}, {}]),
              this.Task.bulkCreate([{}, {}])
            );
          })
            .then(function() { return [this.User.findAll(), this.Project.findAll(), this.Task.findAll()]; })
            .spread(function (users, projects, tasks) {
              this.projects = projects;
              return Promise.join(
                projects[0].setMembers(users.slice(0, 4)),
                projects[1].setMembers(users.slice(2)),
                projects[0].setParanoidMembers(users.slice(0, 4)),
                projects[1].setParanoidMembers(users.slice(2)),
                users[2].setTasks(tasks)
              );
            });
        });

        describe('on: belongsToMany', function () {
          it('maps attributes from a grouped limit to models', function () {
            return this.User.findAll({
              groupedLimit: {
                limit: 3,
                on: this.User.Projects,
                values: this.projects.map(function (item) { return item.get('id'); })
              }
            }).then(function (users) {
              expect(users).to.have.length(5);
              users.filter(function (u) { return u.get('id') !== 3; }).forEach(function (u) {
                expect(u.get('project_users')).to.have.length(1);
              });
              users.filter(function (u) { return u.get('id') === 3; }).forEach(function(u) {
                expect(u.get('project_users')).to.have.length(2);
              });
            });
          });

          it('maps attributes from a grouped limit to models with include', function () {
            return this.User.findAll({
              groupedLimit: {
                limit: 3,
                on: this.User.Projects,
                values: this.projects.map(function (item) { return item.get('id'); })
              },
              order: ['id'],
              include: [this.User.Tasks]
            }).then(function (users) {
              /*
               project1 - 1, 2, 3
               project2 - 3, 4, 5
               */
              expect(users).to.have.length(5);

              expect(users.map(function (u) { return u.get('id'); })).to.deep.equal([1, 2, 3, 4, 5]);

              expect(users[2].get('tasks')).to.have.length(2);
              users.filter(function (u) { return u.get('id') !== 3; }).forEach(function (u) {
                expect(u.get('project_users')).to.have.length(1);
              });
              users.filter(function (u) { return u.get('id') === 3; }).forEach(function(u) {
                expect(u.get('project_users')).to.have.length(2);
              });
            });
          });

          it('works with computed order', function () {
            return this.User.findAll({
              attributes: ['id'],
              groupedLimit: {
                limit: 3,
                on: this.User.Projects,
                values: this.projects.map(function (item) { return item.get('id'); })
              },
              order: [
                Sequelize.fn('ABS', Sequelize.col('age'))
              ],
              include: [this.User.Tasks]
            }).then(function (users) {
              /*
               project1 - 1, 3, 4
               project2 - 3, 5, 4
             */
              expect(users).to.have.length(4);
              expect(users.map(function(u) { return u.get('id'); })).to.deep.equal([1, 3, 5, 4]);
            });
          });

          it('works with multiple orders', function () {
            return this.User.findAll({
              attributes: ['id'],
              groupedLimit: {
                limit: 3,
                on: this.User.Projects,
                values: this.projects.map(function (item) { return item.get('id'); })
              },
              order: [
                Sequelize.fn('ABS', Sequelize.col('age')),
                ['id', 'DESC']
              ],
              include: [this.User.Tasks]
            }).then(function (users) {
              /*
                project1 - 1, 3, 4
                project2 - 3, 5, 7
               */
              expect(users).to.have.length(5);
              expect(users.map(function (u) { return u.get('id'); })).to.deep.equal([1, 3, 5, 7, 4]);
            });
          });

          it('works with paranoid junction models', function () {
            return this.User.findAll({
              attributes: ['id'],
              groupedLimit: {
                limit: 3,
                on: this.User.ParanoidProjects,
                values: this.projects.map(function (item) { return item.get('id'); })
              },
              order: [
                Sequelize.fn('ABS', Sequelize.col('age')),
                ['id', 'DESC']
              ],
              include: [this.User.Tasks]
            }).bind(this).then(function (users) {
              /*
                project1 - 1, 3, 4
                project2 - 3, 5, 7
               */
              expect(users).to.have.length(5);
              expect(users.map(function (u) { return u.get('id'); })).to.deep.equal([1, 3, 5, 7, 4]);

              return Sequelize.Promise.join(
                this.projects[0].setParanoidMembers(users.slice(0, 2)),
                this.projects[1].setParanoidMembers(users.slice(4))
              );
            }).then(function () {
              return this.User.findAll({
                attributes: ['id'],
                groupedLimit: {
                  limit: 3,
                  on: this.User.ParanoidProjects,
                  values: this.projects.map(function (item) { return item.get('id'); })
                },
                order: [
                  Sequelize.fn('ABS', Sequelize.col('age')),
                  ['id', 'DESC']
                ],
                include: [this.User.Tasks]
              });
            }).then(function (users) {
              /*
                project1 - 1, 3
                project2 - 4
               */
              expect(users).to.have.length(3);
              expect(users.map(function (u) { return u.get('id'); })).to.deep.equal([1, 3, 4]);
            });
          });
        });

        describe('on: hasMany', function () {
          beforeEach(function () {
            this.User = this.sequelize.define('user');
            this.Task = this.sequelize.define('task');
            this.User.Tasks = this.User.hasMany(this.Task);

            return this.sequelize.sync({force: true}).bind(this).then(function() {
              return Promise.join(
                this.User.bulkCreate([{}, {}, {}]),
                this.Task.bulkCreate([{id: 1}, {id: 2}, {id: 3}, {id: 4}, {id: 5}, {id: 6}])
              );
            })
              .then(function() { return [this.User.findAll(), this.Task.findAll()]; })
              .spread(function(users, tasks) {
                this.users = users;
                return Promise.join(
                  users[0].setTasks(tasks[0]),
                  users[1].setTasks(tasks.slice(1, 4)),
                  users[2].setTasks(tasks.slice(4))
                );
              });
          });

          it('Applies limit and order correctly', function () {
            return this.Task.findAll({
              order: [
                ['id', 'DESC']
              ],
              groupedLimit: {
                limit: 3,
                on: this.User.Tasks,
                values: this.users.map(function (item) { return item.get('id'); })
              }
            }).then(function (tasks) {
              var byUser = _.groupBy(tasks, _.property('userId'));
              expect(Object.keys(byUser)).to.have.length(3);

              expect(byUser[1]).to.have.length(1);
              expect(byUser[2]).to.have.length(3);
              expect(_.invokeMap(byUser[2], 'get', 'id')).to.deep.equal([4, 3, 2]);
              expect(byUser[3]).to.have.length(2);
            });
          });
        });
      });
    });
  });
}
