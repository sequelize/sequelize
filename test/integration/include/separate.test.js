'use strict';

const chai = require('chai'),
  expect = chai.expect,
  sinon = require('sinon'),
  Support = require('../support'),
  DataTypes = require('sequelize/lib/data-types'),
  current = Support.sequelize,
  dialect = Support.getTestDialect();

if (current.dialect.supports.groupedLimit) {
  describe(Support.getTestDialectTeaser('Include'), () => {
    describe('separate', () => {
      it('should run a hasMany association in a separate query', async function() {
        const User = this.sequelize.define('User', {}),
          Task = this.sequelize.define('Task', {}),
          sqlSpy = sinon.spy();

        User.Tasks = User.hasMany(Task, { as: 'tasks' });

        await this.sequelize.sync({ force: true });

        await Promise.all([User.create({
          id: 1,
          tasks: [
            {},
            {},
            {}
          ]
        }, {
          include: [User.Tasks]
        }), User.create({
          id: 2,
          tasks: [
            {}
          ]
        }, {
          include: [User.Tasks]
        })]);

        const users = await User.findAll({
          include: [
            { association: User.Tasks, separate: true }
          ],
          order: [
            ['id', 'ASC']
          ],
          logging: sqlSpy
        });

        expect(users[0].get('tasks')).to.be.ok;
        expect(users[0].get('tasks').length).to.equal(3);
        expect(users[1].get('tasks')).to.be.ok;
        expect(users[1].get('tasks').length).to.equal(1);

        expect(users[0].get('tasks')[0].createdAt).to.be.ok;
        expect(users[0].get('tasks')[0].updatedAt).to.be.ok;

        expect(sqlSpy).to.have.been.calledTwice;
      });

      it('should work even if the id was not included', async function() {
        const User = this.sequelize.define('User', {
            name: DataTypes.STRING
          }),
          Task = this.sequelize.define('Task', {}),
          sqlSpy = sinon.spy();

        User.Tasks = User.hasMany(Task, { as: 'tasks' });

        await this.sequelize.sync({ force: true });

        await User.create({
          id: 1,
          tasks: [
            {},
            {},
            {}
          ]
        }, {
          include: [User.Tasks]
        });

        const users = await User.findAll({
          attributes: ['name'],
          include: [
            { association: User.Tasks, separate: true }
          ],
          order: [
            ['id', 'ASC']
          ],
          logging: sqlSpy
        });

        expect(users[0].get('tasks')).to.be.ok;
        expect(users[0].get('tasks').length).to.equal(3);
        expect(sqlSpy).to.have.been.calledTwice;
      });

      it('should work even if include does not specify foreign key attribute with custom sourceKey', async function() {
        const User = this.sequelize.define('User', {
          name: DataTypes.STRING,
          userExtraId: {
            type: DataTypes.INTEGER,
            unique: true
          }
        });
        const Task = this.sequelize.define('Task', {
          title: DataTypes.STRING
        });
        const sqlSpy = sinon.spy();

        User.Tasks = User.hasMany(Task, {
          as: 'tasks',
          foreignKey: 'userId',
          sourceKey: 'userExtraId'
        });

        await this.sequelize
          .sync({ force: true });

        await User.create({
          id: 1,
          userExtraId: 222,
          tasks: [
            {},
            {},
            {}
          ]
        }, {
          include: [User.Tasks]
        });

        const users = await User.findAll({
          attributes: ['name'],
          include: [
            {
              attributes: [
                'title'
              ],
              association: User.Tasks,
              separate: true
            }
          ],
          order: [
            ['id', 'ASC']
          ],
          logging: sqlSpy
        });

        expect(users[0].get('tasks')).to.be.ok;
        expect(users[0].get('tasks').length).to.equal(3);
        expect(sqlSpy).to.have.been.calledTwice;
      });

      it('should not break a nested include with null values', async function() {
        const User = this.sequelize.define('User', {}),
          Team = this.sequelize.define('Team', {}),
          Company = this.sequelize.define('Company', {});

        User.Team = User.belongsTo(Team);
        Team.Company = Team.belongsTo(Company);

        await this.sequelize.sync({ force: true });
        await User.create({});

        await User.findAll({
          include: [
            { association: User.Team, include: [Team.Company] }
          ]
        });
      });

      it('should run a hasMany association with limit in a separate query', async function() {
        const User = this.sequelize.define('User', {}),
          Task = this.sequelize.define('Task', {
            userId: {
              type: DataTypes.INTEGER,
              field: 'user_id'
            }
          }),
          sqlSpy = sinon.spy();

        User.Tasks = User.hasMany(Task, { as: 'tasks', foreignKey: 'userId' });

        await this.sequelize.sync({ force: true });

        await Promise.all([User.create({
          id: 1,
          tasks: [
            {},
            {},
            {}
          ]
        }, {
          include: [User.Tasks]
        }), User.create({
          id: 2,
          tasks: [
            {},
            {},
            {},
            {}
          ]
        }, {
          include: [User.Tasks]
        })]);

        const users = await User.findAll({
          include: [
            { association: User.Tasks, limit: 2 }
          ],
          order: [
            ['id', 'ASC']
          ],
          logging: sqlSpy
        });

        expect(users[0].get('tasks')).to.be.ok;
        expect(users[0].get('tasks').length).to.equal(2);
        expect(users[1].get('tasks')).to.be.ok;
        expect(users[1].get('tasks').length).to.equal(2);
        expect(sqlSpy).to.have.been.calledTwice;
      });

      it('should run a nested (from a non-separate include) hasMany association in a separate query', async function() {
        const User = this.sequelize.define('User', {}),
          Company = this.sequelize.define('Company'),
          Task = this.sequelize.define('Task', {}),
          sqlSpy = sinon.spy();

        User.Company = User.belongsTo(Company, { as: 'company' });
        Company.Tasks = Company.hasMany(Task, { as: 'tasks' });

        await this.sequelize.sync({ force: true });

        await Promise.all([User.create({
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
            { association: User.Company, include: [Company.Tasks] }
          ]
        }), User.create({
          id: 2,
          company: {
            tasks: [
              {}
            ]
          }
        }, {
          include: [
            { association: User.Company, include: [Company.Tasks] }
          ]
        })]);

        const users = await User.findAll({
          include: [
            { association: User.Company, include: [
              { association: Company.Tasks, separate: true }
            ] }
          ],
          order: [
            ['id', 'ASC']
          ],
          logging: sqlSpy
        });

        expect(users[0].get('company').get('tasks')).to.be.ok;
        expect(users[0].get('company').get('tasks').length).to.equal(3);
        expect(users[1].get('company').get('tasks')).to.be.ok;
        expect(users[1].get('company').get('tasks').length).to.equal(1);
        expect(sqlSpy).to.have.been.calledTwice;
      });

      it('should work having a separate include between a parent and child include', async function() {
        const User = this.sequelize.define('User', {}),
          Project = this.sequelize.define('Project'),
          Company = this.sequelize.define('Company'),
          Task = this.sequelize.define('Task', {}),
          sqlSpy = sinon.spy();

        Company.Users = Company.hasMany(User, { as: 'users' });
        User.Tasks = User.hasMany(Task, { as: 'tasks' });
        Task.Project = Task.belongsTo(Project, { as: 'project' });

        await this.sequelize.sync({ force: true });

        await Promise.all([Company.create({
          id: 1,
          users: [
            {
              tasks: [
                { project: {} },
                { project: {} },
                { project: {} }
              ]
            }
          ]
        }, {
          include: [
            { association: Company.Users, include: [
              { association: User.Tasks, include: [
                Task.Project
              ] }
            ] }
          ]
        })]);

        const companies = await Company.findAll({
          include: [
            { association: Company.Users, include: [
              { association: User.Tasks, separate: true, include: [
                Task.Project
              ] }
            ] }
          ],
          order: [
            ['id', 'ASC']
          ],
          logging: sqlSpy
        });

        expect(sqlSpy).to.have.been.calledTwice;

        expect(companies[0].users[0].tasks[0].project).to.be.ok;
      });

      it('should run two nested hasMany association in a separate queries', async function() {
        const User = this.sequelize.define('User', {}),
          Project = this.sequelize.define('Project', {}),
          Task = this.sequelize.define('Task', {}),
          sqlSpy = sinon.spy();

        User.Projects = User.hasMany(Project, { as: 'projects' });
        Project.Tasks = Project.hasMany(Task, { as: 'tasks' });

        await this.sequelize.sync({ force: true });

        await Promise.all([User.create({
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
            { association: User.Projects, include: [Project.Tasks] }
          ]
        }), User.create({
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
            { association: User.Projects, include: [Project.Tasks] }
          ]
        })]);

        const users = await User.findAll({
          include: [
            { association: User.Projects, separate: true, include: [
              { association: Project.Tasks, separate: true }
            ] }
          ],
          order: [
            ['id', 'ASC']
          ],
          logging: sqlSpy
        });

        const u1projects = users[0].get('projects');

        expect(u1projects).to.be.ok;
        expect(u1projects[0].get('tasks')).to.be.ok;
        expect(u1projects[1].get('tasks')).to.be.ok;
        expect(u1projects.length).to.equal(2);

        // WTB ES2015 syntax ...
        expect(u1projects.find(p => p.id === 1).get('tasks').length).to.equal(3);
        expect(u1projects.find(p => p.id === 2).get('tasks').length).to.equal(1);

        expect(users[1].get('projects')).to.be.ok;
        expect(users[1].get('projects')[0].get('tasks')).to.be.ok;
        expect(users[1].get('projects').length).to.equal(1);
        expect(users[1].get('projects')[0].get('tasks').length).to.equal(2);

        expect(sqlSpy).to.have.been.calledThrice;
      });

      it('should work with two schema models in a hasMany association', async function() {
        const User = this.sequelize.define('User', {}, { schema: 'archive' }),
          Task = this.sequelize.define('Task', {
            id: { type: DataTypes.INTEGER, primaryKey: true },
            title: DataTypes.STRING
          }, { schema: 'archive' });

        User.Tasks = User.hasMany(Task, { as: 'tasks' });

        await Support.dropTestSchemas(this.sequelize);
        await this.sequelize.createSchema('archive');
        await this.sequelize.sync({ force: true });

        await Promise.all([User.create({
          id: 1,
          tasks: [
            { id: 1, title: 'b' },
            { id: 2, title: 'd' },
            { id: 3, title: 'c' },
            { id: 4, title: 'a' }
          ]
        }, {
          include: [User.Tasks]
        }), User.create({
          id: 2,
          tasks: [
            { id: 5, title: 'a' },
            { id: 6, title: 'c' },
            { id: 7, title: 'b' }
          ]
        }, {
          include: [User.Tasks]
        })]);

        const result = await User.findAll({
          include: [{ model: Task, limit: 2, as: 'tasks', order: [['id', 'ASC']] }],
          order: [
            ['id', 'ASC']
          ]
        });

        expect(result[0].tasks.length).to.equal(2);
        expect(result[0].tasks[0].title).to.equal('b');
        expect(result[0].tasks[1].title).to.equal('d');

        expect(result[1].tasks.length).to.equal(2);
        expect(result[1].tasks[0].title).to.equal('a');
        expect(result[1].tasks[1].title).to.equal('c');
        await this.sequelize.dropSchema('archive');
        const schemas = await this.sequelize.showAllSchemas();
        if (['postgres', 'mssql', 'mariadb'].includes(dialect)) {
          expect(schemas).to.not.have.property('archive');
        }
      });

      it('should work with required non-separate parent and required child', async function() {
        const User = this.sequelize.define('User', {});
        const Task = this.sequelize.define('Task', {});
        const Company = this.sequelize.define('Company', {});

        Task.User = Task.belongsTo(User);
        User.Tasks = User.hasMany(Task);
        User.Company = User.belongsTo(Company);

        await this.sequelize.sync({ force: true });

        const task = await Task.create({ id: 1 });
        const user = await task.createUser({ id: 2 });
        await user.createCompany({ id: 3 });

        const results = await Task.findAll({
          include: [{
            association: Task.User,
            required: true,
            include: [{
              association: User.Tasks,
              attributes: ['UserId'],
              separate: true,
              include: [{
                association: Task.User,
                attributes: ['id'],
                required: true,
                include: [{
                  association: User.Company
                }]
              }]
            }]
          }]
        });

        expect(results.length).to.equal(1);
        expect(results[0].id).to.equal(1);
        expect(results[0].User.id).to.equal(2);
        expect(results[0].User.Tasks.length).to.equal(1);
        expect(results[0].User.Tasks[0].User.id).to.equal(2);
        expect(results[0].User.Tasks[0].User.Company.id).to.equal(3);
      });
    });
  });
}
