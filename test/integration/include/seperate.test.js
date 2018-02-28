'use strict';

const chai = require('chai'),
  expect = chai.expect,
  sinon = require('sinon'),
  Support = require(__dirname + '/../support'),
  Sequelize = require(__dirname + '/../../../index'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
  current = Support.sequelize,
  dialect = Support.getTestDialect(),
  Promise = Sequelize.Promise,
  _ = require('lodash');

if (current.dialect.supports.groupedLimit) {
  describe(Support.getTestDialectTeaser('Include'), () => {
    describe('separate', () => {
      it('should run a hasMany association in a separate query', function() {
        const User = this.sequelize.define('User', {}),
          Task = this.sequelize.define('Task', {}),
          sqlSpy = sinon.spy();

        User.Tasks = User.hasMany(Task, {as: 'tasks'});

        return this.sequelize.sync({force: true}).then(() => {
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
          ).then(() => {
            return User.findAll({
              include: [
                {association: User.Tasks, separate: true}
              ],
              order: [
                ['id', 'ASC']
              ],
              logging: sqlSpy
            });
          }).then(users => {
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

      it('should work even if the id was not included', function() {
        const User = this.sequelize.define('User', {
            name: DataTypes.STRING
          }),
          Task = this.sequelize.define('Task', {}),
          sqlSpy = sinon.spy();

        User.Tasks = User.hasMany(Task, {as: 'tasks'});

        return this.sequelize.sync({force: true}).then(() => {
          return User.create({
            id: 1,
            tasks: [
              {},
              {},
              {}
            ]
          }, {
            include: [User.Tasks]
          }).then(() => {
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
          }).then(users => {
            expect(users[0].get('tasks')).to.be.ok;
            expect(users[0].get('tasks').length).to.equal(3);
            expect(sqlSpy).to.have.been.calledTwice;
          });
        });
      });

      it('should not break a nested include with null values', function() {
        const User = this.sequelize.define('User', {}),
          Team = this.sequelize.define('Team', {}),
          Company = this.sequelize.define('Company', {});

        User.Team = User.belongsTo(Team);
        Team.Company = Team.belongsTo(Company);

        return this.sequelize.sync({force: true}).then(() => {
          return User.create({});
        }).then(() => {
          return User.findAll({
            include: [
              {association: User.Team, include: [Team.Company]}
            ]
          });
        });
      });

      it('should run a hasMany association with limit in a separate query', function() {
        const User = this.sequelize.define('User', {}),
          Task = this.sequelize.define('Task', {
            userId: {
              type: DataTypes.INTEGER,
              field: 'user_id'
            }
          }),
          sqlSpy = sinon.spy();

        User.Tasks = User.hasMany(Task, {as: 'tasks', foreignKey: 'userId'});

        return this.sequelize.sync({force: true}).then(() => {
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
          ).then(() => {
            return User.findAll({
              include: [
                {association: User.Tasks, limit: 2}
              ],
              order: [
                ['id', 'ASC']
              ],
              logging: sqlSpy
            });
          }).then(users => {
            expect(users[0].get('tasks')).to.be.ok;
            expect(users[0].get('tasks').length).to.equal(2);
            expect(users[1].get('tasks')).to.be.ok;
            expect(users[1].get('tasks').length).to.equal(2);
            expect(sqlSpy).to.have.been.calledTwice;
          });
        });
      });

      it('should run a nested (from a non-separate include) hasMany association in a separate query', function() {
        const User = this.sequelize.define('User', {}),
          Company = this.sequelize.define('Company'),
          Task = this.sequelize.define('Task', {}),
          sqlSpy = sinon.spy();

        User.Company = User.belongsTo(Company, {as: 'company'});
        Company.Tasks = Company.hasMany(Task, {as: 'tasks'});

        return this.sequelize.sync({force: true}).then(() => {
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
          ).then(() => {
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
          }).then(users => {
            expect(users[0].get('company').get('tasks')).to.be.ok;
            expect(users[0].get('company').get('tasks').length).to.equal(3);
            expect(users[1].get('company').get('tasks')).to.be.ok;
            expect(users[1].get('company').get('tasks').length).to.equal(1);
            expect(sqlSpy).to.have.been.calledTwice;
          });
        });
      });

      it('should work having a separate include between a parent and child include', function() {
        const User = this.sequelize.define('User', {}),
          Project = this.sequelize.define('Project'),
          Company = this.sequelize.define('Company'),
          Task = this.sequelize.define('Task', {}),
          sqlSpy = sinon.spy();

        Company.Users = Company.hasMany(User, {as: 'users'});
        User.Tasks = User.hasMany(Task, {as: 'tasks'});
        Task.Project = Task.belongsTo(Project, {as: 'project'});

        return this.sequelize.sync({force: true}).then(() => {
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
          ).then(() => {
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
          }).then(companies => {
            expect(sqlSpy).to.have.been.calledTwice;

            expect(companies[0].users[0].tasks[0].project).to.be.ok;
          });
        });
      });

      it('should run two nested hasMany association in a separate queries', function() {
        const User = this.sequelize.define('User', {}),
          Project = this.sequelize.define('Project', {}),
          Task = this.sequelize.define('Task', {}),
          sqlSpy = sinon.spy();

        User.Projects = User.hasMany(Project, {as: 'projects'});
        Project.Tasks = Project.hasMany(Task, {as: 'tasks'});

        return this.sequelize.sync({force: true}).then(() => {
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
          ).then(() => {
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
          }).then(users => {
            const u1projects = users[0].get('projects');

            expect(u1projects).to.be.ok;
            expect(u1projects[0].get('tasks')).to.be.ok;
            expect(u1projects[1].get('tasks')).to.be.ok;
            expect(u1projects.length).to.equal(2);

            // WTB ES2015 syntax ...
            expect(_.find(u1projects, p => { return p.id === 1; }).get('tasks').length).to.equal(3);
            expect(_.find(u1projects, p => { return p.id === 2; }).get('tasks').length).to.equal(1);

            expect(users[1].get('projects')).to.be.ok;
            expect(users[1].get('projects')[0].get('tasks')).to.be.ok;
            expect(users[1].get('projects').length).to.equal(1);
            expect(users[1].get('projects')[0].get('tasks').length).to.equal(2);

            expect(sqlSpy).to.have.been.calledThrice;
          });
        });
      });

      it('should work with two schema models in a hasMany association', function() {
        const User = this.sequelize.define('User', {}, {schema: 'archive'}),
          Task = this.sequelize.define('Task', {
            id: { type: DataTypes.INTEGER, primaryKey: true },
            title: DataTypes.STRING
          }, {schema: 'archive'});

        User.Tasks = User.hasMany(Task, {as: 'tasks'});

        return this.sequelize.dropAllSchemas().then(() => {
          return this.sequelize.createSchema('archive').then(() => {
            return this.sequelize.sync({force: true}).then(() => {
              return Promise.join(
                User.create({
                  id: 1,
                  tasks: [
                    {id: 1, title: 'b'},
                    {id: 2, title: 'd'},
                    {id: 3, title: 'c'},
                    {id: 4, title: 'a'}
                  ]
                }, {
                  include: [User.Tasks]
                }),
                User.create({
                  id: 2,
                  tasks: [
                    {id: 5, title: 'a'},
                    {id: 6, title: 'c'},
                    {id: 7, title: 'b'}
                  ]
                }, {
                  include: [User.Tasks]
                })
              );
            }).then(() => {
              return User.findAll({
                include: [{ model: Task, limit: 2, as: 'tasks', order: [['id', 'ASC']] }],
                order: [
                  ['id', 'ASC']
                ]
              }).then(result => {
                expect(result[0].tasks.length).to.equal(2);
                expect(result[0].tasks[0].title).to.equal('b');
                expect(result[0].tasks[1].title).to.equal('d');

                expect(result[1].tasks.length).to.equal(2);
                expect(result[1].tasks[0].title).to.equal('a');
                expect(result[1].tasks[1].title).to.equal('c');
                return this.sequelize.dropSchema('archive').then(() => {
                  return this.sequelize.showAllSchemas().then(schemas => {
                    if (dialect === 'postgres' || dialect === 'mssql') {
                      expect(schemas).to.be.empty;
                    }
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
