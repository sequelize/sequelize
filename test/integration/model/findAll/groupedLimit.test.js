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

        this.User.Projects = this.User.belongsToMany(this.Project, {through: this.ProjectUser});
        this.Project.belongsToMany(this.User, {as: 'members', through: this.ProjectUser});

        this.User.Tasks = this.User.hasMany(this.Task);

        return this.sequelize.sync({force: true}).then(() => {
          return Promise.join(
            this.User.bulkCreate([{age: -5}, {age: 45}, {age: 7}, {age: -9}, {age: 8}, {age: 15}]),
            this.Project.bulkCreate([{}, {}]),
            this.Task.bulkCreate([{}, {}])
          );
        })
          .then(() => [this.User.findAll(), this.Project.findAll(), this.Task.findAll()])
          .spread((users, projects, tasks) => {
            this.projects = projects;
            return Promise.join(
              projects[0].setMembers(users.slice(0, 4)),
              projects[1].setMembers(users.slice(2)),
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
              values: this.projects.map(item => item.get('id'))
            }
          }).then(users => {
            expect(users).to.have.length(5);
            users.filter(u => u.get('id') !== 3).forEach(u => {
              expect(u.get('project_users')).to.have.length(1);
            });
            users.filter(u => u.get('id') === 3).forEach(u => {
              expect(u.get('project_users')).to.have.length(2);
            });
          });
        });

        it('maps attributes from a grouped limit to models with include', function () {
          return this.User.findAll({
            groupedLimit: {
              limit: 3,
              on: this.User.Projects,
              values: this.projects.map(item => item.get('id'))
            },
            order: ['id'],
            include: [this.User.Tasks]
          }).then(users => {
            expect(users).to.have.length(5);

            expect(users[2].get('tasks')).to.have.length(2);
            users.filter(u => u.get('id') !== 3).forEach(u => {
              expect(u.get('project_users')).to.have.length(1);
            });
            users.filter(u => u.get('id') === 3).forEach(u => {
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
              values: this.projects.map(item => item.get('id'))
            },
            order: [
              Sequelize.fn('ABS', Sequelize.col('age'))
            ],
            include: [this.User.Tasks]
          }).then(users => {
            expect(users).to.have.length(4);
            expect(users.map(u => u.get('id'))).to.deep.equal([1, 3, 5, 4]);
          });
        });
      });

      describe('on: hasMany', function () {
        beforeEach(function () {
          this.User = this.sequelize.define('user');
          this.Task = this.sequelize.define('task');
          this.User.Tasks = this.User.hasMany(this.Task);

          return this.sequelize.sync({force: true}).then(() => {
            return Promise.join(
              this.User.bulkCreate([{}, {}, {}]),
              this.Task.bulkCreate([{id: 1}, {id: 2}, {id: 3}, {id: 4}, {id: 5}, {id: 6}])
            );
          })
            .then(() => [this.User.findAll(), this.Task.findAll()])
            .spread((users, tasks) => {
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
              values: this.users.map(item => item.get('id'))
            }
          }).then(tasks => {
            const byUser = _.groupBy(tasks, _.property('userId'));
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
