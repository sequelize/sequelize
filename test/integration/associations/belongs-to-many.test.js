'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('../../../lib/data-types'),
  Sequelize = require('../../../index'),
  _ = require('lodash'),
  sinon = require('sinon'),
  Promise = Sequelize.Promise,
  Op = Sequelize.Op,
  current = Support.sequelize,
  dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('BelongsToMany'), () => {
  describe('getAssociations', () => {
    beforeEach(function() {
      this.User = this.sequelize.define('User', { username: DataTypes.STRING });
      this.Task = this.sequelize.define('Task', { title: DataTypes.STRING, active: DataTypes.BOOLEAN });

      this.User.belongsToMany(this.Task, { through: 'UserTasks' });
      this.Task.belongsToMany(this.User, { through: 'UserTasks' });

      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.all([
          this.User.create({ username: 'John' }),
          this.Task.create({ title: 'Get rich', active: true }),
          this.Task.create({ title: 'Die trying', active: false })
        ]);
      }).then(([john, task1, task2]) => {
        this.tasks = [task1, task2];
        this.user = john;
        return john.setTasks([task1, task2]);
      });
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        const ctx = {};
        return Support.prepareTransactionTest(this.sequelize).then(sequelize => {
          ctx.sequelize = sequelize;
          ctx.Article = sequelize.define('Article', { 'title': DataTypes.STRING });
          ctx.Label = sequelize.define('Label', { 'text': DataTypes.STRING });

          ctx.Article.belongsToMany(ctx.Label, { through: 'ArticleLabels' });
          ctx.Label.belongsToMany(ctx.Article, { through: 'ArticleLabels' });

          return sequelize.sync({ force: true });
        }).then(() => {
          return Promise.all([
            ctx.Article.create({ title: 'foo' }),
            ctx.Label.create({ text: 'bar' }),
            ctx.sequelize.transaction()
          ]);
        }).then(([article, label, t]) => {
          ctx.t = t;
          return article.setLabels([label], { transaction: t });
        }).then(() => {
          return ctx.Article.findAll({ transaction: ctx.t });
        }).then(articles => {
          return articles[0].getLabels();
        }).then(labels => {
          expect(labels).to.have.length(0);
          return ctx.Article.findAll({ transaction: ctx.t });
        }).then(articles => {
          return articles[0].getLabels({ transaction: ctx.t });
        }).then(labels => {
          expect(labels).to.have.length(1);
          return ctx.t.rollback();
        });
      });
    }

    it('gets all associated objects with all fields', function() {
      return this.User.findOne({ where: { username: 'John' } }).then(john => {
        return john.getTasks();
      }).then(tasks => {
        Object.keys(tasks[0].rawAttributes).forEach(attr => {
          expect(tasks[0]).to.have.property(attr);
        });
      });
    });

    it('gets all associated objects when no options are passed', function() {
      return this.User.findOne({ where: { username: 'John' } }).then(john => {
        return john.getTasks();
      }).then(tasks => {
        expect(tasks).to.have.length(2);
      });
    });

    it('only get objects that fulfill the options', function() {
      return this.User.findOne({ where: { username: 'John' } }).then(john => {
        return john.getTasks({
          where: {
            active: true
          }
        });
      }).then(tasks => {
        expect(tasks).to.have.length(1);
      });
    });

    it('supports a where not in', function() {
      return this.User.findOne({
        where: {
          username: 'John'
        }
      }).then(john => {
        return john.getTasks({
          where: {
            title: {
              [Op.not]: ['Get rich']
            }
          }
        });
      }).then(tasks => {
        expect(tasks).to.have.length(1);
      });
    });

    it('supports a where not in on the primary key', function() {
      return this.User.findOne({
        where: {
          username: 'John'
        }
      }).then(john => {
        return john.getTasks({
          where: {
            id: {
              [Op.not]: [this.tasks[0].get('id')]
            }
          }
        });
      }).then(tasks => {
        expect(tasks).to.have.length(1);
      });
    });

    it('only gets objects that fulfill options with a formatted value', function() {
      return this.User.findOne({ where: { username: 'John' } }).then(john => {
        return john.getTasks({ where: { active: true } });
      }).then(tasks => {
        expect(tasks).to.have.length(1);
      });
    });

    it('get associated objects with an eager load', function() {
      return this.User.findOne({ where: { username: 'John' }, include: [this.Task] }).then(john => {
        expect(john.Tasks).to.have.length(2);
      });
    });

    it('get associated objects with an eager load with conditions but not required', function() {
      const Label = this.sequelize.define('Label', { 'title': DataTypes.STRING, 'isActive': DataTypes.BOOLEAN }),
        Task = this.Task,
        User = this.User;

      Task.hasMany(Label);
      Label.belongsTo(Task);

      return Label.sync({ force: true }).then(() => {
        return User.findOne({
          where: { username: 'John' },
          include: [
            { model: Task, required: false, include: [
              { model: Label, required: false, where: { isActive: true } }
            ] }
          ]
        });
      }).then(john => {
        expect(john.Tasks).to.have.length(2);
      });
    });

    it('should support schemas', function() {
      const AcmeUser = this.sequelize.define('User', {
          username: DataTypes.STRING
        }).schema('acme', '_'),
        AcmeProject = this.sequelize.define('Project', {
          title: DataTypes.STRING,
          active: DataTypes.BOOLEAN
        }).schema('acme', '_'),
        AcmeProjectUsers = this.sequelize.define('ProjectUsers', {
          status: DataTypes.STRING,
          data: DataTypes.INTEGER
        }).schema('acme', '_');

      AcmeUser.belongsToMany(AcmeProject, { through: AcmeProjectUsers });
      AcmeProject.belongsToMany(AcmeUser, { through: AcmeProjectUsers });

      const ctx = {};
      return Support.dropTestSchemas(this.sequelize).then(() => {
        return this.sequelize.createSchema('acme');
      }).then(() => {
        return Promise.all([
          AcmeUser.sync({ force: true }),
          AcmeProject.sync({ force: true })
        ]);
      }).then(() => {
        return AcmeProjectUsers.sync({ force: true });
      }).then(() => {
        return AcmeUser.create();
      }).then(u => {
        ctx.u = u;
        return AcmeProject.create();
      }).then(p => {
        return ctx.u.addProject(p, { through: { status: 'active', data: 42 } });
      }).then(() => {
        return ctx.u.getProjects();
      }).then(projects => {
        expect(projects).to.have.length(1);
        const project = projects[0];
        expect(project.ProjectUsers).to.be.ok;
        expect(project.status).not.to.exist;
        expect(project.ProjectUsers.status).to.equal('active');
        return this.sequelize.dropSchema('acme').then(() => {
          return this.sequelize.showAllSchemas().then(schemas => {
            if (dialect === 'postgres' || dialect === 'mssql' || dialect === 'mariadb') {
              expect(schemas).to.not.have.property('acme');
            }
          });
        });
      });
    });

    it('supports custom primary keys and foreign keys', function() {
      const User = this.sequelize.define('User', {
        'id_user': {
          type: DataTypes.UUID,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4,
          allowNull: false
        }
      }, {
        tableName: 'tbl_user'
      });

      const Group = this.sequelize.define('Group', {
        'id_group': {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4
        }
      }, {
        tableName: 'tbl_group'
      });

      const User_has_Group = this.sequelize.define('User_has_Group', {

      }, {
        tableName: 'tbl_user_has_group'
      });

      User.belongsToMany(Group, { as: 'groups', through: User_has_Group, foreignKey: 'id_user' });
      Group.belongsToMany(User, { as: 'users', through: User_has_Group, foreignKey: 'id_group' });

      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.join(
          User.create(),
          Group.create()
        ).then(([user, group]) => {
          return user.addGroup(group);
        }).then(() => {
          return User.findOne({
            where: {}
          }).then(user => {
            return user.getGroups();
          });
        });
      });
    });

    it('supports primary key attributes with different field and attribute names', function() {
      const User = this.sequelize.define('User', {
        userSecondId: {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4,
          field: 'user_id'
        }
      }, {
        tableName: 'tbl_user'
      });

      const Group = this.sequelize.define('Group', {
        groupSecondId: {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4,
          field: 'group_id'
        }
      }, {
        tableName: 'tbl_group'
      });

      const User_has_Group = this.sequelize.define('User_has_Group', {

      }, {
        tableName: 'tbl_user_has_group'
      });

      User.belongsToMany(Group, { through: User_has_Group });
      Group.belongsToMany(User, { through: User_has_Group });

      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.join(
          User.create(),
          Group.create()
        ).then(([user, group]) => {
          return user.addGroup(group);
        }).then(() => {
          return Promise.join(
            User.findOne({
              where: {},
              include: [Group]
            }),
            User.findAll({
              include: [Group]
            })
          );
        }).then(([user, users]) => {
          expect(user.Groups.length).to.be.equal(1);
          expect(user.Groups[0].User_has_Group.UserUserSecondId).to.be.ok;
          expect(user.Groups[0].User_has_Group.UserUserSecondId).to.be.equal(user.userSecondId);
          expect(user.Groups[0].User_has_Group.GroupGroupSecondId).to.be.ok;
          expect(user.Groups[0].User_has_Group.GroupGroupSecondId).to.be.equal(user.Groups[0].groupSecondId);
          expect(users.length).to.be.equal(1);
          expect(users[0].toJSON()).to.be.eql(user.toJSON());
        });
      });
    });

    it('supports non primary key attributes for joins (sourceKey only)', function() {
      const User = this.sequelize.define('User', {
        id: {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4,
          field: 'user_id'
        },
        userSecondId: {
          type: DataTypes.UUID,
          allowNull: false,
          defaultValue: DataTypes.UUIDV4,
          field: 'user_second_id'
        }
      }, {
        tableName: 'tbl_user',
        indexes: [
          {
            unique: true,
            fields: ['user_second_id']
          }
        ]
      });

      const Group = this.sequelize.define('Group', {
        id: {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4,
          field: 'group_id'
        },
        groupSecondId: {
          type: DataTypes.UUID,
          allowNull: false,
          defaultValue: DataTypes.UUIDV4,
          field: 'group_second_id'
        }
      }, {
        tableName: 'tbl_group',
        indexes: [
          {
            unique: true,
            fields: ['group_second_id']
          }
        ]
      });

      User.belongsToMany(Group, { through: 'usergroups', sourceKey: 'userSecondId' });
      Group.belongsToMany(User, { through: 'usergroups', sourceKey: 'groupSecondId' });

      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.join(
          User.create(),
          User.create(),
          Group.create(),
          Group.create()
        ).then(([user1, user2, group1, group2]) => {
          return Promise.join(user1.addGroup(group1), user2.addGroup(group2));
        }).then(() => {
          return Promise.join(
            User.findAll({
              where: {},
              include: [Group]
            }),
            Group.findAll({
              include: [User]
            })
          );
        }).then(([users, groups]) => {
          expect(users.length).to.be.equal(2);
          expect(users[0].Groups.length).to.be.equal(1);
          expect(users[1].Groups.length).to.be.equal(1);
          expect(users[0].Groups[0].usergroups.UserUserSecondId).to.be.ok;
          expect(users[0].Groups[0].usergroups.UserUserSecondId).to.be.equal(users[0].userSecondId);
          expect(users[0].Groups[0].usergroups.GroupGroupSecondId).to.be.ok;
          expect(users[0].Groups[0].usergroups.GroupGroupSecondId).to.be.equal(users[0].Groups[0].groupSecondId);
          expect(users[1].Groups[0].usergroups.UserUserSecondId).to.be.ok;
          expect(users[1].Groups[0].usergroups.UserUserSecondId).to.be.equal(users[1].userSecondId);
          expect(users[1].Groups[0].usergroups.GroupGroupSecondId).to.be.ok;
          expect(users[1].Groups[0].usergroups.GroupGroupSecondId).to.be.equal(users[1].Groups[0].groupSecondId);
          
          expect(groups.length).to.be.equal(2);
          expect(groups[0].Users.length).to.be.equal(1);
          expect(groups[1].Users.length).to.be.equal(1);
          expect(groups[0].Users[0].usergroups.GroupGroupSecondId).to.be.ok;
          expect(groups[0].Users[0].usergroups.GroupGroupSecondId).to.be.equal(groups[0].groupSecondId);
          expect(groups[0].Users[0].usergroups.UserUserSecondId).to.be.ok;
          expect(groups[0].Users[0].usergroups.UserUserSecondId).to.be.equal(groups[0].Users[0].userSecondId);
          expect(groups[1].Users[0].usergroups.GroupGroupSecondId).to.be.ok;
          expect(groups[1].Users[0].usergroups.GroupGroupSecondId).to.be.equal(groups[1].groupSecondId);
          expect(groups[1].Users[0].usergroups.UserUserSecondId).to.be.ok;
          expect(groups[1].Users[0].usergroups.UserUserSecondId).to.be.equal(groups[1].Users[0].userSecondId);
        });
      });
    });

    it('supports non primary key attributes for joins (targetKey only)', function() {
      const User = this.sequelize.define('User', {
        id: {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4,
          field: 'user_id'
        },
        userSecondId: {
          type: DataTypes.UUID,
          allowNull: false,
          defaultValue: DataTypes.UUIDV4,
          field: 'user_second_id'
        }
      }, {
        tableName: 'tbl_user',
        indexes: [
          {
            unique: true,
            fields: ['user_second_id']
          }
        ]
      });

      const Group = this.sequelize.define('Group', {
        id: {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4,
          field: 'group_id'
        }
      }, {
        tableName: 'tbl_group',
        indexes: [
          {
            unique: true,
            fields: ['group_id']
          }
        ]
      });

      User.belongsToMany(Group, { through: 'usergroups', sourceKey: 'userSecondId' });
      Group.belongsToMany(User, { through: 'usergroups', targetKey: 'userSecondId' });

      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.join(
          User.create(),
          User.create(),
          Group.create(),
          Group.create()
        ).then(([user1, user2, group1, group2]) => {
          return Promise.join(user1.addGroup(group1), user2.addGroup(group2));
        }).then(() => {
          return Promise.join(
            User.findAll({
              where: {},
              include: [Group]
            }),
            Group.findAll({
              include: [User]
            })
          );
        }).then(([users, groups]) => {
          expect(users.length).to.be.equal(2);
          expect(users[0].Groups.length).to.be.equal(1);
          expect(users[1].Groups.length).to.be.equal(1);
          expect(users[0].Groups[0].usergroups.UserUserSecondId).to.be.ok;
          expect(users[0].Groups[0].usergroups.UserUserSecondId).to.be.equal(users[0].userSecondId);
          expect(users[0].Groups[0].usergroups.GroupId).to.be.ok;
          expect(users[0].Groups[0].usergroups.GroupId).to.be.equal(users[0].Groups[0].id);
          expect(users[1].Groups[0].usergroups.UserUserSecondId).to.be.ok;
          expect(users[1].Groups[0].usergroups.UserUserSecondId).to.be.equal(users[1].userSecondId);
          expect(users[1].Groups[0].usergroups.GroupId).to.be.ok;
          expect(users[1].Groups[0].usergroups.GroupId).to.be.equal(users[1].Groups[0].id);
          
          expect(groups.length).to.be.equal(2);
          expect(groups[0].Users.length).to.be.equal(1);
          expect(groups[1].Users.length).to.be.equal(1);
          expect(groups[0].Users[0].usergroups.GroupId).to.be.ok;
          expect(groups[0].Users[0].usergroups.GroupId).to.be.equal(groups[0].id);
          expect(groups[0].Users[0].usergroups.UserUserSecondId).to.be.ok;
          expect(groups[0].Users[0].usergroups.UserUserSecondId).to.be.equal(groups[0].Users[0].userSecondId);
          expect(groups[1].Users[0].usergroups.GroupId).to.be.ok;
          expect(groups[1].Users[0].usergroups.GroupId).to.be.equal(groups[1].id);
          expect(groups[1].Users[0].usergroups.UserUserSecondId).to.be.ok;
          expect(groups[1].Users[0].usergroups.UserUserSecondId).to.be.equal(groups[1].Users[0].userSecondId);
        });
      });
    });

    it('supports non primary key attributes for joins (sourceKey and targetKey)', function() {
      const User = this.sequelize.define('User', {
        id: {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4,
          field: 'user_id'
        },
        userSecondId: {
          type: DataTypes.UUID,
          allowNull: false,
          defaultValue: DataTypes.UUIDV4,
          field: 'user_second_id'
        }
      }, {
        tableName: 'tbl_user',
        indexes: [
          {
            unique: true,
            fields: ['user_second_id']
          }
        ]
      });

      const Group = this.sequelize.define('Group', {
        id: {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4,
          field: 'group_id'
        },
        groupSecondId: {
          type: DataTypes.UUID,
          allowNull: false,
          defaultValue: DataTypes.UUIDV4,
          field: 'group_second_id'
        }
      }, {
        tableName: 'tbl_group',
        indexes: [
          {
            unique: true,
            fields: ['group_second_id']
          }
        ]
      });

      User.belongsToMany(Group, { through: 'usergroups', sourceKey: 'userSecondId', targetKey: 'groupSecondId' });
      Group.belongsToMany(User, { through: 'usergroups', sourceKey: 'groupSecondId', targetKey: 'userSecondId' });

      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.join(
          User.create(),
          User.create(),
          Group.create(),
          Group.create()
        ).then(([user1, user2, group1, group2]) => {
          return Promise.join(user1.addGroup(group1), user2.addGroup(group2));
        }).then(() => {
          return Promise.join(
            User.findAll({
              where: {},
              include: [Group]
            }),
            Group.findAll({
              include: [User]
            })
          );
        }).then(([users, groups]) => {
          expect(users.length).to.be.equal(2);
          expect(users[0].Groups.length).to.be.equal(1);
          expect(users[1].Groups.length).to.be.equal(1);
          expect(users[0].Groups[0].usergroups.UserUserSecondId).to.be.ok;
          expect(users[0].Groups[0].usergroups.UserUserSecondId).to.be.equal(users[0].userSecondId);
          expect(users[0].Groups[0].usergroups.GroupGroupSecondId).to.be.ok;
          expect(users[0].Groups[0].usergroups.GroupGroupSecondId).to.be.equal(users[0].Groups[0].groupSecondId);
          expect(users[1].Groups[0].usergroups.UserUserSecondId).to.be.ok;
          expect(users[1].Groups[0].usergroups.UserUserSecondId).to.be.equal(users[1].userSecondId);
          expect(users[1].Groups[0].usergroups.GroupGroupSecondId).to.be.ok;
          expect(users[1].Groups[0].usergroups.GroupGroupSecondId).to.be.equal(users[1].Groups[0].groupSecondId);
          
          expect(groups.length).to.be.equal(2);
          expect(groups[0].Users.length).to.be.equal(1);
          expect(groups[1].Users.length).to.be.equal(1);
          expect(groups[0].Users[0].usergroups.GroupGroupSecondId).to.be.ok;
          expect(groups[0].Users[0].usergroups.GroupGroupSecondId).to.be.equal(groups[0].groupSecondId);
          expect(groups[0].Users[0].usergroups.UserUserSecondId).to.be.ok;
          expect(groups[0].Users[0].usergroups.UserUserSecondId).to.be.equal(groups[0].Users[0].userSecondId);
          expect(groups[1].Users[0].usergroups.GroupGroupSecondId).to.be.ok;
          expect(groups[1].Users[0].usergroups.GroupGroupSecondId).to.be.equal(groups[1].groupSecondId);
          expect(groups[1].Users[0].usergroups.UserUserSecondId).to.be.ok;
          expect(groups[1].Users[0].usergroups.UserUserSecondId).to.be.equal(groups[1].Users[0].userSecondId);
        });
      });
    });

    it('supports non primary key attributes for joins (custom through model)', function() {
      const User = this.sequelize.define('User', {
        id: {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4,
          field: 'user_id'
        },
        userSecondId: {
          type: DataTypes.UUID,
          allowNull: false,
          defaultValue: DataTypes.UUIDV4,
          field: 'user_second_id'
        }
      }, {
        tableName: 'tbl_user',
        indexes: [
          {
            unique: true,
            fields: ['user_second_id']
          }
        ]
      });

      const Group = this.sequelize.define('Group', {
        id: {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4,
          field: 'group_id'
        },
        groupSecondId: {
          type: DataTypes.UUID,
          allowNull: false,
          defaultValue: DataTypes.UUIDV4,
          field: 'group_second_id'
        }
      }, {
        tableName: 'tbl_group',
        indexes: [
          {
            unique: true,
            fields: ['group_second_id']
          }
        ]
      });

      const User_has_Group = this.sequelize.define('User_has_Group', {
      }, {
        tableName: 'tbl_user_has_group',
        indexes: [
          {
            unique: true,
            fields: ['UserUserSecondId', 'GroupGroupSecondId']
          }
        ]
      });

      User.belongsToMany(Group, { through: User_has_Group, sourceKey: 'userSecondId' });
      Group.belongsToMany(User, { through: User_has_Group, sourceKey: 'groupSecondId' });

      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.join(
          User.create(),
          User.create(),
          Group.create(),
          Group.create()
        ).then(([user1, user2, group1, group2]) => {
          return Promise.join(user1.addGroup(group1), user2.addGroup(group2));
        }).then(() => {
          return Promise.join(
            User.findAll({
              where: {},
              include: [Group]
            }),
            Group.findAll({
              include: [User]
            })
          );
        }).then(([users, groups]) => {
          expect(users.length).to.be.equal(2);
          expect(users[0].Groups.length).to.be.equal(1);
          expect(users[1].Groups.length).to.be.equal(1);
          expect(users[0].Groups[0].User_has_Group.UserUserSecondId).to.be.ok;
          expect(users[0].Groups[0].User_has_Group.UserUserSecondId).to.be.equal(users[0].userSecondId);
          expect(users[0].Groups[0].User_has_Group.GroupGroupSecondId).to.be.ok;
          expect(users[0].Groups[0].User_has_Group.GroupGroupSecondId).to.be.equal(users[0].Groups[0].groupSecondId);
          expect(users[1].Groups[0].User_has_Group.UserUserSecondId).to.be.ok;
          expect(users[1].Groups[0].User_has_Group.UserUserSecondId).to.be.equal(users[1].userSecondId);
          expect(users[1].Groups[0].User_has_Group.GroupGroupSecondId).to.be.ok;
          expect(users[1].Groups[0].User_has_Group.GroupGroupSecondId).to.be.equal(users[1].Groups[0].groupSecondId);
          
          expect(groups.length).to.be.equal(2);
          expect(groups[0].Users.length).to.be.equal(1);
          expect(groups[1].Users.length).to.be.equal(1);
          expect(groups[0].Users[0].User_has_Group.GroupGroupSecondId).to.be.ok;
          expect(groups[0].Users[0].User_has_Group.GroupGroupSecondId).to.be.equal(groups[0].groupSecondId);
          expect(groups[0].Users[0].User_has_Group.UserUserSecondId).to.be.ok;
          expect(groups[0].Users[0].User_has_Group.UserUserSecondId).to.be.equal(groups[0].Users[0].userSecondId);
          expect(groups[1].Users[0].User_has_Group.GroupGroupSecondId).to.be.ok;
          expect(groups[1].Users[0].User_has_Group.GroupGroupSecondId).to.be.equal(groups[1].groupSecondId);
          expect(groups[1].Users[0].User_has_Group.UserUserSecondId).to.be.ok;
          expect(groups[1].Users[0].User_has_Group.UserUserSecondId).to.be.equal(groups[1].Users[0].userSecondId);
        });
      });
    });

    it('supports non primary key attributes for joins (custom foreignKey)', function() {
      const User = this.sequelize.define('User', {
        id: {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4,
          field: 'user_id'
        },
        userSecondId: {
          type: DataTypes.UUID,
          allowNull: false,
          defaultValue: DataTypes.UUIDV4,
          field: 'user_second_id'
        }
      }, {
        tableName: 'tbl_user',
        indexes: [
          {
            unique: true,
            fields: ['user_second_id']
          }
        ]
      });

      const Group = this.sequelize.define('Group', {
        id: {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4,
          field: 'group_id'
        },
        groupSecondId: {
          type: DataTypes.UUID,
          allowNull: false,
          defaultValue: DataTypes.UUIDV4,
          field: 'group_second_id'
        }
      }, {
        tableName: 'tbl_group',
        indexes: [
          {
            unique: true,
            fields: ['group_second_id']
          }
        ]
      });

      User.belongsToMany(Group, { through: 'usergroups', foreignKey: 'userId2', sourceKey: 'userSecondId' });
      Group.belongsToMany(User, { through: 'usergroups', foreignKey: 'groupId2', sourceKey: 'groupSecondId' });

      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.join(
          User.create(),
          User.create(),
          Group.create(),
          Group.create()
        ).then(([user1, user2, group1, group2]) => {
          return Promise.join(user1.addGroup(group1), user2.addGroup(group2));
        }).then(() => {
          return Promise.join(
            User.findAll({
              where: {},
              include: [Group]
            }),
            Group.findAll({
              include: [User]
            })
          );
        }).then(([users, groups]) => {
          expect(users.length).to.be.equal(2);
          expect(users[0].Groups.length).to.be.equal(1);
          expect(users[1].Groups.length).to.be.equal(1);
          expect(users[0].Groups[0].usergroups.userId2).to.be.ok;
          expect(users[0].Groups[0].usergroups.userId2).to.be.equal(users[0].userSecondId);
          expect(users[0].Groups[0].usergroups.groupId2).to.be.ok;
          expect(users[0].Groups[0].usergroups.groupId2).to.be.equal(users[0].Groups[0].groupSecondId);
          expect(users[1].Groups[0].usergroups.userId2).to.be.ok;
          expect(users[1].Groups[0].usergroups.userId2).to.be.equal(users[1].userSecondId);
          expect(users[1].Groups[0].usergroups.groupId2).to.be.ok;
          expect(users[1].Groups[0].usergroups.groupId2).to.be.equal(users[1].Groups[0].groupSecondId);
          
          expect(groups.length).to.be.equal(2);
          expect(groups[0].Users.length).to.be.equal(1);
          expect(groups[1].Users.length).to.be.equal(1);
          expect(groups[0].Users[0].usergroups.groupId2).to.be.ok;
          expect(groups[0].Users[0].usergroups.groupId2).to.be.equal(groups[0].groupSecondId);
          expect(groups[0].Users[0].usergroups.userId2).to.be.ok;
          expect(groups[0].Users[0].usergroups.userId2).to.be.equal(groups[0].Users[0].userSecondId);
          expect(groups[1].Users[0].usergroups.groupId2).to.be.ok;
          expect(groups[1].Users[0].usergroups.groupId2).to.be.equal(groups[1].groupSecondId);
          expect(groups[1].Users[0].usergroups.userId2).to.be.ok;
          expect(groups[1].Users[0].usergroups.userId2).to.be.equal(groups[1].Users[0].userSecondId);
        });
      });
    });

    it('supports non primary key attributes for joins (custom foreignKey, custom through model)', function() {
      const User = this.sequelize.define('User', {
        id: {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4,
          field: 'user_id'
        },
        userSecondId: {
          type: DataTypes.UUID,
          allowNull: false,
          defaultValue: DataTypes.UUIDV4,
          field: 'user_second_id'
        }
      }, {
        tableName: 'tbl_user',
        indexes: [
          {
            unique: true,
            fields: ['user_second_id']
          }
        ]
      });

      const Group = this.sequelize.define('Group', {
        id: {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4,
          field: 'group_id'
        },
        groupSecondId: {
          type: DataTypes.UUID,
          allowNull: false,
          defaultValue: DataTypes.UUIDV4,
          field: 'group_second_id'
        }
      }, {
        tableName: 'tbl_group',
        indexes: [
          {
            unique: true,
            fields: ['group_second_id']
          }
        ]
      });

      const User_has_Group = this.sequelize.define('User_has_Group', {
        userId2: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'user_id2'
        },
        groupId2: {
          type: DataTypes.UUID,
          allowNull: false,
          field: 'group_id2'
        }
      }, {
        tableName: 'tbl_user_has_group',
        indexes: [
          {
            unique: true,
            fields: ['user_id2', 'group_id2']
          }
        ]
      });

      User.belongsToMany(Group, { through: User_has_Group, foreignKey: 'userId2', sourceKey: 'userSecondId' });
      Group.belongsToMany(User, { through: User_has_Group, foreignKey: 'groupId2', sourceKey: 'groupSecondId' });

      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.join(
          User.create(),
          User.create(),
          Group.create(),
          Group.create()
        ).then(([user1, user2, group1, group2]) => {
          return Promise.join(user1.addGroup(group1), user2.addGroup(group2));
        }).then(() => {
          return Promise.join(
            User.findAll({
              where: {},
              include: [Group]
            }),
            Group.findAll({
              include: [User]
            })
          );
        }).then(([users, groups]) => {
          expect(users.length).to.be.equal(2);
          expect(users[0].Groups.length).to.be.equal(1);
          expect(users[1].Groups.length).to.be.equal(1);
          expect(users[0].Groups[0].User_has_Group.userId2).to.be.ok;
          expect(users[0].Groups[0].User_has_Group.userId2).to.be.equal(users[0].userSecondId);
          expect(users[0].Groups[0].User_has_Group.groupId2).to.be.ok;
          expect(users[0].Groups[0].User_has_Group.groupId2).to.be.equal(users[0].Groups[0].groupSecondId);
          expect(users[1].Groups[0].User_has_Group.userId2).to.be.ok;
          expect(users[1].Groups[0].User_has_Group.userId2).to.be.equal(users[1].userSecondId);
          expect(users[1].Groups[0].User_has_Group.groupId2).to.be.ok;
          expect(users[1].Groups[0].User_has_Group.groupId2).to.be.equal(users[1].Groups[0].groupSecondId);
          
          expect(groups.length).to.be.equal(2);
          expect(groups[0].Users.length).to.be.equal(1);
          expect(groups[1].Users.length).to.be.equal(1);
          expect(groups[0].Users[0].User_has_Group.groupId2).to.be.ok;
          expect(groups[0].Users[0].User_has_Group.groupId2).to.be.equal(groups[0].groupSecondId);
          expect(groups[0].Users[0].User_has_Group.userId2).to.be.ok;
          expect(groups[0].Users[0].User_has_Group.userId2).to.be.equal(groups[0].Users[0].userSecondId);
          expect(groups[1].Users[0].User_has_Group.groupId2).to.be.ok;
          expect(groups[1].Users[0].User_has_Group.groupId2).to.be.equal(groups[1].groupSecondId);
          expect(groups[1].Users[0].User_has_Group.userId2).to.be.ok;
          expect(groups[1].Users[0].User_has_Group.userId2).to.be.equal(groups[1].Users[0].userSecondId);
        });
      });
    });

    it('supports primary key attributes with different field names where parent include is required', function() {
      const User = this.sequelize.define('User', {
        id: {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4,
          field: 'user_id'
        }
      }, {
        tableName: 'tbl_user'
      });

      const Company = this.sequelize.define('Company', {
        id: {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4,
          field: 'company_id'
        }
      }, {
        tableName: 'tbl_company'
      });

      const Group = this.sequelize.define('Group', {
        id: {
          type: DataTypes.UUID,
          allowNull: false,
          primaryKey: true,
          defaultValue: DataTypes.UUIDV4,
          field: 'group_id'
        }
      }, {
        tableName: 'tbl_group'
      });

      const Company_has_Group = this.sequelize.define('Company_has_Group', {

      }, {
        tableName: 'tbl_company_has_group'
      });

      User.belongsTo(Company);
      Company.hasMany(User);
      Company.belongsToMany(Group, { through: Company_has_Group });
      Group.belongsToMany(Company, { through: Company_has_Group });

      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.join(
          User.create(),
          Group.create(),
          Company.create()
        ).then(([user, group, company]) => {
          return Promise.join(
            user.setCompany(company),
            company.addGroup(group)
          );
        }).then(() => {
          return Promise.join(
            User.findOne({
              where: {},
              include: [
                { model: Company, include: [Group] }
              ]
            }),
            User.findAll({
              include: [
                { model: Company, include: [Group] }
              ]
            }),
            User.findOne({
              where: {},
              include: [
                { model: Company, required: true, include: [Group] }
              ]
            }),
            User.findAll({
              include: [
                { model: Company, required: true, include: [Group] }
              ]
            })
          );
        });
      });
    });
  });

  describe('hasAssociations', () => {
    beforeEach(function() {
      this.Article = this.sequelize.define('Article', {
        pk: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true
        },
        title: DataTypes.STRING
      });
      this.Label = this.sequelize.define('Label', {
        sk: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true
        },
        text: DataTypes.STRING
      });
      this.ArticleLabel = this.sequelize.define('ArticleLabel');

      this.Article.belongsToMany(this.Label, { through: this.ArticleLabel });
      this.Label.belongsToMany(this.Article, { through: this.ArticleLabel });

      return this.sequelize.sync({ force: true });
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        const ctx = {};
        return Support.prepareTransactionTest(this.sequelize).then(sequelize => {
          ctx.sequelize = sequelize;
          ctx.Article = ctx.sequelize.define('Article', {
            pk: {
              type: DataTypes.INTEGER,
              autoIncrement: true,
              primaryKey: true
            },
            title: DataTypes.STRING
          });
          ctx.Label = ctx.sequelize.define('Label', {
            sk: {
              type: DataTypes.INTEGER,
              autoIncrement: true,
              primaryKey: true
            },
            text: DataTypes.STRING
          });
          ctx.ArticleLabel = ctx.sequelize.define('ArticleLabel');

          ctx.Article.belongsToMany(ctx.Label, { through: ctx.ArticleLabel });
          ctx.Label.belongsToMany(ctx.Article, { through: ctx.ArticleLabel });

          return ctx.sequelize.sync({ force: true });
        }).then(() => {
          return Promise.all([
            ctx.Article.create({ title: 'foo' }),
            ctx.Label.create({ text: 'bar' })
          ]);
        }).then(([article, label]) => {
          ctx.article = article;
          ctx.label = label;
          return ctx.sequelize.transaction();
        }).then(t => {
          ctx.t = t;
          return ctx.article.setLabels([ctx.label], { transaction: t });
        }).then(() => {
          return ctx.Article.findAll({ transaction: ctx.t });
        }).then(articles => {
          return Promise.all([
            articles[0].hasLabels([ctx.label]),
            articles[0].hasLabels([ctx.label], { transaction: ctx.t })
          ]);
        }).then(([hasLabel1, hasLabel2]) => {
          expect(hasLabel1).to.be.false;
          expect(hasLabel2).to.be.true;

          return ctx.t.rollback();
        });
      });
    }

    it('answers false if only some labels have been assigned', function() {
      return Promise.all([
        this.Article.create({ title: 'Article' }),
        this.Label.create({ text: 'Awesomeness' }),
        this.Label.create({ text: 'Epicness' })
      ]).then(([article, label1, label2]) => {
        return article.addLabel(label1).then(() => {
          return article.hasLabels([label1, label2]);
        });
      }).then(result => {
        expect(result).to.be.false;
      });
    });

    it('answers false if only some labels have been assigned when passing a primary key instead of an object', function() {
      return Promise.all([
        this.Article.create({ title: 'Article' }),
        this.Label.create({ text: 'Awesomeness' }),
        this.Label.create({ text: 'Epicness' })
      ]).then(([article, label1, label2]) => {
        return article.addLabels([label1]).then(() => {
          return article.hasLabels([
            label1[this.Label.primaryKeyAttribute],
            label2[this.Label.primaryKeyAttribute]
          ]).then(result => {
            expect(result).to.be.false;
          });
        });
      });
    });

    it('answers true if all label have been assigned', function() {
      return Promise.all([
        this.Article.create({ title: 'Article' }),
        this.Label.create({ text: 'Awesomeness' }),
        this.Label.create({ text: 'Epicness' })
      ]).then(([article, label1, label2]) => {
        return article.setLabels([label1, label2]).then(() => {
          return article.hasLabels([label1, label2]).then(result => {
            expect(result).to.be.true;
          });
        });
      });
    });

    it('answers true if all label have been assigned when passing a primary key instead of an object', function() {
      return Promise.all([
        this.Article.create({ title: 'Article' }),
        this.Label.create({ text: 'Awesomeness' }),
        this.Label.create({ text: 'Epicness' })
      ]).then(([article, label1, label2]) => {
        return article.setLabels([label1, label2]).then(() => {
          return article.hasLabels([
            label1[this.Label.primaryKeyAttribute],
            label2[this.Label.primaryKeyAttribute]
          ]).then(result => {
            expect(result).to.be.true;
          });
        });
      });
    });

    it('answers true for labels that have been assigned multitple times', function() {
      this.ArticleLabel = this.sequelize.define('ArticleLabel', {
        id: {
          primaryKey: true,
          type: DataTypes.INTEGER,
          autoIncrement: true
        },
        relevance: {
          type: DataTypes.DECIMAL,
          validate: {
            min: 0,
            max: 1
          }
        }
      });
      this.Article.belongsToMany(this.Label, { through: { model: this.ArticleLabel, unique: false } });
      this.Label.belongsToMany(this.Article, { through: { model: this.ArticleLabel, unique: false } });

      return this.sequelize.sync({ force: true })
        .then(() => Promise.all([
          this.Article.create({ title: 'Article' }),
          this.Label.create({ text: 'Awesomeness' }),
          this.Label.create({ text: 'Epicness' })
        ]))
        .then(([article, label1, label2]) => Promise.all([
          article,
          label1,
          label2,
          article.addLabel(label1, {
            through: { relevance: 1 }
          }),
          article.addLabel(label2, {
            through: { relevance: .54 }
          }),
          article.addLabel(label2, {
            through: { relevance: .99 }
          })
        ]))
        .then(([article, label1, label2]) => article.hasLabels([label1, label2]))
        .then(result => expect(result).to.be.true);
    });

    it('answers true for labels that have been assigned multitple times when passing a primary key instead of an object', function() {
      this.ArticleLabel = this.sequelize.define('ArticleLabel', {
        id: {
          primaryKey: true,
          type: DataTypes.INTEGER,
          autoIncrement: true
        },
        relevance: {
          type: DataTypes.DECIMAL,
          validate: {
            min: 0,
            max: 1
          }
        }
      });
      this.Article.belongsToMany(this.Label, { through: { model: this.ArticleLabel, unique: false } });
      this.Label.belongsToMany(this.Article, { through: { model: this.ArticleLabel, unique: false } });

      return this.sequelize.sync({ force: true })
        .then(() => Promise.all([
          this.Article.create({ title: 'Article' }),
          this.Label.create({ text: 'Awesomeness' }),
          this.Label.create({ text: 'Epicness' })
        ]))
        .then(([article, label1, label2]) => Promise.all([
          article,
          label1,
          label2,
          article.addLabel(label1, {
            through: { relevance: 1 }
          }),
          article.addLabel(label2, {
            through: { relevance: .54 }
          }),
          article.addLabel(label2, {
            through: { relevance: .99 }
          })
        ]))
        .then(([article, label1, label2]) => article.hasLabels([
          label1[this.Label.primaryKeyAttribute],
          label2[this.Label.primaryKeyAttribute]
        ]))
        .then(result => expect(result).to.be.true);
    });
  });

  describe('hasAssociations with binary key', () => {
    beforeEach(function() {
      const keyDataType = dialect === 'mysql' || dialect === 'mariadb' ? 'BINARY(255)' : DataTypes.BLOB('tiny');
      this.Article = this.sequelize.define('Article', {
        id: {
          type: keyDataType,
          primaryKey: true
        }
      });
      this.Label = this.sequelize.define('Label', {
        id: {
          type: keyDataType,
          primaryKey: true
        }
      });
      this.ArticleLabel = this.sequelize.define('ArticleLabel');

      this.Article.belongsToMany(this.Label, { through: this.ArticleLabel });
      this.Label.belongsToMany(this.Article, { through: this.ArticleLabel });

      return this.sequelize.sync({ force: true });
    });

    it('answers true for labels that have been assigned', function() {
      return Promise.all([
        this.Article.create({
          id: Buffer.alloc(255)
        }),
        this.Label.create({
          id: Buffer.alloc(255)
        })
      ]).then(([article, label]) => Promise.all([
        article,
        label,
        article.addLabel(label, {
          through: 'ArticleLabel'
        })
      ])).then(([article, label]) => article.hasLabels([label]))
        .then(result => expect(result).to.be.true);
    });

    it('answer false for labels that have not been assigned', function() {
      return Promise.all([
        this.Article.create({
          id: Buffer.alloc(255)
        }),
        this.Label.create({
          id: Buffer.alloc(255)
        })
      ]).then(([article, label]) => article.hasLabels([label]))
        .then(result => expect(result).to.be.false);
    });
  });

  describe('countAssociations', () => {
    beforeEach(function() {
      this.User = this.sequelize.define('User', {
        username: DataTypes.STRING
      });
      this.Task = this.sequelize.define('Task', {
        title: DataTypes.STRING,
        active: DataTypes.BOOLEAN
      });
      this.UserTask = this.sequelize.define('UserTask', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true
        },
        started: {
          type: DataTypes.BOOLEAN,
          defaultValue: false
        }
      });

      this.User.belongsToMany(this.Task, { through: this.UserTask });
      this.Task.belongsToMany(this.User, { through: this.UserTask });

      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.all([
          this.User.create({ username: 'John' }),
          this.Task.create({ title: 'Get rich', active: true }),
          this.Task.create({ title: 'Die trying', active: false })
        ]);
      }).then(([john, task1, task2]) => {
        this.tasks = [task1, task2];
        this.user = john;
        return john.setTasks([task1, task2]);
      });
    });

    it('should count all associations', function() {
      return expect(this.user.countTasks({})).to.eventually.equal(2);
    });

    it('should count filtered associations', function() {
      return expect(this.user.countTasks({
        where: {
          active: true
        }
      })).to.eventually.equal(1);
    });

    it('should count scoped associations', function() {
      this.User.belongsToMany(this.Task, {
        as: 'activeTasks',
        through: this.UserTask,
        scope: {
          active: true
        }
      });

      return expect(this.user.countActiveTasks({})).to.eventually.equal(1);
    });

    it('should count scoped through associations', function() {
      const user = this.user;

      this.User.belongsToMany(this.Task, {
        as: 'startedTasks',
        through: {
          model: this.UserTask,
          scope: {
            started: true
          }
        }
      });

      return Promise.join(
        this.Task.create().then(task => {
          return user.addTask(task, {
            through: { started: true }
          });
        }),
        this.Task.create().then(task => {
          return user.addTask(task, {
            through: { started: true }
          });
        })
      ).then(() => {
        return expect(user.countStartedTasks({})).to.eventually.equal(2);
      });
    });
  });

  describe('setAssociations', () => {
    it('clears associations when passing null to the set-method', function() {
      const User = this.sequelize.define('User', { username: DataTypes.STRING }),
        Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      User.belongsToMany(Task, { through: 'UserTasks' });
      Task.belongsToMany(User, { through: 'UserTasks' });

      const ctx = {};
      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.all([
          User.create({ username: 'foo' }),
          Task.create({ title: 'task' })
        ]);
      }).then(([user, task]) => {
        ctx.task = task;
        return task.setUsers([user]);
      }).then(() => {
        return ctx.task.getUsers();
      }).then(_users => {
        expect(_users).to.have.length(1);

        return ctx.task.setUsers(null);
      }).then(() => {
        return ctx.task.getUsers();
      }).then(_users => {
        expect(_users).to.have.length(0);
      });
    });

    it('should be able to set twice with custom primary keys', function() {
      const User = this.sequelize.define('User', { uid: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true }, username: DataTypes.STRING }),
        Task = this.sequelize.define('Task', { tid: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true }, title: DataTypes.STRING });

      User.belongsToMany(Task, { through: 'UserTasks' });
      Task.belongsToMany(User, { through: 'UserTasks' });

      const ctx = {};
      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.all([
          User.create({ username: 'foo' }),
          User.create({ username: 'bar' }),
          Task.create({ title: 'task' })
        ]);
      }).then(([user1, user2, task]) => {
        ctx.task = task;
        ctx.user1 = user1;
        ctx.user2 = user2;
        return task.setUsers([user1]);
      }).then(() => {
        ctx.user2.user_has_task = { usertitle: 'Something' };
        return ctx.task.setUsers([ctx.user1, ctx.user2]);
      }).then(() => {
        return ctx.task.getUsers();
      }).then(_users => {
        expect(_users).to.have.length(2);
      });
    });

    it('joins an association with custom primary keys', function() {
      const Group = this.sequelize.define('group', {
          group_id: { type: DataTypes.INTEGER, primaryKey: true },
          name: DataTypes.STRING(64)
        }),
        Member = this.sequelize.define('member', {
          member_id: { type: DataTypes.INTEGER, primaryKey: true },
          email: DataTypes.STRING(64)
        });

      Group.belongsToMany(Member, { through: 'group_members', foreignKey: 'group_id', otherKey: 'member_id' });
      Member.belongsToMany(Group, { through: 'group_members', foreignKey: 'member_id', otherKey: 'group_id' });

      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.all([
          Group.create({ group_id: 1, name: 'Group1' }),
          Member.create({ member_id: 10, email: 'team@sequelizejs.com' })
        ]);
      }).then(([group, member]) => {
        return group.addMember(member).return(group);
      }).then(group => {
        return group.getMembers();
      }).then(members => {
        expect(members).to.be.instanceof(Array);
        expect(members).to.have.length(1);
        expect(members[0].member_id).to.equal(10);
        expect(members[0].email).to.equal('team@sequelizejs.com');
      });
    });

    it('supports passing the primary key instead of an object', function() {
      const User = this.sequelize.define('User', { username: DataTypes.STRING }),
        Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      User.belongsToMany(Task, { through: 'UserTasks' });
      Task.belongsToMany(User, { through: 'UserTasks' });

      const ctx = {};
      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.all([
          User.create({ id: 12 }),
          Task.create({ id: 50, title: 'get started' }),
          Task.create({ id: 5, title: 'wat' })
        ]);
      }).then(([user, task1, task2]) => {
        ctx.user = user;
        ctx.task2 = task2;
        return user.addTask(task1.id);
      }).then(() => {
        return ctx.user.setTasks([ctx.task2.id]);
      }).then(() => {
        return ctx.user.getTasks();
      }).then(tasks => {
        expect(tasks).to.have.length(1);
        expect(tasks[0].title).to.equal('wat');
      });
    });

    it('using scope to set associations', function() {
      const ItemTag = this.sequelize.define('ItemTag', {
          id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          tag_id: { type: DataTypes.INTEGER, unique: false },
          taggable: { type: DataTypes.STRING },
          taggable_id: { type: DataTypes.INTEGER, unique: false }
        }),
        Tag = this.sequelize.define('Tag', {
          id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          name: DataTypes.STRING
        }),
        Comment = this.sequelize.define('Comment', {
          id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          name: DataTypes.STRING
        }),
        Post = this.sequelize.define('Post', {
          id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          name: DataTypes.STRING
        });

      Post.belongsToMany(Tag, {
        through: { model: ItemTag, unique: false, scope: { taggable: 'post' } },
        foreignKey: 'taggable_id'
      });

      Comment.belongsToMany(Tag, {
        through: { model: ItemTag, unique: false, scope: { taggable: 'comment' } },
        foreignKey: 'taggable_id'
      });

      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.all([
          Post.create({ name: 'post1' }),
          Comment.create({ name: 'comment1' }),
          Tag.create({ name: 'tag1' })
        ]);
      }).then(([post, comment, tag]) => {
        this.post = post;
        this.comment = comment;
        this.tag = tag;
        return this.post.setTags([this.tag]);
      }).then(() => {
        return this.comment.setTags([this.tag]);
      }).then(() => {
        return Promise.all([
          this.post.getTags(),
          this.comment.getTags()
        ]);
      }).then(([postTags, commentTags]) => {
        expect(postTags).to.have.length(1);
        expect(commentTags).to.have.length(1);
      });
    });

    it('updating association via set associations with scope', function() {
      const ItemTag = this.sequelize.define('ItemTag', {
          id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          tag_id: { type: DataTypes.INTEGER, unique: false },
          taggable: { type: DataTypes.STRING },
          taggable_id: { type: DataTypes.INTEGER, unique: false }
        }),
        Tag = this.sequelize.define('Tag', {
          id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          name: DataTypes.STRING
        }),
        Comment = this.sequelize.define('Comment', {
          id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          name: DataTypes.STRING
        }),
        Post = this.sequelize.define('Post', {
          id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
          name: DataTypes.STRING
        });

      Post.belongsToMany(Tag, {
        through: { model: ItemTag, unique: false, scope: { taggable: 'post' } },
        foreignKey: 'taggable_id'
      });

      Comment.belongsToMany(Tag, {
        through: { model: ItemTag, unique: false, scope: { taggable: 'comment' } },
        foreignKey: 'taggable_id'
      });

      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.all([
          Post.create({ name: 'post1' }),
          Comment.create({ name: 'comment1' }),
          Tag.create({ name: 'tag1' }),
          Tag.create({ name: 'tag2' })
        ]);
      }).then(([post, comment, tag, secondTag]) => {
        this.post = post;
        this.comment = comment;
        this.tag = tag;
        this.secondTag = secondTag;
        return this.post.setTags([this.tag, this.secondTag]);
      }).then(() => {
        return this.comment.setTags([this.tag, this.secondTag]);
      }).then(() => {
        return this.post.setTags([this.tag]);
      }).then(() => {
        return Promise.all([
          this.post.getTags(),
          this.comment.getTags()
        ]);
      }).then(([postTags, commentTags]) => {
        expect(postTags).to.have.length(1);
        expect(commentTags).to.have.length(2);
      });
    });

    it('should catch EmptyResultError when rejectOnEmpty is set', function() {
      const User = this.sequelize.define(
        'User',
        { username: DataTypes.STRING },
        { rejectOnEmpty: true }
      );
      const Task = this.sequelize.define(
        'Task',
        { title: DataTypes.STRING }
      );

      User.belongsToMany(Task, { through: 'UserTasks' });
      Task.belongsToMany(User, { through: 'UserTasks' });

      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.all([
          User.create({ id: 12 }),
          Task.create({ id: 50, title: 'get started' }),
          Task.create({ id: 51, title: 'following up' })
        ]);
      }).then(([user, task1, task2]) => {
        return user.setTasks([task1, task2]).return(user);
      }).then(user => {
        return user.getTasks();
      }).then(userTasks => {
        expect(userTasks).to.be.an('array').that.has.a.lengthOf(2);
        expect(userTasks[0]).to.be.an.instanceOf(Task);
      });
    });
  });

  describe('createAssociations', () => {
    it('creates a new associated object', function() {
      const User = this.sequelize.define('User', { username: DataTypes.STRING }),
        Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      User.belongsToMany(Task, { through: 'UserTasks' });
      Task.belongsToMany(User, { through: 'UserTasks' });

      const ctx = {};
      return this.sequelize.sync({ force: true }).then(() => {
        return Task.create({ title: 'task' });
      }).then(task => {
        ctx.task = task;
        return task.createUser({ username: 'foo' });
      }).then(createdUser => {
        expect(createdUser).to.be.instanceof(User);
        expect(createdUser.username).to.equal('foo');
        return ctx.task.getUsers();
      }).then(_users => {
        expect(_users).to.have.length(1);
      });
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        const ctx = {};
        return Support.prepareTransactionTest(this.sequelize).then(sequelize => {
          ctx.User = sequelize.define('User', { username: DataTypes.STRING });
          ctx.Task = sequelize.define('Task', { title: DataTypes.STRING });

          ctx.User.belongsToMany(ctx.Task, { through: 'UserTasks' });
          ctx.Task.belongsToMany(ctx.User, { through: 'UserTasks' });

          ctx.sequelize = sequelize;
          return sequelize.sync({ force: true });
        }).then(() => {
          return Promise.all([
            ctx.Task.create({ title: 'task' }),
            ctx.sequelize.transaction()
          ]);
        }).then(([task, t]) => {
          ctx.task = task;
          ctx.t = t;
          return task.createUser({ username: 'foo' }, { transaction: t });
        }).then(() => {
          return ctx.task.getUsers();
        }).then(users => {
          expect(users).to.have.length(0);

          return ctx.task.getUsers({ transaction: ctx.t });
        }).then(users => {
          expect(users).to.have.length(1);
          return ctx.t.rollback();
        });
      });
    }

    it('supports setting through table attributes', function() {
      const User = this.sequelize.define('user', {}),
        Group = this.sequelize.define('group', {}),
        UserGroups = this.sequelize.define('user_groups', {
          isAdmin: Sequelize.BOOLEAN
        });

      User.belongsToMany(Group, { through: UserGroups });
      Group.belongsToMany(User, { through: UserGroups });

      return this.sequelize.sync({ force: true }).then(() => {
        return Group.create({});
      }).then(group => {
        return Promise.join(
          group.createUser({ id: 1 }, { through: { isAdmin: true } }),
          group.createUser({ id: 2 }, { through: { isAdmin: false } }),
          () => {
            return UserGroups.findAll();
          }
        );
      }).then(userGroups => {
        userGroups.sort((a, b) => {
          return a.userId < b.userId ? - 1 : 1;
        });
        expect(userGroups[0].userId).to.equal(1);
        expect(userGroups[0].isAdmin).to.be.ok;
        expect(userGroups[1].userId).to.equal(2);
        expect(userGroups[1].isAdmin).not.to.be.ok;
      });
    });

    it('supports using the field parameter', function() {
      const User = this.sequelize.define('User', { username: DataTypes.STRING }),
        Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      User.belongsToMany(Task, { through: 'UserTasks' });
      Task.belongsToMany(User, { through: 'UserTasks' });

      const ctx = {};
      return this.sequelize.sync({ force: true }).then(() => {
        return Task.create({ title: 'task' });
      }).then(task => {
        ctx.task = task;
        return task.createUser({ username: 'foo' }, { fields: ['username'] });
      }).then(createdUser => {
        expect(createdUser).to.be.instanceof(User);
        expect(createdUser.username).to.equal('foo');
        return ctx.task.getUsers();
      }).then(_users => {
        expect(_users).to.have.length(1);
      });
    });
  });

  describe('addAssociations', () => {
    it('supports both single instance and array', function() {
      const User = this.sequelize.define('User', { username: DataTypes.STRING }),
        Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      User.belongsToMany(Task, { through: 'UserTasks' });
      Task.belongsToMany(User, { through: 'UserTasks' });

      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.all([
          User.create({ id: 12 }),
          Task.create({ id: 50, title: 'get started' }),
          Task.create({ id: 52, title: 'get done' })
        ]);
      }).then(([user, task1, task2]) => {
        return Promise.all([
          user.addTask(task1),
          user.addTask([task2])
        ]).return(user);
      }).then(user => {
        return user.getTasks();
      }).then(tasks => {
        expect(tasks).to.have.length(2);
        expect(tasks.find(item => item.title === 'get started')).to.be.ok;
        expect(tasks.find(item => item.title === 'get done')).to.be.ok;
      });
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', function() {
        const ctx = {};
        return Support.prepareTransactionTest(this.sequelize).then(sequelize => {
          ctx.User = sequelize.define('User', { username: DataTypes.STRING });
          ctx.Task = sequelize.define('Task', { title: DataTypes.STRING });

          ctx.User.belongsToMany(ctx.Task, { through: 'UserTasks' });
          ctx.Task.belongsToMany(ctx.User, { through: 'UserTasks' });

          ctx.sequelize = sequelize;
          return sequelize.sync({ force: true });
        }).then(() => {
          return Promise.all([
            ctx.User.create({ username: 'foo' }),
            ctx.Task.create({ title: 'task' }),
            ctx.sequelize.transaction()
          ]);
        }).then(([user, task, t]) => {
          ctx.task = task;
          ctx.user = user;
          ctx.t = t;
          return task.addUser(user, { transaction: t });
        }).then(() => {
          return ctx.task.hasUser(ctx.user);
        }).then(hasUser => {
          expect(hasUser).to.be.false;
          return ctx.task.hasUser(ctx.user, { transaction: ctx.t });
        }).then(hasUser => {
          expect(hasUser).to.be.true;
          return ctx.t.rollback();
        });
      });

      it('supports transactions when updating a through model', function() {
        const ctx = {};
        return Support.prepareTransactionTest(this.sequelize).then(sequelize => {
          ctx.User = sequelize.define('User', { username: DataTypes.STRING });
          ctx.Task = sequelize.define('Task', { title: DataTypes.STRING });

          ctx.UserTask = sequelize.define('UserTask', {
            status: Sequelize.STRING
          });

          ctx.User.belongsToMany(ctx.Task, { through: ctx.UserTask });
          ctx.Task.belongsToMany(ctx.User, { through: ctx.UserTask });
          ctx.sequelize = sequelize;
          return sequelize.sync({ force: true });
        }).then(() => {
          return Promise.all([
            ctx.User.create({ username: 'foo' }),
            ctx.Task.create({ title: 'task' }),
            ctx.sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED })
          ]);
        }).then(([user, task, t]) => {
          ctx.task = task;
          ctx.user = user;
          ctx.t = t;
          return task.addUser(user, { through: { status: 'pending' } }); // Create without transaction, so the old value is accesible from outside the transaction
        }).then(() => {
          return ctx.task.addUser(ctx.user, { transaction: ctx.t, through: { status: 'completed' } }); // Add an already exisiting user in a transaction, updating a value in the join table
        }).then(() => {
          return Promise.all([
            ctx.user.getTasks(),
            ctx.user.getTasks({ transaction: ctx.t })
          ]);
        }).then(([tasks, transactionTasks]) => {
          expect(tasks[0].UserTask.status).to.equal('pending');
          expect(transactionTasks[0].UserTask.status).to.equal('completed');

          return ctx.t.rollback();
        });
      });
    }

    it('supports passing the primary key instead of an object', function() {
      const User = this.sequelize.define('User', { username: DataTypes.STRING }),
        Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      User.belongsToMany(Task, { through: 'UserTasks' });
      Task.belongsToMany(User, { through: 'UserTasks' });

      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.all([
          User.create({ id: 12 }),
          Task.create({ id: 50, title: 'get started' })
        ]);
      }).then(([user, task]) => {
        return user.addTask(task.id).return(user);
      }).then(user => {
        return user.getTasks();
      }).then(tasks => {
        expect(tasks[0].title).to.equal('get started');
      });
    });


    it('should not pass indexes to the join table', function() {
      const User = this.sequelize.define(
        'User',
        { username: DataTypes.STRING },
        {
          indexes: [
            {
              name: 'username_unique',
              unique: true,
              method: 'BTREE',
              fields: ['username']
            }
          ]
        });
      const Task = this.sequelize.define(
        'Task',
        { title: DataTypes.STRING },
        {
          indexes: [
            {
              name: 'title_index',
              method: 'BTREE',
              fields: ['title']
            }
          ]
        });
      //create associations
      User.belongsToMany(Task, { through: 'UserTasks' });
      Task.belongsToMany(User, { through: 'UserTasks' });
      return this.sequelize.sync({ force: true });
    });

    it('should catch EmptyResultError when rejectOnEmpty is set', function() {
      const User = this.sequelize.define(
        'User',
        { username: DataTypes.STRING },
        { rejectOnEmpty: true }
      );
      const Task = this.sequelize.define(
        'Task',
        { title: DataTypes.STRING }
      );

      User.belongsToMany(Task, { through: 'UserTasks' });
      Task.belongsToMany(User, { through: 'UserTasks' });

      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.all([
          User.create({ id: 12 }),
          Task.create({ id: 50, title: 'get started' })
        ]);
      }).then(([user, task]) => {
        return user.addTask(task).return(user);
      }).then(user => {
        return user.getTasks();
      }).then(tasks => {
        expect(tasks[0].title).to.equal('get started');
      });
    });

    it('should returns array of intermediate table', function() {
      const User = this.sequelize.define('User');
      const Task = this.sequelize.define('Task');
      const UserTask = this.sequelize.define('UserTask');

      User.belongsToMany(Task, { through: UserTask });
      Task.belongsToMany(User, { through: UserTask });

      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.all([
          User.create(),
          Task.create()
        ]).then(([user, task]) => {
          return user.addTask(task);
        }).then(userTasks => {
          expect(userTasks).to.be.an('array').that.has.a.lengthOf(1);
          expect(userTasks[0]).to.be.an.instanceOf(UserTask);
        });
      });
    });
  });

  describe('addMultipleAssociations', () => {
    it('supports both single instance and array', function() {
      const User = this.sequelize.define('User', { username: DataTypes.STRING }),
        Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      User.belongsToMany(Task, { through: 'UserTasks' });
      Task.belongsToMany(User, { through: 'UserTasks' });

      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.all([
          User.create({ id: 12 }),
          Task.create({ id: 50, title: 'get started' }),
          Task.create({ id: 52, title: 'get done' })
        ]);
      }).then(([user, task1, task2]) => {
        return Promise.all([
          user.addTasks(task1),
          user.addTasks([task2])
        ]).return(user);
      }).then(user => {
        return user.getTasks();
      }).then(tasks => {
        expect(tasks).to.have.length(2);
        expect(tasks.some(item => { return item.title === 'get started'; })).to.be.ok;
        expect(tasks.some(item => { return item.title === 'get done'; })).to.be.ok;
      });
    });

    it('adds associations without removing the current ones', function() {
      const User = this.sequelize.define('User', { username: DataTypes.STRING }),
        Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      User.belongsToMany(Task, { through: 'UserTasks' });
      Task.belongsToMany(User, { through: 'UserTasks' });

      const ctx = {};
      return this.sequelize.sync({ force: true }).then(() => {
        return User.bulkCreate([
          { username: 'foo ' },
          { username: 'bar ' },
          { username: 'baz ' }
        ]).then(() => {
          return Promise.all([
            Task.create({ title: 'task' }),
            User.findAll()
          ]);
        }).then(([task, users]) => {
          ctx.task = task;
          ctx.users = users;
          return task.setUsers([users[0]]);
        }).then(() => {
          return ctx.task.addUsers([ctx.users[1], ctx.users[2]]);
        }).then(() => {
          return ctx.task.getUsers();
        }).then(users => {
          expect(users).to.have.length(3);

          // Re-add user 0's object, this should be harmless
          // Re-add user 0's id, this should be harmless
          return Promise.all([
            expect(ctx.task.addUsers([ctx.users[0]])).not.to.be.rejected,
            expect(ctx.task.addUsers([ctx.users[0].id])).not.to.be.rejected
          ]);
        }).then(() => {
          return ctx.task.getUsers();
        }).then(users => {
          expect(users).to.have.length(3);
        });
      });
    });
  });

  describe('through model validations', () => {
    beforeEach(function() {
      const Project = this.sequelize.define('Project', {
        name: Sequelize.STRING
      });

      const Employee = this.sequelize.define('Employee', {
        name: Sequelize.STRING
      });

      const Participation = this.sequelize.define('Participation', {
        role: {
          type: Sequelize.STRING,
          allowNull: false,
          validate: {
            len: {
              args: [2, 50],
              msg: 'too bad'
            }
          }
        }
      });

      Project.belongsToMany(Employee, { as: 'Participants', through: Participation });
      Employee.belongsToMany(Project, { as: 'Participations', through: Participation });

      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.all([
          Project.create({ name: 'project 1' }),
          Employee.create({ name: 'employee 1' })
        ]).then(([project, employee]) => {
          this.project = project;
          this.employee = employee;
        });
      });
    });

    it('runs on add', function() {
      return expect(this.project.addParticipant(this.employee, { through: { role: '' } })).to.be.rejected;
    });

    it('runs on set', function() {
      return expect(this.project.setParticipants([this.employee], { through: { role: '' } })).to.be.rejected;
    });

    it('runs on create', function() {
      return expect(this.project.createParticipant({ name: 'employee 2' }, { through: { role: '' } })).to.be.rejected;
    });
  });

  describe('optimizations using bulk create, destroy and update', () => {
    beforeEach(function() {
      this.User = this.sequelize.define('User', { username: DataTypes.STRING }, { timestamps: false });
      this.Task = this.sequelize.define('Task', { title: DataTypes.STRING }, { timestamps: false });

      this.User.belongsToMany(this.Task, { through: 'UserTasks' });
      this.Task.belongsToMany(this.User, { through: 'UserTasks' });

      return this.sequelize.sync({ force: true });
    });

    it('uses one insert into statement', function() {
      const spy = sinon.spy();

      return Promise.all([
        this.User.create({ username: 'foo' }),
        this.Task.create({ id: 12, title: 'task1' }),
        this.Task.create({ id: 15, title: 'task2' })
      ]).then(([user, task1, task2]) => {
        return user.setTasks([task1, task2], {
          logging: spy
        });
      }).then(() => {
        expect(spy.calledTwice).to.be.ok;
      });
    });

    it('uses one delete from statement', function() {
      const spy = sinon.spy();

      return Promise.all([
        this.User.create({ username: 'foo' }),
        this.Task.create({ title: 'task1' }),
        this.Task.create({ title: 'task2' })
      ]).then(([user, task1, task2]) => {
        return user.setTasks([task1, task2]).return(user);
      }).then(user => {
        return user.setTasks(null, {
          logging: spy
        });
      }).then(() => {
        expect(spy.calledTwice).to.be.ok;
      });
    });
  }); // end optimization using bulk create, destroy and update

  describe('join table creation', () => {
    beforeEach(function() {
      this.User = this.sequelize.define('User',
        { username: DataTypes.STRING },
        { tableName: 'users' }
      );
      this.Task = this.sequelize.define('Task',
        { title: DataTypes.STRING },
        { tableName: 'tasks' }
      );

      this.User.belongsToMany(this.Task, { through: 'user_has_tasks' });
      this.Task.belongsToMany(this.User, { through: 'user_has_tasks' });

      return this.sequelize.sync({ force: true });
    });

    it('should work with non integer primary keys', function() {
      const Beacons = this.sequelize.define('Beacon', {
        id: {
          primaryKey: true,
          type: DataTypes.UUID,
          defaultValue: DataTypes.UUIDV4
        },
        name: {
          type: DataTypes.STRING
        }
      });

      // User not to clash with the beforeEach definition
      const Users = this.sequelize.define('Usar', {
        name: {
          type: DataTypes.STRING
        }
      });

      Beacons.belongsToMany(Users, { through: 'UserBeacons' });
      Users.belongsToMany(Beacons, { through: 'UserBeacons' });

      return this.sequelize.sync({ force: true });
    });

    it('makes join table non-paranoid by default', () => {
      const paranoidSequelize = Support.createSequelizeInstance({
          define: {
            paranoid: true
          }
        }),
        ParanoidUser = paranoidSequelize.define('ParanoidUser', {}),
        ParanoidTask = paranoidSequelize.define('ParanoidTask', {});

      ParanoidUser.belongsToMany(ParanoidTask, { through: 'UserTasks' });
      ParanoidTask.belongsToMany(ParanoidUser, { through: 'UserTasks' });

      expect(ParanoidUser.options.paranoid).to.be.ok;
      expect(ParanoidTask.options.paranoid).to.be.ok;

      _.forEach(ParanoidUser.associations, association => {
        expect(association.through.model.options.paranoid).not.to.be.ok;
      });
    });
  });

  describe('foreign keys', () => {
    it('should correctly generate underscored keys', function() {
      const User = this.sequelize.define('User', {

      }, {
        tableName: 'users',
        underscored: true,
        timestamps: false
      });

      const Place = this.sequelize.define('Place', {
        //fields
      }, {
        tableName: 'places',
        underscored: true,
        timestamps: false
      });

      User.belongsToMany(Place, { through: 'user_places' });
      Place.belongsToMany(User, { through: 'user_places' });

      const attributes = this.sequelize.model('user_places').rawAttributes;

      expect(attributes.PlaceId.field).to.equal('place_id');
      expect(attributes.UserId.field).to.equal('user_id');
    });

    it('should infer otherKey from paired BTM relationship with a through string defined', function() {
      const User = this.sequelize.define('User', {});
      const Place = this.sequelize.define('Place', {});

      const Places = User.belongsToMany(Place, { through: 'user_places', foreignKey: 'user_id' });
      const Users = Place.belongsToMany(User, { through: 'user_places', foreignKey: 'place_id' });

      expect(Places.foreignKey).to.equal('user_id');
      expect(Users.foreignKey).to.equal('place_id');

      expect(Places.otherKey).to.equal('place_id');
      expect(Users.otherKey).to.equal('user_id');
    });

    it('should infer otherKey from paired BTM relationship with a through model defined', function() {
      const User = this.sequelize.define('User', {});
      const Place = this.sequelize.define('Place', {});
      const UserPlace = this.sequelize.define('UserPlace', { id: { primaryKey: true, type: DataTypes.INTEGER, autoIncrement: true } }, { timestamps: false });

      const Places = User.belongsToMany(Place, { through: UserPlace, foreignKey: 'user_id' });
      const Users = Place.belongsToMany(User, { through: UserPlace, foreignKey: 'place_id' });

      expect(Places.foreignKey).to.equal('user_id');
      expect(Users.foreignKey).to.equal('place_id');

      expect(Places.otherKey).to.equal('place_id');
      expect(Users.otherKey).to.equal('user_id');

      expect(Object.keys(UserPlace.rawAttributes).length).to.equal(3); // Defined primary key and two foreign keys
    });
  });

  describe('foreign key with fields specified', () => {
    beforeEach(function() {
      this.User = this.sequelize.define('User', { name: DataTypes.STRING });
      this.Project = this.sequelize.define('Project', { name: DataTypes.STRING });
      this.Puppy = this.sequelize.define('Puppy', { breed: DataTypes.STRING });

      // doubly linked has many
      this.User.belongsToMany(this.Project, {
        through: 'user_projects',
        as: 'Projects',
        foreignKey: {
          field: 'user_id',
          name: 'userId'
        },
        otherKey: {
          field: 'project_id',
          name: 'projectId'
        }
      });
      this.Project.belongsToMany(this.User, {
        through: 'user_projects',
        as: 'Users',
        foreignKey: {
          field: 'project_id',
          name: 'projectId'
        },
        otherKey: {
          field: 'user_id',
          name: 'userId'
        }
      });
    });

    it('should correctly get associations even after a child instance is deleted', function() {
      const spy = sinon.spy();

      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.join(
          this.User.create({ name: 'Matt' }),
          this.Project.create({ name: 'Good Will Hunting' }),
          this.Project.create({ name: 'The Departed' })
        );
      }).then(([user, project1, project2]) => {
        return user.addProjects([project1, project2], {
          logging: spy
        }).return(user);
      }).then(user => {
        expect(spy).to.have.been.calledTwice;
        spy.resetHistory();
        return Promise.join(
          user,
          user.getProjects({
            logging: spy
          })
        );
      }).then(([user, projects]) => {
        expect(spy.calledOnce).to.be.ok;
        const project = projects[0];
        expect(project).to.be.ok;
        return project.destroy().return(user);
      }).then(user => {
        return this.User.findOne({
          where: { id: user.id },
          include: [{ model: this.Project, as: 'Projects' }]
        });
      }).then(user => {
        const projects = user.Projects,
          project = projects[0];

        expect(project).to.be.ok;
      });
    });

    it('should correctly get associations when doubly linked', function() {
      const spy = sinon.spy();
      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.all([
          this.User.create({ name: 'Matt' }),
          this.Project.create({ name: 'Good Will Hunting' })
        ]);
      }).then(([user, project]) => {
        this.user = user;
        this.project = project;
        return user.addProject(project, { logging: spy }).return(user);
      }).then(user => {
        expect(spy.calledTwice).to.be.ok; // Once for SELECT, once for INSERT
        spy.resetHistory();
        return user.getProjects({
          logging: spy
        });
      }).then(projects => {
        const project = projects[0];
        expect(spy.calledOnce).to.be.ok;
        spy.resetHistory();

        expect(project).to.be.ok;
        return this.user.removeProject(project, {
          logging: spy
        }).return(project);
      }).then(() => {
        expect(spy).to.have.been.calledOnce;
      });
    });

    it('should be able to handle nested includes properly', function() {
      this.Group = this.sequelize.define('Group', { groupName: DataTypes.STRING });

      this.Group.belongsToMany(this.User, {
        through: 'group_users',
        as: 'Users',
        foreignKey: {
          field: 'group_id',
          name: 'groupId'
        },
        otherKey: {
          field: 'user_id',
          name: 'userId'
        }
      });
      this.User.belongsToMany(this.Group, {
        through: 'group_users',
        as: 'Groups',
        foreignKey: {
          field: 'user_id',
          name: 'userId'
        },
        otherKey: {
          field: 'group_id',
          name: 'groupId'
        }
      });

      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.join(
          this.Group.create({ groupName: 'The Illuminati' }),
          this.User.create({ name: 'Matt' }),
          this.Project.create({ name: 'Good Will Hunting' })
        );
      }).then(([group, user, project]) => {
        return user.addProject(project).then(() => {
          return group.addUser(user).return(group);
        });
      }).then(group => {
        // get the group and include both the users in the group and their project's
        return this.Group.findAll({
          where: { id: group.id },
          include: [
            {
              model: this.User,
              as: 'Users',
              include: [
                { model: this.Project, as: 'Projects' }
              ]
            }
          ]
        });
      }).then(groups => {
        const group = groups[0];
        expect(group).to.be.ok;

        const user = group.Users[0];
        expect(user).to.be.ok;

        const project = user.Projects[0];
        expect(project).to.be.ok;
        expect(project.name).to.equal('Good Will Hunting');
      });
    });
  });

  describe('primary key handling for join table', () => {
    beforeEach(function() {
      this.User = this.sequelize.define('User',
        { username: DataTypes.STRING },
        { tableName: 'users' }
      );
      this.Task = this.sequelize.define('Task',
        { title: DataTypes.STRING },
        { tableName: 'tasks' }
      );
    });

    it('removes the primary key if it was added by sequelize', function() {
      this.UserTasks = this.sequelize.define('usertasks', {});

      this.User.belongsToMany(this.Task, { through: this.UserTasks });
      this.Task.belongsToMany(this.User, { through: this.UserTasks });

      expect(Object.keys(this.UserTasks.primaryKeys).sort()).to.deep.equal(['TaskId', 'UserId']);
    });

    it('keeps the primary key if it was added by the user', function() {
      let fk;

      this.UserTasks = this.sequelize.define('usertasks', {
        id: {
          type: Sequelize.INTEGER,
          autoincrement: true,
          primaryKey: true
        }
      });
      this.UserTasks2 = this.sequelize.define('usertasks2', {
        userTasksId: {
          type: Sequelize.INTEGER,
          autoincrement: true,
          primaryKey: true
        }
      });

      this.User.belongsToMany(this.Task, { through: this.UserTasks });
      this.Task.belongsToMany(this.User, { through: this.UserTasks });

      this.User.belongsToMany(this.Task, { through: this.UserTasks2 });
      this.Task.belongsToMany(this.User, { through: this.UserTasks2 });

      expect(Object.keys(this.UserTasks.primaryKeys)).to.deep.equal(['id']);
      expect(Object.keys(this.UserTasks2.primaryKeys)).to.deep.equal(['userTasksId']);

      [this.UserTasks, this.UserTasks2].forEach(model => {
        fk = Object.keys(model.uniqueKeys)[0];
        expect(model.uniqueKeys[fk].fields.sort()).to.deep.equal(['TaskId', 'UserId']);
      });
    });

    describe('without sync', () => {
      beforeEach(function() {
        return this.sequelize.queryInterface.createTable('users', { id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true }, username: DataTypes.STRING, createdAt: DataTypes.DATE, updatedAt: DataTypes.DATE }).then(() => {
          return this.sequelize.queryInterface.createTable('tasks', { id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true }, title: DataTypes.STRING, createdAt: DataTypes.DATE, updatedAt: DataTypes.DATE });
        }).then(() => {
          return this.sequelize.queryInterface.createTable('users_tasks', { TaskId: DataTypes.INTEGER, UserId: DataTypes.INTEGER, createdAt: DataTypes.DATE, updatedAt: DataTypes.DATE });
        });
      });

      it('removes all associations', function() {
        this.UsersTasks = this.sequelize.define('UsersTasks', {}, { tableName: 'users_tasks' });

        this.User.belongsToMany(this.Task, { through: this.UsersTasks });
        this.Task.belongsToMany(this.User, { through: this.UsersTasks });

        expect(Object.keys(this.UsersTasks.primaryKeys).sort()).to.deep.equal(['TaskId', 'UserId']);

        return Promise.all([
          this.User.create({ username: 'foo' }),
          this.Task.create({ title: 'foo' })
        ]).then(([user, task]) => {
          return user.addTask(task).return(user);
        }).then(user => {
          return user.setTasks(null);
        }).then(result => {
          expect(result).to.be.ok;
        });
      });
    });
  });

  describe('through', () => {
    beforeEach(function() {
      this.User = this.sequelize.define('User', {});
      this.Project = this.sequelize.define('Project', {});
      this.UserProjects = this.sequelize.define('UserProjects', {
        status: DataTypes.STRING,
        data: DataTypes.INTEGER
      });

      this.User.belongsToMany(this.Project, { through: this.UserProjects });
      this.Project.belongsToMany(this.User, { through: this.UserProjects });

      return this.sequelize.sync();
    });

    describe('fetching from join table', () => {
      it('should contain the data from the join table on .UserProjects a DAO', function() {
        return Promise.all([
          this.User.create(),
          this.Project.create()
        ]).then(([user, project]) => {
          return user.addProject(project, { through: { status: 'active', data: 42 } }).return(user);
        }).then(user => {
          return user.getProjects();
        }).then(projects => {
          const project = projects[0];

          expect(project.UserProjects).to.be.ok;
          expect(project.status).not.to.exist;
          expect(project.UserProjects.status).to.equal('active');
          expect(project.UserProjects.data).to.equal(42);
        });
      });

      it('should be able to limit the join table attributes returned', function() {
        return Promise.all([
          this.User.create(),
          this.Project.create()
        ]).then(([user, project]) => {
          return user.addProject(project, { through: { status: 'active', data: 42 } }).return(user);
        }).then(user => {
          return user.getProjects({ joinTableAttributes: ['status'] });
        }).then(projects => {
          const project = projects[0];

          expect(project.UserProjects).to.be.ok;
          expect(project.status).not.to.exist;
          expect(project.UserProjects.status).to.equal('active');
          expect(project.UserProjects.data).not.to.exist;
        });
      });
    });

    describe('inserting in join table', () => {
      describe('add', () => {
        it('should insert data provided on the object into the join table', function() {
          const ctx = {
            UserProjects: this.UserProjects
          };
          return Promise.all([
            this.User.create(),
            this.Project.create()
          ]).then(([u, p]) => {
            ctx.u = u;
            ctx.p = p;
            p.UserProjects = { status: 'active' };

            return u.addProject(p);
          }).then(() => {
            return ctx.UserProjects.findOne({ where: { UserId: ctx.u.id, ProjectId: ctx.p.id } });
          }).then(up => {
            expect(up.status).to.equal('active');
          });
        });

        it('should insert data provided as a second argument into the join table', function() {
          const ctx = {
            UserProjects: this.UserProjects
          };
          return Promise.all([
            this.User.create(),
            this.Project.create()
          ]).then(([u, p]) => {
            ctx.u = u;
            ctx.p = p;

            return u.addProject(p, { through: { status: 'active' } });
          }).then(() => {
            return ctx.UserProjects.findOne({ where: { UserId: ctx.u.id, ProjectId: ctx.p.id } });
          }).then(up => {
            expect(up.status).to.equal('active');
          });
        });

        it('should be able to add twice (second call result in UPDATE call) without any attributes (and timestamps off) on the through model', function() {
          const Worker = this.sequelize.define('Worker', {}, { timestamps: false }),
            Task = this.sequelize.define('Task', {}, { timestamps: false }),
            WorkerTasks = this.sequelize.define('WorkerTasks', {}, { timestamps: false });

          Worker.belongsToMany(Task, { through: WorkerTasks });
          Task.belongsToMany(Worker, { through: WorkerTasks });

          const ctx = {};
          return this.sequelize.sync({ force: true }).then(() => {
            return Worker.create({ id: 1337 });
          }).then(worker => {
            ctx.worker = worker;
            return Task.create({ id: 7331 });
          }).then(() => {
            return ctx.worker.addTask(ctx.task);
          }).then(() => {
            return ctx.worker.addTask(ctx.task);
          });
        });

        it('should be able to add twice (second call result in UPDATE call) with custom primary keys and without any attributes (and timestamps off) on the through model', function() {
          const Worker = this.sequelize.define('Worker', {
              id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true
              }
            }, { timestamps: false }),
            Task = this.sequelize.define('Task', {
              id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true
              }
            }, { timestamps: false }),
            WorkerTasks = this.sequelize.define('WorkerTasks', {
              id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true
              }
            }, { timestamps: false });

          Worker.belongsToMany(Task, { through: WorkerTasks });
          Task.belongsToMany(Worker, { through: WorkerTasks });

          const ctx = {};
          return this.sequelize.sync({ force: true }).then(() => {
            return Worker.create({ id: 1337 });
          }).then(worker => {
            ctx.worker = worker;
            return Task.create({ id: 7331 });
          }).then(task => {
            ctx.task = task;
            return ctx.worker.addTask(ctx.task);
          }).then(() => {
            return ctx.worker.addTask(ctx.task);
          });
        });

        it('should be able to create an instance along with its many-to-many association which has an extra column in the junction table', function() {
          const Foo = this.sequelize.define('foo', { name: Sequelize.STRING });
          const Bar = this.sequelize.define('bar', { name: Sequelize.STRING });
          const FooBar = this.sequelize.define('foobar', { baz: Sequelize.STRING });
          Foo.belongsToMany(Bar, { through: FooBar });
          Bar.belongsToMany(Foo, { through: FooBar });

          return this.sequelize.sync({ force: true }).then(() => {
            return Foo.create({
              name: 'foo...',
              bars: [
                {
                  name: 'bar...',
                  foobar: {
                    baz: 'baz...'
                  }
                }
              ]
            }, {
              include: Bar
            });
          }).then(foo => {
            expect(foo.name).to.equal('foo...');
            expect(foo.bars).to.have.length(1);
            expect(foo.bars[0].name).to.equal('bar...');
            expect(foo.bars[0].foobar).to.not.equal(null);
            expect(foo.bars[0].foobar.baz).to.equal('baz...');

            return Foo.findOne({ include: Bar });
          }).then(foo => {
            expect(foo.name).to.equal('foo...');
            expect(foo.bars).to.have.length(1);
            expect(foo.bars[0].name).to.equal('bar...');
            expect(foo.bars[0].foobar).to.not.equal(null);
            expect(foo.bars[0].foobar.baz).to.equal('baz...');
          });
        });
      });

      describe('set', () => {
        it('should be able to combine properties on the associated objects, and default values', function() {
          const ctx = {};
          return Promise.all([
            this.User.create(),
            this.Project.bulkCreate([{}, {}]).then(() => {
              return this.Project.findAll();
            })
          ]).then(([user, projects]) => {
            ctx.user = user;
            ctx.p1 = projects[0];
            ctx.p2 = projects[1];

            ctx.p1.UserProjects = { status: 'inactive' };

            return user.setProjects([ctx.p1, ctx.p2], { through: { status: 'active' } });
          }).then(() => {
            return Promise.all([
              this.UserProjects.findOne({ where: { UserId: ctx.user.id, ProjectId: ctx.p1.id } }),
              this.UserProjects.findOne({ where: { UserId: ctx.user.id, ProjectId: ctx.p2.id } })
            ]);
          }).then(([up1, up2]) => {
            expect(up1.status).to.equal('inactive');
            expect(up2.status).to.equal('active');
          });
        });

        it('should be able to set twice (second call result in UPDATE calls) without any attributes (and timestamps off) on the through model', function() {
          const Worker = this.sequelize.define('Worker', {}, { timestamps: false }),
            Task = this.sequelize.define('Task', {}, { timestamps: false }),
            WorkerTasks = this.sequelize.define('WorkerTasks', {}, { timestamps: false });

          Worker.belongsToMany(Task, { through: WorkerTasks });
          Task.belongsToMany(Worker, { through: WorkerTasks });

          return this.sequelize.sync({ force: true }).then(() => {
            return Promise.all([
              Worker.create(),
              Task.bulkCreate([{}, {}]).then(() => {
                return Task.findAll();
              })
            ]);
          }).then(([worker, tasks]) => {
            return worker.setTasks(tasks).return([worker, tasks]);
          }).then(([worker, tasks]) => {
            return worker.setTasks(tasks);
          });
        });
      });

      describe('query with through.where', () => {
        it('should support query the through model', function() {
          return this.User.create().then(user => {
            return Promise.all([
              user.createProject({}, { through: { status: 'active', data: 1 } }),
              user.createProject({}, { through: { status: 'inactive', data: 2 } }),
              user.createProject({}, { through: { status: 'inactive', data: 3 } })
            ]).then(() => {
              return Promise.all([
                user.getProjects({ through: { where: { status: 'active' } } }),
                user.countProjects({ through: { where: { status: 'inactive' } } })
              ]);
            });
          }).then(([activeProjects, inactiveProjectCount]) => {
            expect(activeProjects).to.have.lengthOf(1);
            expect(inactiveProjectCount).to.eql(2);
          });
        });
      });
    });

    describe('removing from the join table', () => {
      it('should remove a single entry without any attributes (and timestamps off) on the through model', function() {
        const Worker = this.sequelize.define('Worker', {}, { timestamps: false }),
          Task = this.sequelize.define('Task', {}, { timestamps: false }),
          WorkerTasks = this.sequelize.define('WorkerTasks', {}, { timestamps: false });

        Worker.belongsToMany(Task, { through: WorkerTasks });
        Task.belongsToMany(Worker, { through: WorkerTasks });

        // Test setup
        return this.sequelize.sync({ force: true }).then(() => {
          return Sequelize.Promise.all([
            Worker.create({}),
            Task.bulkCreate([{}, {}, {}]).then(() => {
              return Task.findAll();
            })
          ]);
        }).then(([worker, tasks]) => {
          // Set all tasks, then remove one task by instance, then remove one task by id, then return all tasks
          return worker.setTasks(tasks).then(() => {
            return worker.removeTask(tasks[0]);
          }).then(() => {
            return worker.removeTask(tasks[1].id);
          }).then(() => {
            return worker.getTasks();
          });
        }).then(tasks => {
          expect(tasks.length).to.equal(1);
        });
      });

      it('should remove multiple entries without any attributes (and timestamps off) on the through model', function() {
        const Worker = this.sequelize.define('Worker', {}, { timestamps: false }),
          Task = this.sequelize.define('Task', {}, { timestamps: false }),
          WorkerTasks = this.sequelize.define('WorkerTasks', {}, { timestamps: false });

        Worker.belongsToMany(Task, { through: WorkerTasks });
        Task.belongsToMany(Worker, { through: WorkerTasks });

        // Test setup
        return this.sequelize.sync({ force: true }).then(() => {
          return Sequelize.Promise.all([
            Worker.create({}),
            Task.bulkCreate([{}, {}, {}, {}, {}]).then(() => {
              return Task.findAll();
            })
          ]);
        }).then(([worker, tasks]) => {
          // Set all tasks, then remove two tasks by instance, then remove two tasks by id, then return all tasks
          return worker.setTasks(tasks).then(() => {
            return worker.removeTasks([tasks[0], tasks[1]]);
          }).then(() => {
            return worker.removeTasks([tasks[2].id, tasks[3].id]);
          }).then(() => {
            return worker.getTasks();
          });
        }).then(tasks => {
          expect(tasks.length).to.equal(1);
        });
      });
    });
  });

  describe('belongsTo and hasMany at once', () => {
    beforeEach(function() {
      this.A = this.sequelize.define('a', { name: Sequelize.STRING });
      this.B = this.sequelize.define('b', { name: Sequelize.STRING });
    });

    describe('source belongs to target', () => {
      beforeEach(function() {
        this.A.belongsTo(this.B, { as: 'relation1' });
        this.A.belongsToMany(this.B, { as: 'relation2', through: 'AB' });
        this.B.belongsToMany(this.A, { as: 'relation2', through: 'AB' });

        return this.sequelize.sync({ force: true });
      });

      it('correctly uses bId in A', function() {
        const a1 = this.A.build({ name: 'a1' }),
          b1 = this.B.build({ name: 'b1' });

        return a1
          .save()
          .then(() => { return b1.save(); })
          .then(() => { return a1.setRelation1(b1); })
          .then(() => { return this.A.findOne({ where: { name: 'a1' } }); })
          .then(a => {
            expect(a.relation1Id).to.be.eq(b1.id);
          });
      });
    });

    describe('target belongs to source', () => {
      beforeEach(function() {
        this.B.belongsTo(this.A, { as: 'relation1' });
        this.A.belongsToMany(this.B, { as: 'relation2', through: 'AB' });
        this.B.belongsToMany(this.A, { as: 'relation2', through: 'AB' });

        return this.sequelize.sync({ force: true });
      });

      it('correctly uses bId in A', function() {
        const a1 = this.A.build({ name: 'a1' }),
          b1 = this.B.build({ name: 'b1' });

        return a1
          .save()
          .then(() => { return b1.save(); })
          .then(() => { return b1.setRelation1(a1); })
          .then(() => { return this.B.findOne({ where: { name: 'b1' } }); })
          .then(b => {
            expect(b.relation1Id).to.be.eq(a1.id);
          });
      });
    });
  });

  describe('alias', () => {
    it('creates the join table when through is a string', function() {
      const User = this.sequelize.define('User', {});
      const Group = this.sequelize.define('Group', {});

      User.belongsToMany(Group, { as: 'MyGroups', through: 'group_user' });
      Group.belongsToMany(User, { as: 'MyUsers', through: 'group_user' });

      return this.sequelize.sync({ force: true }).then(() => {
        return this.sequelize.getQueryInterface().showAllTables();
      }).then(result => {
        if (dialect === 'mssql' || dialect === 'mariadb') {
          result = result.map(v => v.tableName);
        }

        expect(result.includes('group_user')).to.be.true;
      });
    });

    it('creates the join table when through is a model', function() {
      const User = this.sequelize.define('User', {});
      const Group = this.sequelize.define('Group', {});
      const UserGroup = this.sequelize.define('GroupUser', {}, { tableName: 'user_groups' });

      User.belongsToMany(Group, { as: 'MyGroups', through: UserGroup });
      Group.belongsToMany(User, { as: 'MyUsers', through: UserGroup });

      return this.sequelize.sync({ force: true }).then(() => {
        return this.sequelize.getQueryInterface().showAllTables();
      }).then(result => {
        if (dialect === 'mssql' || dialect === 'mariadb') {
          result = result.map(v => v.tableName);
        }

        expect(result).to.include('user_groups');
      });
    });

    it('correctly identifies its counterpart when through is a string', function() {
      const User = this.sequelize.define('User', {}),
        Group = this.sequelize.define('Group', {});

      User.belongsToMany(Group, { as: 'MyGroups', through: 'group_user' });
      Group.belongsToMany(User, { as: 'MyUsers', through: 'group_user' });

      expect(Group.associations.MyUsers.through.model === User.associations.MyGroups.through.model);
      expect(Group.associations.MyUsers.through.model.rawAttributes.UserId).to.exist;
      expect(Group.associations.MyUsers.through.model.rawAttributes.GroupId).to.exist;
    });

    it('correctly identifies its counterpart when through is a model', function() {
      const User = this.sequelize.define('User', {}),
        Group = this.sequelize.define('Group', {}),
        UserGroup = this.sequelize.define('GroupUser', {}, { tableName: 'user_groups' });

      User.belongsToMany(Group, { as: 'MyGroups', through: UserGroup });
      Group.belongsToMany(User, { as: 'MyUsers', through: UserGroup });

      expect(Group.associations.MyUsers.through.model === User.associations.MyGroups.through.model);

      expect(Group.associations.MyUsers.through.model.rawAttributes.UserId).to.exist;
      expect(Group.associations.MyUsers.through.model.rawAttributes.GroupId).to.exist;
    });
  });

  describe('multiple hasMany', () => {
    beforeEach(function() {
      this.User = this.sequelize.define('user', { name: Sequelize.STRING });
      this.Project = this.sequelize.define('project', { projectName: Sequelize.STRING });
    });

    describe('project has owners and users and owners and users have projects', () => {
      beforeEach(function() {
        this.Project.belongsToMany(this.User, { as: 'owners', through: 'projectOwners' });
        this.Project.belongsToMany(this.User, { as: 'users', through: 'projectUsers' });

        this.User.belongsToMany(this.Project, { as: 'ownedProjects', through: 'projectOwners' });
        this.User.belongsToMany(this.Project, { as: 'memberProjects', through: 'projectUsers' });

        return this.sequelize.sync({ force: true });
      });

      it('correctly sets user and owner', function() {
        const p1 = this.Project.build({ projectName: 'p1' }),
          u1 = this.User.build({ name: 'u1' }),
          u2 = this.User.build({ name: 'u2' });

        return p1
          .save()
          .then(() => { return u1.save(); })
          .then(() => { return u2.save(); })
          .then(() => { return p1.setUsers([u1]); })
          .then(() => { return p1.setOwners([u2]); });
      });
    });
  });

  describe('Foreign key constraints', () => {
    beforeEach(function() {
      this.Task = this.sequelize.define('task', { title: DataTypes.STRING });
      this.User = this.sequelize.define('user', { username: DataTypes.STRING });
      this.UserTasks = this.sequelize.define('tasksusers', { userId: DataTypes.INTEGER, taskId: DataTypes.INTEGER });
    });

    it('can cascade deletes both ways by default', function() {
      this.User.belongsToMany(this.Task, { through: 'tasksusers' });
      this.Task.belongsToMany(this.User, { through: 'tasksusers' });

      const ctx = {};
      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.all([
          this.User.create({ id: 67, username: 'foo' }),
          this.Task.create({ id: 52, title: 'task' }),
          this.User.create({ id: 89, username: 'bar' }),
          this.Task.create({ id: 42, title: 'kast' })
        ]);
      }).then(([user1, task1, user2, task2]) => {
        ctx.user1 = user1;
        ctx.task1 = task1;
        ctx.user2 = user2;
        ctx.task2 = task2;
        return Promise.all([
          user1.setTasks([task1]),
          task2.setUsers([user2])
        ]);
      }).then(() => {
        return Promise.all([
          ctx.user1.destroy(),
          ctx.task2.destroy()
        ]);
      }).then(() => {
        return Promise.all([
          this.sequelize.model('tasksusers').findAll({ where: { userId: ctx.user1.id } }),
          this.sequelize.model('tasksusers').findAll({ where: { taskId: ctx.task2.id } }),
          this.User.findOne({
            where: this.sequelize.or({ username: 'Franz Joseph' }),
            include: [{
              model: this.Task,
              where: {
                title: {
                  [Op.ne]: 'task'
                }
              }
            }]
          })
        ]);
      }).then(([tu1, tu2]) => {
        expect(tu1).to.have.length(0);
        expect(tu2).to.have.length(0);
      });
    });

    if (current.dialect.supports.constraints.restrict) {

      it('can restrict deletes both ways', function() {
        this.User.belongsToMany(this.Task, { onDelete: 'RESTRICT', through: 'tasksusers' });
        this.Task.belongsToMany(this.User, { onDelete: 'RESTRICT', through: 'tasksusers' });

        const ctx = {};
        return this.sequelize.sync({ force: true }).then(() => {
          return Promise.all([
            this.User.create({ id: 67, username: 'foo' }),
            this.Task.create({ id: 52, title: 'task' }),
            this.User.create({ id: 89, username: 'bar' }),
            this.Task.create({ id: 42, title: 'kast' })
          ]);
        }).then(([user1, task1, user2, task2]) => {
          ctx.user1 = user1;
          ctx.task1 = task1;
          ctx.user2 = user2;
          ctx.task2 = task2;
          return Promise.all([
            user1.setTasks([task1]),
            task2.setUsers([user2])
          ]);
        }).then(() => {
          return Promise.all([
            expect(ctx.user1.destroy()).to.have.been.rejectedWith(Sequelize.ForeignKeyConstraintError), // Fails because of RESTRICT constraint
            expect(ctx.task2.destroy()).to.have.been.rejectedWith(Sequelize.ForeignKeyConstraintError)
          ]);
        });
      });

      it('can cascade and restrict deletes', function() {
        this.User.belongsToMany(this.Task, { onDelete: 'RESTRICT', through: 'tasksusers' });
        this.Task.belongsToMany(this.User, { onDelete: 'CASCADE', through: 'tasksusers' });

        const ctx = {};
        return this.sequelize.sync({ force: true }).then(() => {
          return Sequelize.Promise.join(
            this.User.create({ id: 67, username: 'foo' }),
            this.Task.create({ id: 52, title: 'task' }),
            this.User.create({ id: 89, username: 'bar' }),
            this.Task.create({ id: 42, title: 'kast' })
          );
        }).then(([user1, task1, user2, task2]) => {
          ctx.user1 = user1;
          ctx.task1 = task1;
          ctx.user2 = user2;
          ctx.task2 = task2;
          return Sequelize.Promise.join(
            user1.setTasks([task1]),
            task2.setUsers([user2])
          );
        }).then(() => {
          return Sequelize.Promise.join(
            expect(ctx.user1.destroy()).to.have.been.rejectedWith(Sequelize.ForeignKeyConstraintError), // Fails because of RESTRICT constraint
            ctx.task2.destroy()
          );
        }).then(() => {
          return this.sequelize.model('tasksusers').findAll({ where: { taskId: ctx.task2.id } });
        }).then(usertasks => {
          // This should not exist because deletes cascade
          expect(usertasks).to.have.length(0);
        });
      });

    }

    it('should be possible to remove all constraints', function() {
      this.User.belongsToMany(this.Task, { constraints: false, through: 'tasksusers' });
      this.Task.belongsToMany(this.User, { constraints: false, through: 'tasksusers' });

      const ctx = {};
      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.all([
          this.User.create({ id: 67, username: 'foo' }),
          this.Task.create({ id: 52, title: 'task' }),
          this.User.create({ id: 89, username: 'bar' }),
          this.Task.create({ id: 42, title: 'kast' })
        ]);
      }).then(([user1, task1, user2, task2]) => {
        ctx.user1 = user1;
        ctx.task1 = task1;
        ctx.user2 = user2;
        ctx.task2 = task2;
        return Promise.all([
          user1.setTasks([task1]),
          task2.setUsers([user2])
        ]);
      }).then(() => {
        return Promise.all([
          ctx.user1.destroy(),
          ctx.task2.destroy()
        ]);
      }).then(() => {
        return Promise.all([
          this.sequelize.model('tasksusers').findAll({ where: { userId: ctx.user1.id } }),
          this.sequelize.model('tasksusers').findAll({ where: { taskId: ctx.task2.id } })
        ]);
      }).then(([ut1, ut2]) => {
        expect(ut1).to.have.length(1);
        expect(ut2).to.have.length(1);
      });
    });

    it('create custom unique identifier', function() {
      this.UserTasksLong = this.sequelize.define('table_user_task_with_very_long_name', {
        id_user_very_long_field: {
          type: DataTypes.INTEGER(1)
        },
        id_task_very_long_field: {
          type: DataTypes.INTEGER(1)
        }
      },
      { tableName: 'table_user_task_with_very_long_name' }
      );
      this.User.belongsToMany(this.Task, {
        as: 'MyTasks',
        through: this.UserTasksLong,
        foreignKey: 'id_user_very_long_field'
      });
      this.Task.belongsToMany(this.User, {
        as: 'MyUsers',
        through: this.UserTasksLong,
        foreignKey: 'id_task_very_long_field',
        uniqueKey: 'custom_user_group_unique'
      });

      return this.sequelize.sync({ force: true }).then(() => {
        expect(this.Task.associations.MyUsers.through.model.rawAttributes.id_user_very_long_field.unique).to.equal('custom_user_group_unique');
        expect(this.Task.associations.MyUsers.through.model.rawAttributes.id_task_very_long_field.unique).to.equal('custom_user_group_unique');
      });
    });
  });

  describe('Association options', () => {
    describe('allows the user to provide an attribute definition object as foreignKey', () => {
      it('works when taking a column directly from the object', function() {
        const Project = this.sequelize.define('project', {}),
          User = this.sequelize.define('user', {
            uid: {
              type: Sequelize.INTEGER,
              primaryKey: true
            }
          });

        const UserProjects = User.belongsToMany(Project, { foreignKey: { name: 'user_id', defaultValue: 42 }, through: 'UserProjects' });
        expect(UserProjects.through.model.rawAttributes.user_id).to.be.ok;
        expect(UserProjects.through.model.rawAttributes.user_id.references.model).to.equal(User.getTableName());
        expect(UserProjects.through.model.rawAttributes.user_id.references.key).to.equal('uid');
        expect(UserProjects.through.model.rawAttributes.user_id.defaultValue).to.equal(42);
      });
    });

    it('should throw an error if foreignKey and as result in a name clash', function() {
      const User = this.sequelize.define('user', {
        user: Sequelize.INTEGER
      });

      expect(User.belongsToMany.bind(User, User, { as: 'user', through: 'UserUser' })).to
        .throw('Naming collision between attribute \'user\' and association \'user\' on model user. To remedy this, change either foreignKey or as in your association definition');
    });
  });

  describe('thisAssociations', () => {
    it('should work with this reference', function() {
      const User = this.sequelize.define('User', {
          name: Sequelize.STRING(100)
        }),
        Follow = this.sequelize.define('Follow');

      User.belongsToMany(User, { through: Follow, as: 'User' });
      User.belongsToMany(User, { through: Follow, as: 'Fan' });

      return this.sequelize.sync({ force: true })
        .then(() => {
          return Sequelize.Promise.all([
            User.create({ name: 'Khsama' }),
            User.create({ name: 'Vivek' }),
            User.create({ name: 'Satya' })
          ]);
        })
        .then(users => {
          return Sequelize.Promise.all([
            users[0].addFan(users[1]),
            users[1].addUser(users[2]),
            users[2].addFan(users[0])
          ]);
        });
    });

    it('should work with custom this reference', function() {
      const User = this.sequelize.define('User', {
          name: Sequelize.STRING(100)
        }),
        UserFollowers = this.sequelize.define('UserFollower');

      User.belongsToMany(User, {
        as: {
          singular: 'Follower',
          plural: 'Followers'
        },
        through: UserFollowers
      });

      User.belongsToMany(User, {
        as: {
          singular: 'Invitee',
          plural: 'Invitees'
        },
        foreignKey: 'InviteeId',
        through: 'Invites'
      });

      return this.sequelize.sync({ force: true })
        .then(() => {
          return Sequelize.Promise.all([
            User.create({ name: 'Jalrangi' }),
            User.create({ name: 'Sargrahi' })
          ]);
        })
        .then(users => {
          return Sequelize.Promise.all([
            users[0].addFollower(users[1]),
            users[1].addFollower(users[0]),
            users[0].addInvitee(users[1]),
            users[1].addInvitee(users[0])
          ]);
        });
    });

    it('should setup correct foreign keys', function() {
      /* camelCase */
      let Person = this.sequelize.define('Person'),
        PersonChildren = this.sequelize.define('PersonChildren'),
        Children;

      Children = Person.belongsToMany(Person, { as: 'Children', through: PersonChildren });

      expect(Children.foreignKey).to.equal('PersonId');
      expect(Children.otherKey).to.equal('ChildId');
      expect(PersonChildren.rawAttributes[Children.foreignKey]).to.be.ok;
      expect(PersonChildren.rawAttributes[Children.otherKey]).to.be.ok;

      /* underscored */
      Person = this.sequelize.define('Person', {}, { underscored: true });
      PersonChildren = this.sequelize.define('PersonChildren', {}, { underscored: true });
      Children = Person.belongsToMany(Person, { as: 'Children', through: PersonChildren });

      expect(Children.foreignKey).to.equal('PersonId');
      expect(Children.otherKey).to.equal('ChildId');
      expect(PersonChildren.rawAttributes[Children.foreignKey]).to.be.ok;
      expect(PersonChildren.rawAttributes[Children.otherKey]).to.be.ok;
      expect(PersonChildren.rawAttributes[Children.foreignKey].field).to.equal('person_id');
      expect(PersonChildren.rawAttributes[Children.otherKey].field).to.equal('child_id');
    });
  });

  describe('Eager loading', () => {
    beforeEach(function() {
      this.Individual = this.sequelize.define('individual', {
        name: Sequelize.STRING
      });
      this.Hat = this.sequelize.define('hat', {
        name: Sequelize.STRING
      });
      this.Event = this.sequelize.define('event', {});
      this.Individual.belongsToMany(this.Hat, {
        through: this.Event,
        as: {
          singular: 'personwearinghat',
          plural: 'personwearinghats'
        }
      });
      this.Hat.belongsToMany(this.Individual, {
        through: this.Event,
        as: {
          singular: 'hatwornby',
          plural: 'hatwornbys'
        }
      });
    });

    it('should load with an alias', function() {
      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.join(
          this.Individual.create({ name: 'Foo Bar' }),
          this.Hat.create({ name: 'Baz' }));
      }).then(([individual, hat]) => {
        return individual.addPersonwearinghat(hat);
      }).then(() => {
        return this.Individual.findOne({
          where: { name: 'Foo Bar' },
          include: [{ model: this.Hat, as: 'personwearinghats' }]
        });
      }).then(individual => {
        expect(individual.name).to.equal('Foo Bar');
        expect(individual.personwearinghats.length).to.equal(1);
        expect(individual.personwearinghats[0].name).to.equal('Baz');
      }).then(() => {
        return this.Hat.findOne({
          where: { name: 'Baz' },
          include: [{ model: this.Individual, as: 'hatwornbys' }]
        });
      }).then(hat => {
        expect(hat.name).to.equal('Baz');
        expect(hat.hatwornbys.length).to.equal(1);
        expect(hat.hatwornbys[0].name).to.equal('Foo Bar');
      });
    });

    it('should load all', function() {
      return this.sequelize.sync({ force: true }).then(() => {
        return Promise.join(
          this.Individual.create({ name: 'Foo Bar' }),
          this.Hat.create({ name: 'Baz' }));
      }).then(([individual, hat]) => {
        return individual.addPersonwearinghat(hat);
      }).then(() => {
        return this.Individual.findOne({
          where: { name: 'Foo Bar' },
          include: [{ all: true }]
        });
      }).then(individual => {
        expect(individual.name).to.equal('Foo Bar');
        expect(individual.personwearinghats.length).to.equal(1);
        expect(individual.personwearinghats[0].name).to.equal('Baz');
      }).then(() => {
        return this.Hat.findOne({
          where: { name: 'Baz' },
          include: [{ all: true }]
        });
      }).then(hat => {
        expect(hat.name).to.equal('Baz');
        expect(hat.hatwornbys.length).to.equal(1);
        expect(hat.hatwornbys[0].name).to.equal('Foo Bar');
      });
    });
  });
});
