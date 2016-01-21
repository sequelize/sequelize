'use strict';

/* jshint -W030 */
var chai = require('chai')
  , expect = chai.expect
  , sinon = require('sinon')
  , Support = require(__dirname + '/../support')
  , Sequelize = require(__dirname + '/../../../index')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , current = Support.sequelize
  , Promise = Sequelize.Promise
  , _ = require('lodash');

if (current.dialect.supports.groupedLimit) {
  describe(Support.getTestDialectTeaser('Include'), function() {
    describe('separate', function () {
      it('should run a hasMany association in a separate query', function () {
        var User = this.sequelize.define('User', {})
          , Task = this.sequelize.define('Task', {})
          , sqlSpy = sinon.spy();

        User.Tasks = User.hasMany(Task, {as: 'tasks'});

        return this.sequelize.sync({force: true}).then(function () {
          return Promise.join(
            User.create({
              id: 1,
              tasks: [
                {},
                {},
                {}
              ]
            }, {
              include: [User.Tasks]
            }),
            User.create({
              id: 2,
              tasks: [
                {}
              ]
            }, {
              include: [User.Tasks]
            })
          ).then(function () {
            return User.findAll({
              include: [
                {association: User.Tasks, separate: true}
              ],
              order: [
                ['id', 'ASC']
              ],
              logging: sqlSpy
            });
          }).then(function (users) {
            expect(users[0].get('tasks')).to.be.ok;
            expect(users[0].get('tasks').length).to.equal(3);
            expect(users[1].get('tasks')).to.be.ok;
            expect(users[1].get('tasks').length).to.equal(1);

            expect(users[0].get('tasks')[0].createdAt).to.be.ok;
            expect(users[0].get('tasks')[0].updatedAt).to.be.ok;

            expect(sqlSpy).to.have.been.calledTwice;
          });
        });
      });

      it('should work even if the id was not included', function () {
        var User = this.sequelize.define('User', {
            name: DataTypes.STRING
          })
          , Task = this.sequelize.define('Task', {})
          , sqlSpy = sinon.spy();

        User.Tasks = User.hasMany(Task, {as: 'tasks'});

        return this.sequelize.sync({force: true}).then(function () {
          return User.create({
              id: 1,
              tasks: [
                {},
                {},
                {}
              ]
            }, {
              include: [User.Tasks]
            }).then(function () {
              return User.findAll({
                attributes: ['name'],
                include: [
                  {association: User.Tasks, separate: true}
                ],
                order: [
                  ['id', 'ASC']
                ],
                logging: sqlSpy
              });
            }).then(function (users) {
              expect(users[0].get('tasks')).to.be.ok;
              expect(users[0].get('tasks').length).to.equal(3);
              expect(sqlSpy).to.have.been.calledTwice;
            });
        });
      });

      it('should not break a nested include with null values', function () {
        var User = this.sequelize.define('User', {})
          , Team = this.sequelize.define('Team', {})
          , Company = this.sequelize.define('Company', {});

        User.Team = User.belongsTo(Team);
        Team.Company = Team.belongsTo(Company);

        return this.sequelize.sync({force: true}).then(function () {
          return User.create({});
        }).then(function () {
          return User.findAll({
            include: [
              {association: User.Team, include: [Team.Company]}
            ]
          });
        });
      });

      it('should run a hasMany association with limit in a separate query', function () {
        var User = this.sequelize.define('User', {})
          , Task = this.sequelize.define('Task', {
              userId: {
                type: DataTypes.INTEGER,
                field: 'user_id'
              }
            })
          , sqlSpy = sinon.spy();

        User.Tasks = User.hasMany(Task, {as: 'tasks', foreignKey: 'userId'});

        return this.sequelize.sync({force: true}).then(function () {
          return Promise.join(
            User.create({
              id: 1,
              tasks: [
                {},
                {},
                {}
              ]
            }, {
              include: [User.Tasks]
            }),
            User.create({
              id: 2,
              tasks: [
                {},
                {},
                {},
                {}
              ]
            }, {
              include: [User.Tasks]
            })
          ).then(function () {
            return User.findAll({
              include: [
                {association: User.Tasks, limit: 2}
              ],
              order: [
                ['id', 'ASC']
              ],
              logging: sqlSpy
            });
          }).then(function (users) {
            expect(users[0].get('tasks')).to.be.ok;
            expect(users[0].get('tasks').length).to.equal(2);
            expect(users[1].get('tasks')).to.be.ok;
            expect(users[1].get('tasks').length).to.equal(2);
            expect(sqlSpy).to.have.been.calledTwice;
          });
        });
      });

      it('should run a nested (from a non-separate include) hasMany association in a separate query', function () {
        var User = this.sequelize.define('User', {})
          , Company = this.sequelize.define('Company')
          , Task = this.sequelize.define('Task', {})
          , sqlSpy = sinon.spy();

        User.Company = User.belongsTo(Company, {as: 'company'});
        Company.Tasks = Company.hasMany(Task, {as: 'tasks'});

        return this.sequelize.sync({force: true}).then(function () {
          return Promise.join(
            User.create({
              id: 1,
              company: {
                tasks: [
                  {},
                  {},
                  {}
                ]
              }
            }, {
              include: [
                {association: User.Company, include: [Company.Tasks]}
              ]
            }),
            User.create({
              id: 2,
              company: {
                tasks: [
                  {}
                ]
              }
            }, {
              include: [
                {association: User.Company, include: [Company.Tasks]}
              ]
            })
          ).then(function () {
            return User.findAll({
              include: [
                {association: User.Company, include: [
                  {association: Company.Tasks, separate: true}
                ]}
              ],
              order: [
                ['id', 'ASC']
              ],
              logging: sqlSpy
            });
          }).then(function (users) {
            expect(users[0].get('company').get('tasks')).to.be.ok;
            expect(users[0].get('company').get('tasks').length).to.equal(3);
            expect(users[1].get('company').get('tasks')).to.be.ok;
            expect(users[1].get('company').get('tasks').length).to.equal(1);
            expect(sqlSpy).to.have.been.calledTwice;
          });
        });
      });

      it('should work having a separate include between a parent and child include', function () {
        var User = this.sequelize.define('User', {})
          , Project = this.sequelize.define('Project')
          , Company = this.sequelize.define('Company')
          , Task = this.sequelize.define('Task', {})
          , sqlSpy = sinon.spy();

        Company.Users = Company.hasMany(User, {as: 'users'});
        User.Tasks = User.hasMany(Task, {as: 'tasks'});
        Task.Project = Task.belongsTo(Project, {as: 'project'});

        return this.sequelize.sync({force: true}).then(function () {
          return Promise.join(
            Company.create({
              id: 1,
              users: [
                {
                  tasks: [
                    {project: {}},
                    {project: {}},
                    {project: {}}
                  ]
                }
              ]
            }, {
              include: [
                {association: Company.Users, include: [
                  {association: User.Tasks, include: [
                    Task.Project
                  ]}
                ]}
              ]
            })
          ).then(function () {
            return Company.findAll({
              include: [
                {association: Company.Users, include: [
                  {association: User.Tasks, separate: true, include: [
                    Task.Project
                  ]}
                ]}
              ],
              order: [
                ['id', 'ASC']
              ],
              logging: sqlSpy
            });
          }).then(function (companies) {
            expect(sqlSpy).to.have.been.calledTwice;

            expect(companies[0].users[0].tasks[0].project).to.be.ok;
          });
        });
      });

      it('should run two nested hasMany association in a separate queries', function () {
        var User = this.sequelize.define('User', {})
          , Project = this.sequelize.define('Project', {})
          , Task = this.sequelize.define('Task', {})
          , sqlSpy = sinon.spy();

        User.Projects = User.hasMany(Project, {as: 'projects'});
        Project.Tasks = Project.hasMany(Task, {as: 'tasks'});

        return this.sequelize.sync({force: true}).then(function () {
          return Promise.join(
            User.create({
              id: 1,
              projects: [
                {
                  id: 1,
                  tasks: [
                    {},
                    {},
                    {}
                  ]
                },
                {
                  id: 2,
                  tasks: [
                    {}
                  ]
                }
              ]
            }, {
              include: [
                {association: User.Projects, include: [Project.Tasks]}
              ]
            }),
            User.create({
              id: 2,
              projects: [
                {
                  id: 3,
                  tasks: [
                    {},
                    {}
                  ]
                }
              ]
            }, {
              include: [
                {association: User.Projects, include: [Project.Tasks]}
              ]
            })
          ).then(function () {
            return User.findAll({
              include: [
                {association: User.Projects, separate: true, include: [
                  {association: Project.Tasks, separate: true}
                ]}
              ],
              order: [
                ['id', 'ASC']
              ],
              logging: sqlSpy
            });
          }).then(function (users) {
            var u1projects = users[0].get('projects');

            expect(u1projects).to.be.ok;
            expect(u1projects[0].get('tasks')).to.be.ok;
            expect(u1projects[1].get('tasks')).to.be.ok;
            expect(u1projects.length).to.equal(2);

            // WTB ES2015 syntax ...
            expect(_.find(u1projects, function (p) { return p.id === 1; }).get('tasks').length).to.equal(3);
            expect(_.find(u1projects, function (p) { return p.id === 2; }).get('tasks').length).to.equal(1);

            expect(users[1].get('projects')).to.be.ok;
            expect(users[1].get('projects')[0].get('tasks')).to.be.ok;
            expect(users[1].get('projects').length).to.equal(1);
            expect(users[1].get('projects')[0].get('tasks').length).to.equal(2);

            expect(sqlSpy).to.have.been.calledThrice;
          });
        });
      });
    });
  });
}
