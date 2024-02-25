'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../support');
const { DataTypes, IsolationLevel, Op, Sequelize, sql } = require('@sequelize/core');
const assert = require('node:assert');
const sinon = require('sinon');

const current = Support.sequelize;
const dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('BelongsToMany'), () => {
  Support.setResetMode('drop');

  describe('getAssociations', () => {
    beforeEach(async function () {
      this.User = this.sequelize.define('User', { username: DataTypes.STRING });
      this.Task = this.sequelize.define('Task', {
        title: DataTypes.STRING,
        active: DataTypes.BOOLEAN,
      });

      this.User.belongsToMany(this.Task, { through: 'UserTasks', as: 'Tasks', inverse: 'Users' });
      this.Task.belongsToMany(this.User, { through: 'UserTasks', as: 'Users', inverse: 'Tasks' });

      await this.sequelize.sync({ force: true });

      const [john, task1, task2] = await Promise.all([
        this.User.create({ username: 'John' }),
        this.Task.create({ title: 'Get rich', active: true }),
        this.Task.create({ title: 'Die trying', active: false }),
      ]);

      this.tasks = [task1, task2];
      this.user = john;

      return john.setTasks([task1, task2]);
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', async function () {
        const sequelize = await Support.createSingleTransactionalTestSequelizeInstance(
          this.sequelize,
        );
        const Article = sequelize.define('Article', { title: DataTypes.STRING });
        const Label = sequelize.define('Label', { text: DataTypes.STRING });

        Article.belongsToMany(Label, { through: 'ArticleLabels' });
        Label.belongsToMany(Article, { through: 'ArticleLabels' });

        await sequelize.sync({ force: true });

        const [article, label, t] = await Promise.all([
          Article.create({ title: 'foo' }),
          Label.create({ text: 'bar' }),
          sequelize.startUnmanagedTransaction(),
        ]);

        try {
          await article.setLabels([label], { transaction: t });
          const articles0 = await Article.findAll({ transaction: t });
          const labels0 = await articles0[0].getLabels();
          expect(labels0).to.have.length(0);
          const articles = await Article.findAll({ transaction: t });
          const labels = await articles[0].getLabels({ transaction: t });
          expect(labels).to.have.length(1);
        } finally {
          await t.rollback();
        }
      });
    }

    it('gets all associated objects with all fields', async function () {
      const john = await this.User.findOne({ where: { username: 'John' } });
      const tasks = await john.getTasks();
      for (const attributeName of this.Task.modelDefinition.attributes.keys()) {
        expect(tasks[0]).to.have.property(attributeName);
      }
    });

    it('gets all associated objects when no options are passed', async function () {
      const john = await this.User.findOne({ where: { username: 'John' } });
      const tasks = await john.getTasks();
      expect(tasks).to.have.length(2);
    });

    it('only get objects that fulfill the options', async function () {
      const john = await this.User.findOne({ where: { username: 'John' } });

      const tasks = await john.getTasks({
        where: {
          active: true,
        },
      });

      expect(tasks).to.have.length(1);
    });

    it('supports a where not in', async function () {
      const john = await this.User.findOne({
        where: {
          username: 'John',
        },
      });

      const tasks = await john.getTasks({
        where: {
          title: {
            [Op.not]: ['Get rich'],
          },
        },
      });

      expect(tasks).to.have.length(1);
    });

    it('supports a where not in on the primary key', async function () {
      const john = await this.User.findOne({
        where: {
          username: 'John',
        },
      });

      const tasks = await john.getTasks({
        where: {
          id: {
            [Op.not]: [this.tasks[0].get('id')],
          },
        },
      });

      expect(tasks).to.have.length(1);
    });

    it('only gets objects that fulfill options with a formatted value', async function () {
      const john = await this.User.findOne({ where: { username: 'John' } });
      const tasks = await john.getTasks({ where: { active: true } });
      expect(tasks).to.have.length(1);
    });

    it('get associated objects with an eager load', async function () {
      const john = await this.User.findOne({ where: { username: 'John' }, include: [this.Task] });
      expect(john.Tasks).to.have.length(2);
    });

    it('get associated objects with an eager load with conditions but not required', async function () {
      const Label = this.sequelize.define('Label', {
        title: DataTypes.STRING,
        isActive: DataTypes.BOOLEAN,
      });
      const Task = this.Task;
      const User = this.User;

      Task.hasMany(Label, { as: 'Labels' });
      Label.belongsTo(Task, { as: 'Tasks' });

      await Label.sync({ force: true });

      const john = await User.findOne({
        where: { username: 'John' },
        include: [
          {
            model: Task,
            required: false,
            include: [{ model: Label, required: false, where: { isActive: true } }],
          },
        ],
      });

      expect(john.Tasks).to.have.length(2);
    });

    if (current.dialect.supports.schemas) {
      it('should support schemas', async function () {
        const AcmeUser = this.sequelize
          .define('User', {
            username: DataTypes.STRING,
          })
          .withSchema({ schema: 'acme', schemaDelimiter: '_' });
        const AcmeProject = this.sequelize
          .define('Project', {
            title: DataTypes.STRING,
            active: DataTypes.BOOLEAN,
          })
          .withSchema({ schema: 'acme', schemaDelimiter: '_' });
        const AcmeProjectUsers = this.sequelize
          .define('ProjectUsers', {
            status: DataTypes.STRING,
            data: DataTypes.INTEGER,
          })
          .withSchema({ schema: 'acme', schemaDelimiter: '_' });

        AcmeUser.belongsToMany(AcmeProject, {
          through: AcmeProjectUsers,
          as: 'Projects',
          inverse: 'Users',
        });
        AcmeProject.belongsToMany(AcmeUser, {
          through: AcmeProjectUsers,
          as: 'Users',
          inverse: 'Projects',
        });

        await this.sequelize.createSchema('acme');
        await Promise.all([AcmeUser.sync({ force: true }), AcmeProject.sync({ force: true })]);

        await AcmeProjectUsers.sync({ force: true });
        const u = await AcmeUser.create();
        const p = await AcmeProject.create();
        await u.addProject(p, { through: { status: 'active', data: 42 } });
        const projects = await u.getProjects();
        expect(projects).to.have.length(1);
        const project = projects[0];

        expect(project.UserProject).to.be.ok;
        expect(project.status).not.to.exist;
        expect(project.UserProject.status).to.equal('active');
        await this.sequelize.queryInterface.dropAllTables({ schema: 'acme' });
        await this.sequelize.dropSchema('acme');
        const schemas = await this.sequelize.queryInterface.listSchemas();
        expect(schemas).to.not.include('acme');
      });
    }

    it('supports custom primary keys and foreign keys', async function () {
      const User = this.sequelize.define(
        'User',
        {
          id_user: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: sql.uuidV4,
            allowNull: false,
          },
        },
        {
          tableName: 'tbl_user',
        },
      );

      const Group = this.sequelize.define(
        'Group',
        {
          id_group: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
            defaultValue: sql.uuidV4,
          },
        },
        {
          tableName: 'tbl_group',
        },
      );

      const User_has_Group = this.sequelize.define(
        'User_has_Group',
        {},
        {
          tableName: 'tbl_user_has_group',
        },
      );

      User.belongsToMany(Group, {
        as: 'groups',
        through: User_has_Group,
        foreignKey: 'id_user',
        otherKey: 'id_group',
        inverse: { as: 'users' },
      });

      await this.sequelize.sync({ force: true });
      const [user0, group] = await Promise.all([User.create(), Group.create()]);
      await user0.addGroup(group);

      const user = await User.findOne({
        where: {},
      });

      await user.getGroups();
    });

    it('supports primary key attributes with different field and attribute names', async function () {
      const User = this.sequelize.define(
        'User',
        {
          userSecondId: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
            defaultValue: sql.uuidV4,
            field: 'user_id',
          },
        },
        {
          tableName: 'tbl_user',
        },
      );

      const Group = this.sequelize.define(
        'Group',
        {
          groupSecondId: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
            defaultValue: sql.uuidV4,
            field: 'group_id',
          },
        },
        {
          tableName: 'tbl_group',
        },
      );

      const User_has_Group = this.sequelize.define(
        'User_has_Group',
        {},
        {
          tableName: 'tbl_user_has_group',
        },
      );

      User.belongsToMany(Group, { through: User_has_Group, as: 'Groups', inverse: 'Users' });
      Group.belongsToMany(User, { through: User_has_Group, as: 'Users', inverse: 'Groups' });

      await this.sequelize.sync({ force: true });
      const [user0, group] = await Promise.all([User.create(), Group.create()]);
      await user0.addGroup(group);

      const [user, users] = await Promise.all([
        User.findOne({
          where: {},
          include: [Group],
        }),
        User.findAll({
          include: [Group],
        }),
      ]);

      expect(user.Groups.length).to.equal(1);
      expect(user.Groups[0].User_has_Group.userUserSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(user.Groups[0].User_has_Group.userUserSecondId).to.deep.equal(user.userSecondId);
      } else {
        expect(user.Groups[0].User_has_Group.userUserSecondId).to.equal(user.userSecondId);
      }

      expect(user.Groups[0].User_has_Group.groupGroupSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(user.Groups[0].User_has_Group.groupGroupSecondId).to.deep.equal(
          user.Groups[0].groupSecondId,
        );
      } else {
        expect(user.Groups[0].User_has_Group.groupGroupSecondId).to.equal(
          user.Groups[0].groupSecondId,
        );
      }

      expect(users.length).to.equal(1);
      expect(users[0].toJSON()).to.be.eql(user.toJSON());
    });

    it('supports non primary key attributes for joins (sourceKey only)', async function () {
      const User = this.sequelize.define(
        'User',
        {
          id: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
            defaultValue: sql.uuidV4,
            field: 'user_id',
          },
          userSecondId: {
            type: DataTypes.UUID,
            allowNull: false,
            defaultValue: sql.uuidV4,
            field: 'user_second_id',
          },
        },
        {
          tableName: 'tbl_user',
          indexes: [
            {
              unique: true,
              fields: ['user_second_id'],
            },
          ],
        },
      );

      const Group = this.sequelize.define(
        'Group',
        {
          id: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
            defaultValue: sql.uuidV4,
            field: 'group_id',
          },
          groupSecondId: {
            type: DataTypes.UUID,
            allowNull: false,
            defaultValue: sql.uuidV4,
            field: 'group_second_id',
          },
        },
        {
          tableName: 'tbl_group',
          indexes: [
            {
              unique: true,
              fields: ['group_second_id'],
            },
          ],
        },
      );

      User.belongsToMany(Group, {
        through: 'usergroups',
        sourceKey: 'userSecondId',
        targetKey: 'groupSecondId',
        as: 'Groups',
      });

      await this.sequelize.sync({ force: true });
      const [user1, user2, group1, group2] = await Promise.all([
        User.create(),
        User.create(),
        Group.create(),
        Group.create(),
      ]);
      await Promise.all([user1.addGroup(group1), user2.addGroup(group2)]);

      const [users, groups] = await Promise.all([
        User.findAll({
          where: {},
          include: [Group],
        }),
        Group.findAll({
          include: [User],
        }),
      ]);
      // Need to add db2 condition for the same. referred to issue: https://github.com/chaijs/chai/issues/102
      expect(users.length).to.equal(2);
      expect(users[0].Groups.length).to.equal(1);
      expect(users[1].Groups.length).to.equal(1);
      expect(users[0].Groups[0].usergroups.userUserSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(users[0].Groups[0].usergroups.userUserSecondId).to.deep.equal(users[0].userSecondId);
      } else {
        expect(users[0].Groups[0].usergroups.userUserSecondId).to.equal(users[0].userSecondId);
      }

      expect(users[0].Groups[0].usergroups.groupGroupSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(users[0].Groups[0].usergroups.groupGroupSecondId).to.deep.equal(
          users[0].Groups[0].groupSecondId,
        );
      } else {
        expect(users[0].Groups[0].usergroups.groupGroupSecondId).to.equal(
          users[0].Groups[0].groupSecondId,
        );
      }

      expect(users[1].Groups[0].usergroups.userUserSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(users[1].Groups[0].usergroups.userUserSecondId).to.deep.equal(users[1].userSecondId);
      } else {
        expect(users[1].Groups[0].usergroups.userUserSecondId).to.equal(users[1].userSecondId);
      }

      expect(users[1].Groups[0].usergroups.groupGroupSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(users[1].Groups[0].usergroups.groupGroupSecondId).to.deep.equal(
          users[1].Groups[0].groupSecondId,
        );
      } else {
        expect(users[1].Groups[0].usergroups.groupGroupSecondId).to.equal(
          users[1].Groups[0].groupSecondId,
        );
      }

      expect(groups.length).to.equal(2);
      expect(groups[0].users.length).to.equal(1);
      expect(groups[1].users.length).to.equal(1);
      expect(groups[0].users[0].usergroups.groupGroupSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(groups[0].users[0].usergroups.groupGroupSecondId).to.deep.equal(
          groups[0].groupSecondId,
        );
      } else {
        expect(groups[0].users[0].usergroups.groupGroupSecondId).to.equal(groups[0].groupSecondId);
      }

      expect(groups[0].users[0].usergroups.userUserSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(groups[0].users[0].usergroups.userUserSecondId).to.deep.equal(
          groups[0].users[0].userSecondId,
        );
      } else {
        expect(groups[0].users[0].usergroups.userUserSecondId).to.equal(
          groups[0].users[0].userSecondId,
        );
      }

      expect(groups[1].users[0].usergroups.groupGroupSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(groups[1].users[0].usergroups.groupGroupSecondId).to.deep.equal(
          groups[1].groupSecondId,
        );
      } else {
        expect(groups[1].users[0].usergroups.groupGroupSecondId).to.equal(groups[1].groupSecondId);
      }

      expect(groups[1].users[0].usergroups.userUserSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(groups[1].users[0].usergroups.userUserSecondId).to.deep.equal(
          groups[1].users[0].userSecondId,
        );
      } else {
        expect(groups[1].users[0].usergroups.userUserSecondId).to.equal(
          groups[1].users[0].userSecondId,
        );
      }
    });

    it('supports non primary key attributes for joins (targetKey only)', async function () {
      const User = this.sequelize.define(
        'User',
        {
          id: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
            defaultValue: sql.uuidV4,
            field: 'user_id',
          },
          userSecondId: {
            type: DataTypes.UUID,
            allowNull: false,
            defaultValue: sql.uuidV4,
            field: 'user_second_id',
          },
        },
        {
          tableName: 'tbl_user',
          indexes: [
            {
              unique: true,
              fields: ['user_second_id'],
            },
          ],
        },
      );

      const Group = this.sequelize.define(
        'Group',
        {
          id: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
            defaultValue: sql.uuidV4,
            field: 'group_id',
          },
        },
        {
          tableName: 'tbl_group',
          indexes: [
            {
              unique: true,
              fields: ['group_id'],
            },
          ],
        },
      );

      User.belongsToMany(Group, { through: 'usergroups', sourceKey: 'userSecondId' });
      Group.belongsToMany(User, { through: 'usergroups', targetKey: 'userSecondId' });

      await this.sequelize.sync({ force: true });
      const [user1, user2, group1, group2] = await Promise.all([
        User.create(),
        User.create(),
        Group.create(),
        Group.create(),
      ]);
      await Promise.all([user1.addGroup(group1), user2.addGroup(group2)]);

      const [users, groups] = await Promise.all([
        User.findAll({
          where: {},
          include: [Group],
        }),
        Group.findAll({
          include: [User],
        }),
      ]);

      expect(users.length).to.equal(2);
      expect(users[0].groups.length).to.equal(1);
      expect(users[1].groups.length).to.equal(1);
      expect(users[0].groups[0].usergroups.userUserSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(users[0].groups[0].usergroups.userUserSecondId).to.deep.equal(users[0].userSecondId);
      } else {
        expect(users[0].groups[0].usergroups.userUserSecondId).to.equal(users[0].userSecondId);
      }

      expect(users[0].groups[0].usergroups.groupId).to.be.ok;
      if (dialect === 'db2') {
        expect(users[0].groups[0].usergroups.groupId).to.deep.equal(users[0].groups[0].id);
      } else {
        expect(users[0].groups[0].usergroups.groupId).to.equal(users[0].groups[0].id);
      }

      expect(users[1].groups[0].usergroups.userUserSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(users[1].groups[0].usergroups.userUserSecondId).to.deep.equal(users[1].userSecondId);
      } else {
        expect(users[1].groups[0].usergroups.userUserSecondId).to.equal(users[1].userSecondId);
      }

      expect(users[1].groups[0].usergroups.groupId).to.be.ok;
      if (dialect === 'db2') {
        expect(users[1].groups[0].usergroups.groupId).to.deep.equal(users[1].groups[0].id);
      } else {
        expect(users[1].groups[0].usergroups.groupId).to.equal(users[1].groups[0].id);
      }

      expect(groups.length).to.equal(2);
      expect(groups[0].users.length).to.equal(1);
      expect(groups[1].users.length).to.equal(1);
      expect(groups[0].users[0].usergroups.groupId).to.be.ok;
      if (dialect === 'db2') {
        expect(groups[0].users[0].usergroups.groupId).to.deep.equal(groups[0].id);
      } else {
        expect(groups[0].users[0].usergroups.groupId).to.equal(groups[0].id);
      }

      expect(groups[0].users[0].usergroups.userUserSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(groups[0].users[0].usergroups.userUserSecondId).to.deep.equal(
          groups[0].users[0].userSecondId,
        );
      } else {
        expect(groups[0].users[0].usergroups.userUserSecondId).to.equal(
          groups[0].users[0].userSecondId,
        );
      }

      expect(groups[1].users[0].usergroups.groupId).to.be.ok;
      if (dialect === 'db2') {
        expect(groups[1].users[0].usergroups.groupId).to.deep.equal(groups[1].id);
      } else {
        expect(groups[1].users[0].usergroups.groupId).to.equal(groups[1].id);
      }

      expect(groups[1].users[0].usergroups.userUserSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(groups[1].users[0].usergroups.userUserSecondId).to.deep.equal(
          groups[1].users[0].userSecondId,
        );
      } else {
        expect(groups[1].users[0].usergroups.userUserSecondId).to.equal(
          groups[1].users[0].userSecondId,
        );
      }
    });

    it('supports non primary key attributes for joins (sourceKey and targetKey)', async function () {
      const User = this.sequelize.define(
        'User',
        {
          id: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
            defaultValue: sql.uuidV4,
            field: 'user_id',
          },
          userSecondId: {
            type: DataTypes.UUID,
            allowNull: false,
            defaultValue: sql.uuidV4,
            field: 'user_second_id',
          },
        },
        {
          tableName: 'tbl_user',
          indexes: [
            {
              unique: true,
              fields: ['user_second_id'],
            },
          ],
        },
      );

      const Group = this.sequelize.define(
        'Group',
        {
          id: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
            defaultValue: sql.uuidV4,
            field: 'group_id',
          },
          groupSecondId: {
            type: DataTypes.UUID,
            allowNull: false,
            defaultValue: sql.uuidV4,
            field: 'group_second_id',
          },
        },
        {
          tableName: 'tbl_group',
          indexes: [
            {
              unique: true,
              fields: ['group_second_id'],
            },
          ],
        },
      );

      User.belongsToMany(Group, {
        through: 'usergroups',
        sourceKey: 'userSecondId',
        targetKey: 'groupSecondId',
        as: 'Groups',
        inverse: 'Users',
      });
      Group.belongsToMany(User, {
        through: 'usergroups',
        sourceKey: 'groupSecondId',
        targetKey: 'userSecondId',
        as: 'Users',
        inverse: 'Groups',
      });

      await this.sequelize.sync({ force: true });
      const [user1, user2, group1, group2] = await Promise.all([
        User.create(),
        User.create(),
        Group.create(),
        Group.create(),
      ]);
      await Promise.all([user1.addGroup(group1), user2.addGroup(group2)]);

      const [users, groups] = await Promise.all([
        User.findAll({
          where: {},
          include: [Group],
        }),
        Group.findAll({
          include: [User],
        }),
      ]);

      expect(users.length).to.equal(2);
      expect(users[0].Groups.length).to.equal(1);
      expect(users[1].Groups.length).to.equal(1);
      expect(users[0].Groups[0].usergroups.userUserSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(users[0].Groups[0].usergroups.userUserSecondId).to.deep.equal(users[0].userSecondId);
      } else {
        expect(users[0].Groups[0].usergroups.userUserSecondId).to.equal(users[0].userSecondId);
      }

      expect(users[0].Groups[0].usergroups.groupGroupSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(users[0].Groups[0].usergroups.groupGroupSecondId).to.deep.equal(
          users[0].Groups[0].groupSecondId,
        );
      } else {
        expect(users[0].Groups[0].usergroups.groupGroupSecondId).to.equal(
          users[0].Groups[0].groupSecondId,
        );
      }

      expect(users[1].Groups[0].usergroups.userUserSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(users[1].Groups[0].usergroups.userUserSecondId).to.deep.equal(users[1].userSecondId);
      } else {
        expect(users[1].Groups[0].usergroups.userUserSecondId).to.equal(users[1].userSecondId);
      }

      expect(users[1].Groups[0].usergroups.groupGroupSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(users[1].Groups[0].usergroups.groupGroupSecondId).to.deep.equal(
          users[1].Groups[0].groupSecondId,
        );
      } else {
        expect(users[1].Groups[0].usergroups.groupGroupSecondId).to.equal(
          users[1].Groups[0].groupSecondId,
        );
      }

      expect(groups.length).to.equal(2);
      expect(groups[0].Users.length).to.equal(1);
      expect(groups[1].Users.length).to.equal(1);
      expect(groups[0].Users[0].usergroups.groupGroupSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(groups[0].Users[0].usergroups.groupGroupSecondId).to.deep.equal(
          groups[0].groupSecondId,
        );
      } else {
        expect(groups[0].Users[0].usergroups.groupGroupSecondId).to.equal(groups[0].groupSecondId);
      }

      expect(groups[0].Users[0].usergroups.userUserSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(groups[0].Users[0].usergroups.userUserSecondId).to.deep.equal(
          groups[0].Users[0].userSecondId,
        );
      } else {
        expect(groups[0].Users[0].usergroups.userUserSecondId).to.equal(
          groups[0].Users[0].userSecondId,
        );
      }

      expect(groups[1].Users[0].usergroups.groupGroupSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(groups[1].Users[0].usergroups.groupGroupSecondId).to.deep.equal(
          groups[1].groupSecondId,
        );
      } else {
        expect(groups[1].Users[0].usergroups.groupGroupSecondId).to.equal(groups[1].groupSecondId);
      }

      expect(groups[1].Users[0].usergroups.userUserSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(groups[1].Users[0].usergroups.userUserSecondId).to.deep.equal(
          groups[1].Users[0].userSecondId,
        );
      } else {
        expect(groups[1].Users[0].usergroups.userUserSecondId).to.equal(
          groups[1].Users[0].userSecondId,
        );
      }
    });

    it('supports non primary key attributes for joins (custom through model)', async function () {
      const User = this.sequelize.define(
        'User',
        {
          id: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
            defaultValue: sql.uuidV4,
            field: 'user_id',
          },
          userSecondId: {
            type: DataTypes.UUID,
            allowNull: false,
            defaultValue: sql.uuidV4,
            field: 'user_second_id',
          },
        },
        {
          tableName: 'tbl_user',
          indexes: [
            {
              unique: true,
              fields: ['user_second_id'],
            },
          ],
        },
      );

      const Group = this.sequelize.define(
        'Group',
        {
          id: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
            defaultValue: sql.uuidV4,
            field: 'group_id',
          },
          groupSecondId: {
            type: DataTypes.UUID,
            allowNull: false,
            defaultValue: sql.uuidV4,
            field: 'group_second_id',
          },
        },
        {
          tableName: 'tbl_group',
          indexes: [
            {
              unique: true,
              fields: ['group_second_id'],
            },
          ],
        },
      );

      const User_has_Group = this.sequelize.define(
        'User_has_Group',
        {},
        {
          tableName: 'tbl_user_has_group',
          indexes: [
            {
              unique: true,
              fields: ['userUserSecondId', 'groupGroupSecondId'],
              name: 'UserHasGroup_Second_Unique',
            },
          ],
        },
      );

      User.belongsToMany(Group, {
        through: User_has_Group,
        sourceKey: 'userSecondId',
        targetKey: 'groupSecondId',
      });

      await this.sequelize.sync({ force: true });
      const [user1, user2, group1, group2] = await Promise.all([
        User.create(),
        User.create(),
        Group.create(),
        Group.create(),
      ]);
      await Promise.all([user1.addGroup(group1), user2.addGroup(group2)]);

      const [users, groups] = await Promise.all([
        User.findAll({
          where: {},
          include: [Group],
        }),
        Group.findAll({
          include: [User],
        }),
      ]);

      expect(users.length).to.equal(2);
      expect(users[0].groups.length).to.equal(1);
      expect(users[1].groups.length).to.equal(1);
      expect(users[0].groups[0].User_has_Group.userUserSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(users[0].groups[0].User_has_Group.userUserSecondId).to.deep.equal(
          users[0].userSecondId,
        );
      } else {
        expect(users[0].groups[0].User_has_Group.userUserSecondId).to.equal(users[0].userSecondId);
      }

      expect(users[0].groups[0].User_has_Group.groupGroupSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(users[0].groups[0].User_has_Group.groupGroupSecondId).to.deep.equal(
          users[0].groups[0].groupSecondId,
        );
      } else {
        expect(users[0].groups[0].User_has_Group.groupGroupSecondId).to.equal(
          users[0].groups[0].groupSecondId,
        );
      }

      expect(users[1].groups[0].User_has_Group.userUserSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(users[1].groups[0].User_has_Group.userUserSecondId).to.deep.equal(
          users[1].userSecondId,
        );
      } else {
        expect(users[1].groups[0].User_has_Group.userUserSecondId).to.equal(users[1].userSecondId);
      }

      expect(users[1].groups[0].User_has_Group.groupGroupSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(users[1].groups[0].User_has_Group.groupGroupSecondId).to.deep.equal(
          users[1].groups[0].groupSecondId,
        );
      } else {
        expect(users[1].groups[0].User_has_Group.groupGroupSecondId).to.equal(
          users[1].groups[0].groupSecondId,
        );
      }

      expect(groups.length).to.equal(2);
      expect(groups[0].users.length).to.equal(1);
      expect(groups[1].users.length).to.equal(1);
      expect(groups[0].users[0].User_has_Group.groupGroupSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(groups[0].users[0].User_has_Group.groupGroupSecondId).to.deep.equal(
          groups[0].groupSecondId,
        );
      } else {
        expect(groups[0].users[0].User_has_Group.groupGroupSecondId).to.equal(
          groups[0].groupSecondId,
        );
      }

      expect(groups[0].users[0].User_has_Group.userUserSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(groups[0].users[0].User_has_Group.userUserSecondId).to.deep.equal(
          groups[0].users[0].userSecondId,
        );
      } else {
        expect(groups[0].users[0].User_has_Group.userUserSecondId).to.equal(
          groups[0].users[0].userSecondId,
        );
      }

      expect(groups[1].users[0].User_has_Group.groupGroupSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(groups[1].users[0].User_has_Group.groupGroupSecondId).to.deep.equal(
          groups[1].groupSecondId,
        );
      } else {
        expect(groups[1].users[0].User_has_Group.groupGroupSecondId).to.equal(
          groups[1].groupSecondId,
        );
      }

      expect(groups[1].users[0].User_has_Group.userUserSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(groups[1].users[0].User_has_Group.userUserSecondId).to.deep.equal(
          groups[1].users[0].userSecondId,
        );
      } else {
        expect(groups[1].users[0].User_has_Group.userUserSecondId).to.equal(
          groups[1].users[0].userSecondId,
        );
      }
    });

    it('supports non primary key attributes for joins for getting associations (sourceKey/targetKey)', async function () {
      const User = this.sequelize.define(
        'User',
        {
          userId: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
            defaultValue: sql.uuidV4,
          },
          userSecondId: {
            type: DataTypes.UUID,
            allowNull: false,
            defaultValue: sql.uuidV4,
            field: 'user_second_id',
          },
        },
        {
          tableName: 'tbl_user',
          indexes: [
            {
              unique: true,
              fields: ['user_second_id'],
            },
          ],
        },
      );

      const Group = this.sequelize.define(
        'Group',
        {
          groupId: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
            defaultValue: sql.uuidV4,
          },
          groupSecondId: {
            type: DataTypes.UUID,
            allowNull: false,
            defaultValue: sql.uuidV4,
            field: 'group_second_id',
          },
        },
        {
          tableName: 'tbl_group',
          indexes: [
            {
              unique: true,
              fields: ['group_second_id'],
            },
          ],
        },
      );

      User.belongsToMany(Group, {
        through: 'usergroups',
        sourceKey: 'userSecondId',
        targetKey: 'groupSecondId',
      });
      Group.belongsToMany(User, {
        through: 'usergroups',
        sourceKey: 'groupSecondId',
        targetKey: 'userSecondId',
      });

      await this.sequelize.sync({ force: true });
      const [user1, user2, group1, group2] = await Promise.all([
        User.create(),
        User.create(),
        Group.create(),
        Group.create(),
      ]);
      await Promise.all([user1.addGroup(group1), user2.addGroup(group2)]);

      const [groups1, groups2, users1, users2] = await Promise.all([
        user1.getGroups(),
        user2.getGroups(),
        group1.getUsers(),
        group2.getUsers(),
      ]);

      expect(groups1.length).to.equal(1);
      expect(groups1[0].id).to.equal(group1.id);
      expect(groups2.length).to.equal(1);
      expect(groups2[0].id).to.equal(group2.id);
      expect(users1.length).to.equal(1);
      expect(users1[0].id).to.equal(user1.id);
      expect(users2.length).to.equal(1);
      expect(users2[0].id).to.equal(user2.id);
    });

    it('supports non primary key attributes for joins (custom foreignKey)', async function () {
      const User = this.sequelize.define(
        'User',
        {
          id: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
            defaultValue: sql.uuidV4,
            field: 'user_id',
          },
          userSecondId: {
            type: DataTypes.UUID,
            allowNull: false,
            defaultValue: sql.uuidV4,
            field: 'user_second_id',
          },
        },
        {
          tableName: 'tbl_user',
          indexes: [
            {
              unique: true,
              fields: ['user_second_id'],
            },
          ],
        },
      );

      const Group = this.sequelize.define(
        'Group',
        {
          id: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
            defaultValue: sql.uuidV4,
            field: 'group_id',
          },
          groupSecondId: {
            type: DataTypes.UUID,
            allowNull: false,
            defaultValue: sql.uuidV4,
            field: 'group_second_id',
          },
        },
        {
          tableName: 'tbl_group',
          indexes: [
            {
              unique: true,
              fields: ['group_second_id'],
            },
          ],
        },
      );

      User.belongsToMany(Group, {
        through: 'usergroups',
        foreignKey: 'userId2',
        otherKey: 'groupId2',
        sourceKey: 'userSecondId',
        targetKey: 'groupSecondId',
      });

      await this.sequelize.sync({ force: true });
      const [user1, user2, group1, group2] = await Promise.all([
        User.create(),
        User.create(),
        Group.create(),
        Group.create(),
      ]);
      await Promise.all([user1.addGroup(group1), user2.addGroup(group2)]);

      const [users, groups] = await Promise.all([
        User.findAll({
          where: {},
          include: [Group],
        }),
        Group.findAll({
          include: [User],
        }),
      ]);

      expect(users.length).to.equal(2);
      expect(users[0].groups.length).to.equal(1);
      expect(users[1].groups.length).to.equal(1);
      expect(users[0].groups[0].usergroups.userId2).to.be.ok;
      if (dialect === 'db2') {
        expect(users[0].groups[0].usergroups.userId2).to.deep.equal(users[0].userSecondId);
      } else {
        expect(users[0].groups[0].usergroups.userId2).to.equal(users[0].userSecondId);
      }

      expect(users[0].groups[0].usergroups.groupId2).to.be.ok;
      if (dialect === 'db2') {
        expect(users[0].groups[0].usergroups.groupId2).to.deep.equal(
          users[0].groups[0].groupSecondId,
        );
      } else {
        expect(users[0].groups[0].usergroups.groupId2).to.equal(users[0].groups[0].groupSecondId);
      }

      expect(users[1].groups[0].usergroups.userId2).to.be.ok;
      if (dialect === 'db2') {
        expect(users[1].groups[0].usergroups.userId2).to.deep.equal(users[1].userSecondId);
      } else {
        expect(users[1].groups[0].usergroups.userId2).to.equal(users[1].userSecondId);
      }

      expect(users[1].groups[0].usergroups.groupId2).to.be.ok;
      if (dialect === 'db2') {
        expect(users[1].groups[0].usergroups.groupId2).to.deep.equal(
          users[1].groups[0].groupSecondId,
        );
      } else {
        expect(users[1].groups[0].usergroups.groupId2).to.equal(users[1].groups[0].groupSecondId);
      }

      expect(groups.length).to.equal(2);
      expect(groups[0].users.length).to.equal(1);
      expect(groups[1].users.length).to.equal(1);
      expect(groups[0].users[0].usergroups.groupId2).to.be.ok;
      if (dialect === 'db2') {
        expect(groups[0].users[0].usergroups.groupId2).to.deep.equal(groups[0].groupSecondId);
      } else {
        expect(groups[0].users[0].usergroups.groupId2).to.equal(groups[0].groupSecondId);
      }

      expect(groups[0].users[0].usergroups.userId2).to.be.ok;
      if (dialect === 'db2') {
        expect(groups[0].users[0].usergroups.userId2).to.deep.equal(
          groups[0].users[0].userSecondId,
        );
      } else {
        expect(groups[0].users[0].usergroups.userId2).to.equal(groups[0].users[0].userSecondId);
      }

      expect(groups[1].users[0].usergroups.groupId2).to.be.ok;
      if (dialect === 'db2') {
        expect(groups[1].users[0].usergroups.groupId2).to.deep.equal(groups[1].groupSecondId);
      } else {
        expect(groups[1].users[0].usergroups.groupId2).to.equal(groups[1].groupSecondId);
      }

      expect(groups[1].users[0].usergroups.userId2).to.be.ok;
      if (dialect === 'db2') {
        expect(groups[1].users[0].usergroups.userId2).to.deep.equal(
          groups[1].users[0].userSecondId,
        );
      } else {
        expect(groups[1].users[0].usergroups.userId2).to.equal(groups[1].users[0].userSecondId);
      }
    });

    it('supports non primary key attributes for joins (custom foreignKey, custom through model)', async function () {
      const User = this.sequelize.define(
        'User',
        {
          id: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
            defaultValue: sql.uuidV4,
            field: 'user_id',
          },
          userSecondId: {
            type: DataTypes.UUID,
            allowNull: false,
            defaultValue: sql.uuidV4,
            field: 'user_second_id',
          },
        },
        {
          tableName: 'tbl_user',
          indexes: [
            {
              unique: true,
              fields: ['user_second_id'],
            },
          ],
        },
      );

      const Group = this.sequelize.define(
        'Group',
        {
          id: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
            defaultValue: sql.uuidV4,
            field: 'group_id',
          },
          groupSecondId: {
            type: DataTypes.UUID,
            allowNull: false,
            defaultValue: sql.uuidV4,
            field: 'group_second_id',
          },
        },
        {
          tableName: 'tbl_group',
          indexes: [
            {
              unique: true,
              fields: ['group_second_id'],
            },
          ],
        },
      );

      const User_has_Group = this.sequelize.define(
        'User_has_Group',
        {
          userId2: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'user_id2',
          },
          groupId2: {
            type: DataTypes.UUID,
            allowNull: false,
            field: 'group_id2',
          },
        },
        {
          tableName: 'tbl_user_has_group',
          indexes: [
            {
              unique: true,
              fields: ['user_id2', 'group_id2'],
            },
          ],
        },
      );

      User.belongsToMany(Group, {
        through: User_has_Group,
        foreignKey: 'userId2',
        otherKey: 'groupId2',
        sourceKey: 'userSecondId',
        targetKey: 'groupSecondId',
      });

      await this.sequelize.sync({ force: true });
      const [user1, user2, group1, group2] = await Promise.all([
        User.create(),
        User.create(),
        Group.create(),
        Group.create(),
      ]);
      await Promise.all([user1.addGroup(group1), user2.addGroup(group2)]);

      const [users, groups] = await Promise.all([
        User.findAll({
          where: {},
          include: [Group],
        }),
        Group.findAll({
          include: [User],
        }),
      ]);

      expect(users.length).to.equal(2);
      expect(users[0].groups.length).to.equal(1);
      expect(users[1].groups.length).to.equal(1);
      expect(users[0].groups[0].User_has_Group.userId2).to.be.ok;
      if (dialect === 'db2') {
        expect(users[0].groups[0].User_has_Group.userId2).to.deep.equal(users[0].userSecondId);
      } else {
        expect(users[0].groups[0].User_has_Group.userId2).to.equal(users[0].userSecondId);
      }

      expect(users[0].groups[0].User_has_Group.groupId2).to.be.ok;
      if (dialect === 'db2') {
        expect(users[0].groups[0].User_has_Group.groupId2).to.deep.equal(
          users[0].groups[0].groupSecondId,
        );
      } else {
        expect(users[0].groups[0].User_has_Group.groupId2).to.equal(
          users[0].groups[0].groupSecondId,
        );
      }

      expect(users[1].groups[0].User_has_Group.userId2).to.be.ok;
      if (dialect === 'db2') {
        expect(users[1].groups[0].User_has_Group.userId2).to.deep.equal(users[1].userSecondId);
      } else {
        expect(users[1].groups[0].User_has_Group.userId2).to.equal(users[1].userSecondId);
      }

      expect(users[1].groups[0].User_has_Group.groupId2).to.be.ok;
      if (dialect === 'db2') {
        expect(users[1].groups[0].User_has_Group.groupId2).to.deep.equal(
          users[1].groups[0].groupSecondId,
        );
      } else {
        expect(users[1].groups[0].User_has_Group.groupId2).to.equal(
          users[1].groups[0].groupSecondId,
        );
      }

      expect(groups.length).to.equal(2);
      expect(groups[0].users.length).to.equal(1);
      expect(groups[1].users.length).to.equal(1);
      expect(groups[0].users[0].User_has_Group.groupId2).to.be.ok;
      if (dialect === 'db2') {
        expect(groups[0].users[0].User_has_Group.groupId2).to.deep.equal(groups[0].groupSecondId);
      } else {
        expect(groups[0].users[0].User_has_Group.groupId2).to.equal(groups[0].groupSecondId);
      }

      expect(groups[0].users[0].User_has_Group.userId2).to.be.ok;
      if (dialect === 'db2') {
        expect(groups[0].users[0].User_has_Group.userId2).to.deep.equal(
          groups[0].users[0].userSecondId,
        );
      } else {
        expect(groups[0].users[0].User_has_Group.userId2).to.equal(groups[0].users[0].userSecondId);
      }

      expect(groups[1].users[0].User_has_Group.groupId2).to.be.ok;
      if (dialect === 'db2') {
        expect(groups[1].users[0].User_has_Group.groupId2).to.deep.equal(groups[1].groupSecondId);
      } else {
        expect(groups[1].users[0].User_has_Group.groupId2).to.equal(groups[1].groupSecondId);
      }

      expect(groups[1].users[0].User_has_Group.userId2).to.be.ok;
      if (dialect === 'db2') {
        expect(groups[1].users[0].User_has_Group.userId2).to.deep.equal(
          groups[1].users[0].userSecondId,
        );
      } else {
        expect(groups[1].users[0].User_has_Group.userId2).to.equal(groups[1].users[0].userSecondId);
      }
    });

    it('supports primary key attributes with different field names where parent include is required', async function () {
      const User = this.sequelize.define(
        'User',
        {
          id: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
            defaultValue: sql.uuidV4,
            field: 'user_id',
          },
        },
        {
          tableName: 'tbl_user',
        },
      );

      const Company = this.sequelize.define(
        'Company',
        {
          id: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
            defaultValue: sql.uuidV4,
            field: 'company_id',
          },
        },
        {
          tableName: 'tbl_company',
        },
      );

      const Group = this.sequelize.define(
        'Group',
        {
          id: {
            type: DataTypes.UUID,
            allowNull: false,
            primaryKey: true,
            defaultValue: sql.uuidV4,
            field: 'group_id',
          },
        },
        {
          tableName: 'tbl_group',
        },
      );

      const Company_has_Group = this.sequelize.define(
        'Company_has_Group',
        {},
        {
          tableName: 'tbl_company_has_group',
        },
      );

      User.belongsTo(Company);
      Company.hasMany(User);
      Company.belongsToMany(Group, { through: Company_has_Group });
      Group.belongsToMany(Company, { through: Company_has_Group });

      await this.sequelize.sync({ force: true });
      const [user, group, company] = await Promise.all([
        User.create(),
        Group.create(),
        Company.create(),
      ]);
      await Promise.all([user.setCompany(company), company.addGroup(group)]);

      await Promise.all([
        User.findOne({
          where: {},
          include: [{ model: Company, include: [Group] }],
        }),
        User.findAll({
          include: [{ model: Company, include: [Group] }],
        }),
        User.findOne({
          where: {},
          include: [{ model: Company, required: true, include: [Group] }],
        }),
        User.findAll({
          include: [{ model: Company, required: true, include: [Group] }],
        }),
      ]);
    });
  });

  describe('hasAssociations', () => {
    beforeEach(function () {
      this.Article = this.sequelize.define('Article', {
        pk: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        title: DataTypes.STRING,
      });
      this.Label = this.sequelize.define('Label', {
        sk: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        text: DataTypes.STRING,
      });
      this.ArticleLabel = this.sequelize.define('ArticleLabel');
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', async function () {
        const sequelize = await Support.createSingleTransactionalTestSequelizeInstance(
          this.sequelize,
        );
        const Article = sequelize.define('Article', { title: DataTypes.STRING });
        const Label = sequelize.define('Label', { text: DataTypes.STRING });

        Article.belongsToMany(Label, { through: 'ArticleLabels' });
        Label.belongsToMany(Article, { through: 'ArticleLabels' });

        await sequelize.sync({ force: true });

        const [article, label, t] = await Promise.all([
          Article.create({ title: 'foo' }),
          Label.create({ text: 'bar' }),
          sequelize.startUnmanagedTransaction(),
        ]);

        try {
          await article.setLabels([label], { transaction: t });
          const articles0 = await Article.findAll({ transaction: t });
          const labels0 = await articles0[0].getLabels();
          expect(labels0).to.have.length(0);
          const articles = await Article.findAll({ transaction: t });
          const labels = await articles[0].getLabels({ transaction: t });
          expect(labels).to.have.length(1);
        } finally {
          await t.rollback();
        }
      });
    }

    it('answers false if only some labels have been assigned', async function () {
      this.Article.belongsToMany(this.Label, { through: this.ArticleLabel });
      this.Label.belongsToMany(this.Article, { through: this.ArticleLabel });

      await this.sequelize.sync({ force: true });

      const [article, label1, label2] = await Promise.all([
        this.Article.create({ title: 'Article' }),
        this.Label.create({ text: 'Awesomeness' }),
        this.Label.create({ text: 'Epicness' }),
      ]);

      await article.addLabel(label1);
      const result = await article.hasLabels([label1, label2]);
      expect(result).to.be.false;
    });

    it('answers false if only some labels have been assigned when passing a primary key instead of an object', async function () {
      this.Article.belongsToMany(this.Label, { through: this.ArticleLabel });
      this.Label.belongsToMany(this.Article, { through: this.ArticleLabel });

      await this.sequelize.sync({ force: true });

      const [article, label1, label2] = await Promise.all([
        this.Article.create({ title: 'Article' }),
        this.Label.create({ text: 'Awesomeness' }),
        this.Label.create({ text: 'Epicness' }),
      ]);

      await article.addLabels([label1]);

      const result = await article.hasLabels([
        label1[this.Label.primaryKeyAttribute],
        label2[this.Label.primaryKeyAttribute],
      ]);

      expect(result).to.be.false;
    });

    it('answers true if all label have been assigned', async function () {
      this.Article.belongsToMany(this.Label, { through: this.ArticleLabel });
      this.Label.belongsToMany(this.Article, { through: this.ArticleLabel });

      await this.sequelize.sync({ force: true });

      const [article, label1, label2] = await Promise.all([
        this.Article.create({ title: 'Article' }),
        this.Label.create({ text: 'Awesomeness' }),
        this.Label.create({ text: 'Epicness' }),
      ]);

      await article.setLabels([label1, label2]);
      const result = await article.hasLabels([label1, label2]);
      expect(result).to.be.true;
    });

    it('answers true if all label have been assigned when passing a primary key instead of an object', async function () {
      this.Article.belongsToMany(this.Label, { through: this.ArticleLabel });
      this.Label.belongsToMany(this.Article, { through: this.ArticleLabel });

      await this.sequelize.sync({ force: true });

      const [article, label1, label2] = await Promise.all([
        this.Article.create({ title: 'Article' }),
        this.Label.create({ text: 'Awesomeness' }),
        this.Label.create({ text: 'Epicness' }),
      ]);

      await article.setLabels([label1, label2]);

      const result = await article.hasLabels([
        label1[this.Label.primaryKeyAttribute],
        label2[this.Label.primaryKeyAttribute],
      ]);

      expect(result).to.be.true;
    });

    it('answers true for labels that have been assigned multitple times', async function () {
      this.ArticleLabel = this.sequelize.define('ArticleLabel', {
        id: {
          primaryKey: true,
          type: DataTypes.INTEGER,
          autoIncrement: true,
        },
        relevance: {
          type: DataTypes.FLOAT,
          validate: {
            min: 0,
            max: 1,
          },
        },
      });

      this.Article.belongsToMany(this.Label, {
        through: { model: this.ArticleLabel, unique: false },
      });
      this.Label.belongsToMany(this.Article, {
        through: { model: this.ArticleLabel, unique: false },
      });

      await this.sequelize.sync({ force: true });

      const [article0, label10, label20] = await Promise.all([
        this.Article.create({ title: 'Article' }),
        this.Label.create({ text: 'Awesomeness' }),
        this.Label.create({ text: 'Epicness' }),
      ]);

      const [article, label1, label2] = await Promise.all([
        article0,
        label10,
        label20,
        article0.addLabel(label10, {
          through: { relevance: 1 },
        }),
        article0.addLabel(label20, {
          through: { relevance: 0.54 },
        }),
        article0.addLabel(label20, {
          through: { relevance: 0.99 },
        }),
      ]);

      const result = await article.hasLabels([label1, label2]);

      await expect(result).to.be.true;
    });

    it('answers true for labels that have been assigned multitple times when passing a primary key instead of an object', async function () {
      this.ArticleLabel = this.sequelize.define('ArticleLabel', {
        id: {
          primaryKey: true,
          type: DataTypes.INTEGER,
          autoIncrement: true,
        },
        relevance: {
          type: DataTypes.FLOAT,
          validate: {
            min: 0,
            max: 1,
          },
        },
      });

      this.Article.belongsToMany(this.Label, {
        through: { model: this.ArticleLabel, unique: false },
      });
      this.Label.belongsToMany(this.Article, {
        through: { model: this.ArticleLabel, unique: false },
      });

      await this.sequelize.sync({ force: true });

      const [article0, label10, label20] = await Promise.all([
        this.Article.create({ title: 'Article' }),
        this.Label.create({ text: 'Awesomeness' }),
        this.Label.create({ text: 'Epicness' }),
      ]);

      const [article, label1, label2] = await Promise.all([
        article0,
        label10,
        label20,
        article0.addLabel(label10, {
          through: { relevance: 1 },
        }),
        article0.addLabel(label20, {
          through: { relevance: 0.54 },
        }),
        article0.addLabel(label20, {
          through: { relevance: 0.99 },
        }),
      ]);

      const result = await article.hasLabels([
        label1[this.Label.primaryKeyAttribute],
        label2[this.Label.primaryKeyAttribute],
      ]);

      await expect(result).to.be.true;
    });
  });

  describe('hasAssociations with binary key', () => {
    beforeEach(function () {
      const keyDataType = ['mysql', 'mariadb', 'db2', 'ibmi'].includes(dialect)
        ? 'BINARY(255)'
        : DataTypes.BLOB('tiny');
      this.Article = this.sequelize.define('Article', {
        id: {
          type: keyDataType,
          primaryKey: true,
        },
      });
      this.Label = this.sequelize.define('Label', {
        id: {
          type: keyDataType,
          primaryKey: true,
        },
      });
      this.ArticleLabel = this.sequelize.define('ArticleLabel');

      this.Article.belongsToMany(this.Label, { through: this.ArticleLabel });
      this.Label.belongsToMany(this.Article, { through: this.ArticleLabel });

      return this.sequelize.sync({ force: true });
    });

    // article.hasLabels returns false for db2 despite article has label
    // Problably due to binary id. Hence, disabling it for db2 dialect
    if (dialect !== 'db2') {
      it('answers true for labels that have been assigned', async function () {
        const [article, label] = await Promise.all([
          this.Article.create({
            // note that mariadb appends binary values at the end https://mariadb.com/kb/en/binary/
            id: Buffer.alloc(255),
          }),
          this.Label.create({
            id: Buffer.alloc(255),
          }),
        ]);

        await article.addLabel(label);
        const result = await article.hasLabels([label]);
        await expect(result).to.be.true;
      });
    }

    it('answer false for labels that have not been assigned', async function () {
      const [article, label] = await Promise.all([
        this.Article.create({
          id: Buffer.alloc(255),
        }),
        this.Label.create({
          id: Buffer.alloc(255),
        }),
      ]);

      const result = await article.hasLabels([label]);
      expect(result).to.be.false;
    });
  });

  describe('countAssociations', () => {
    beforeEach(async function () {
      this.User = this.sequelize.define('User', {
        username: DataTypes.STRING,
      });
      this.Task = this.sequelize.define('Task', {
        title: DataTypes.STRING,
        active: DataTypes.BOOLEAN,
      });
      this.UserTask = this.sequelize.define('UserTask', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        started: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
        },
      });

      this.User.belongsToMany(this.Task, { through: this.UserTask });
      this.Task.belongsToMany(this.User, { through: this.UserTask });

      await this.sequelize.sync({ force: true });

      const [john, task1, task2] = await Promise.all([
        this.User.create({ username: 'John' }),
        this.Task.create({ title: 'Get rich', active: true }),
        this.Task.create({ title: 'Die trying', active: false }),
      ]);

      this.tasks = [task1, task2];
      this.user = john;

      return john.setTasks([task1, task2]);
    });

    it('should count all associations', async function () {
      expect(await this.user.countTasks({})).to.equal(2);
    });

    it('should count filtered associations', async function () {
      expect(await this.user.countTasks({ where: { active: true } })).to.equal(1);
    });

    it('should count scoped associations', async function () {
      this.User.belongsToMany(this.Task, {
        as: 'activeTasks',
        through: this.UserTask,
        scope: {
          active: true,
        },
      });

      expect(await this.user.countActiveTasks({})).to.equal(1);
    });

    it('should count scoped through associations', async function () {
      this.User.belongsToMany(this.Task, {
        as: 'startedTasks',
        inverse: {
          as: 'startedUsers',
        },
        through: {
          model: this.UserTask,
          scope: {
            started: true,
          },
        },
      });

      for (let i = 0; i < 2; i++) {
        await this.user.addTask(await this.Task.create(), {
          through: { started: true },
        });
      }

      expect(await this.user.countStartedTasks({})).to.equal(2);
    });
  });

  describe('setAssociations', () => {
    it('clears associations when passing null to the set-method', async function () {
      const User = this.sequelize.define('User', { username: DataTypes.STRING });
      const Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      User.belongsToMany(Task, { through: 'UserTasks' });
      Task.belongsToMany(User, { through: 'UserTasks' });

      await this.sequelize.sync({ force: true });

      const [user, task] = await Promise.all([
        User.create({ username: 'foo' }),
        Task.create({ title: 'task' }),
      ]);

      await task.setUsers([user]);
      const _users0 = await task.getUsers();
      expect(_users0).to.have.length(1);

      await task.setUsers(null);
      const _users = await task.getUsers();
      expect(_users).to.have.length(0);
    });

    it('should be able to set twice with custom primary keys', async function () {
      const User = this.sequelize.define('User', {
        uid: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        username: DataTypes.STRING,
      });
      const Task = this.sequelize.define('Task', {
        tid: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        title: DataTypes.STRING,
      });

      User.belongsToMany(Task, { through: 'UserTasks' });
      Task.belongsToMany(User, { through: 'UserTasks' });

      await this.sequelize.sync({ force: true });

      const [user1, user2, task] = await Promise.all([
        User.create({ username: 'foo' }),
        User.create({ username: 'bar' }),
        Task.create({ title: 'task' }),
      ]);

      await task.setUsers([user1]);
      user2.user_has_task = { usertitle: 'Something' };
      await task.setUsers([user1, user2]);
      const _users = await task.getUsers();
      expect(_users).to.have.length(2);
    });

    it('joins an association with custom primary keys', async function () {
      const Group = this.sequelize.define('group', {
        group_id: { type: DataTypes.INTEGER, primaryKey: true },
        name: DataTypes.STRING(64),
      });
      const Member = this.sequelize.define('member', {
        member_id: { type: DataTypes.INTEGER, primaryKey: true },
        email: DataTypes.STRING(64),
      });

      Group.belongsToMany(Member, {
        through: 'group_members',
        foreignKey: 'group_id',
        otherKey: 'member_id',
      });
      Member.belongsToMany(Group, {
        through: 'group_members',
        foreignKey: 'member_id',
        otherKey: 'group_id',
      });

      await this.sequelize.sync({ force: true });

      const [group0, member] = await Promise.all([
        Group.create({ group_id: 1, name: 'Group1' }),
        Member.create({ member_id: 10, email: 'team@sequelizejs.com' }),
      ]);

      await group0.addMember(member);
      const group = group0;
      const members = await group.getMembers();
      expect(members).to.be.instanceof(Array);
      expect(members).to.have.length(1);
      expect(members[0].member_id).to.equal(10);
      expect(members[0].email).to.equal('team@sequelizejs.com');
    });

    it('supports passing the primary key instead of an object', async function () {
      const User = this.sequelize.define('User', { username: DataTypes.STRING });
      const Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      User.belongsToMany(Task, { through: 'UserTasks' });
      Task.belongsToMany(User, { through: 'UserTasks' });

      await this.sequelize.sync({ force: true });

      const [user, task1, task2] = await Promise.all([
        User.create({ id: 12 }),
        Task.create({ id: 50, title: 'get started' }),
        Task.create({ id: 5, title: 'wat' }),
      ]);

      await user.addTask(task1.id);
      await user.setTasks([task2.id]);
      const tasks = await user.getTasks();
      expect(tasks).to.have.length(1);
      expect(tasks[0].title).to.equal('wat');
    });

    it('using scope to set associations', async function () {
      const ItemTag = this.sequelize.define('ItemTag', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        tag_id: { type: DataTypes.INTEGER, unique: false },
        taggable: { type: DataTypes.STRING },
        taggable_id: { type: DataTypes.INTEGER, unique: false },
      });
      const Tag = this.sequelize.define('Tag', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: DataTypes.STRING,
      });
      const Comment = this.sequelize.define('Comment', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: DataTypes.STRING,
      });
      const Post = this.sequelize.define('Post', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: DataTypes.STRING,
      });

      Post.belongsToMany(Tag, {
        through: { model: ItemTag, unique: false, scope: { taggable: 'post' } },
        foreignKey: 'taggable_id',
      });

      Comment.belongsToMany(Tag, {
        through: { model: ItemTag, unique: false, scope: { taggable: 'comment' } },
        foreignKey: 'taggable_id',
        // taggable_id already references Post, we can't make it reference Comment
        foreignKeyConstraints: false,
      });

      await this.sequelize.sync({ force: true });

      const [post, comment, tag] = await Promise.all([
        Post.create({ name: 'post1' }),
        Comment.create({ name: 'comment1' }),
        Tag.create({ name: 'tag1' }),
      ]);

      this.post = post;
      this.comment = comment;
      this.tag = tag;
      await this.post.setTags([this.tag]);
      await this.comment.setTags([this.tag]);

      const [postTags, commentTags] = await Promise.all([
        this.post.getTags(),
        this.comment.getTags(),
      ]);

      expect(postTags).to.have.length(1);
      expect(commentTags).to.have.length(1);
    });

    it('updating association via set associations with scope', async function () {
      const ItemTag = this.sequelize.define('ItemTag', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        tag_id: { type: DataTypes.INTEGER, unique: false },
        taggable: { type: DataTypes.STRING },
        taggable_id: { type: DataTypes.INTEGER, unique: false },
      });
      const Tag = this.sequelize.define('Tag', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: DataTypes.STRING,
      });
      const Comment = this.sequelize.define('Comment', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: DataTypes.STRING,
      });
      const Post = this.sequelize.define('Post', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        name: DataTypes.STRING,
      });

      Post.belongsToMany(Tag, {
        through: { model: ItemTag, unique: false, scope: { taggable: 'post' } },
        foreignKey: 'taggable_id',
      });

      Comment.belongsToMany(Tag, {
        through: { model: ItemTag, unique: false, scope: { taggable: 'comment' } },
        foreignKey: 'taggable_id',
        // taggable_id already references Post, we can't make it reference Comment
        foreignKeyConstraints: false,
      });

      await this.sequelize.sync({ force: true });

      const [post, comment, tag, secondTag] = await Promise.all([
        Post.create({ name: 'post1' }),
        Comment.create({ name: 'comment1' }),
        Tag.create({ name: 'tag1' }),
        Tag.create({ name: 'tag2' }),
      ]);

      await post.setTags([tag, secondTag]);
      await comment.setTags([tag, secondTag]);
      await post.setTags([tag]);

      const [postTags, commentTags] = await Promise.all([post.getTags(), comment.getTags()]);

      expect(postTags).to.have.length(1);
      expect(commentTags).to.have.length(2);
    });

    it('should catch EmptyResultError when rejectOnEmpty is set', async function () {
      const User = this.sequelize.define(
        'User',
        { username: DataTypes.STRING },
        { rejectOnEmpty: true },
      );
      const Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      User.belongsToMany(Task, { through: 'UserTasks' });
      Task.belongsToMany(User, { through: 'UserTasks' });

      await this.sequelize.sync({ force: true });

      const [user0, task1, task2] = await Promise.all([
        User.create({ id: 12 }),
        Task.create({ id: 50, title: 'get started' }),
        Task.create({ id: 51, title: 'following up' }),
      ]);

      await user0.setTasks([task1, task2]);
      const user = user0;
      const userTasks = await user.getTasks();
      expect(userTasks).to.be.an('array').that.has.a.lengthOf(2);
      expect(userTasks[0]).to.be.an.instanceOf(Task);
    });
  });

  describe('createAssociations', () => {
    it('creates a new associated object', async function () {
      const User = this.sequelize.define('User', { username: DataTypes.STRING });
      const Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      User.belongsToMany(Task, { through: 'UserTasks' });
      Task.belongsToMany(User, { through: 'UserTasks' });

      await this.sequelize.sync({ force: true });
      const task = await Task.create({ title: 'task' });
      const createdUser = await task.createUser({ username: 'foo' });
      expect(createdUser).to.be.instanceof(User);
      expect(createdUser.username).to.equal('foo');
      const _users = await task.getUsers();
      expect(_users).to.have.length(1);
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', async function () {
        const sequelize = await Support.createSingleTransactionalTestSequelizeInstance(
          this.sequelize,
        );
        const User = sequelize.define('User', { username: DataTypes.STRING });
        const Task = sequelize.define('Task', { title: DataTypes.STRING });

        User.belongsToMany(Task, { through: 'UserTasks' });
        Task.belongsToMany(User, { through: 'UserTasks' });

        await sequelize.sync({ force: true });

        const [task, t] = await Promise.all([
          Task.create({ title: 'task' }),
          sequelize.startUnmanagedTransaction(),
        ]);

        await task.createUser({ username: 'foo' }, { transaction: t });
        const users0 = await task.getUsers();
        expect(users0).to.have.length(0);

        const users = await task.getUsers({ transaction: t });
        expect(users).to.have.length(1);
        await t.rollback();
      });
    }

    it('supports setting through table attributes', async function () {
      const User = this.sequelize.define('user', {});
      const Group = this.sequelize.define('group', {});
      const UserGroups = this.sequelize.define('user_groups', {
        isAdmin: DataTypes.BOOLEAN,
      });

      User.belongsToMany(Group, { through: UserGroups });
      Group.belongsToMany(User, { through: UserGroups });

      await this.sequelize.sync({ force: true });
      const group = await Group.create({});

      await Promise.all([
        group.createUser({ id: 1 }, { through: { isAdmin: true } }),
        group.createUser({ id: 2 }, { through: { isAdmin: false } }),
      ]);

      const userGroups = await UserGroups.findAll();
      userGroups.sort((a, b) => {
        return a.userId < b.userId ? -1 : 1;
      });
      expect(userGroups[0].userId).to.equal(1);
      expect(userGroups[0].isAdmin).to.be.ok;
      expect(userGroups[1].userId).to.equal(2);
      expect(userGroups[1].isAdmin).not.to.be.ok;
    });

    it('supports using the field parameter', async function () {
      const User = this.sequelize.define('User', { username: DataTypes.STRING });
      const Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      User.belongsToMany(Task, { through: 'UserTasks' });
      Task.belongsToMany(User, { through: 'UserTasks' });

      await this.sequelize.sync({ force: true });
      const task = await Task.create({ title: 'task' });
      const createdUser = await task.createUser({ username: 'foo' }, { fields: ['username'] });
      expect(createdUser).to.be.instanceof(User);
      expect(createdUser.username).to.equal('foo');
      const _users = await task.getUsers();
      expect(_users).to.have.length(1);
    });
  });

  describe('addAssociations', () => {
    it('supports both single instance and array', async function () {
      const User = this.sequelize.define('User', { username: DataTypes.STRING });
      const Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      User.belongsToMany(Task, { through: 'UserTasks' });
      Task.belongsToMany(User, { through: 'UserTasks' });

      await this.sequelize.sync({ force: true });

      const [user0, task1, task2] = await Promise.all([
        User.create({ id: 12 }),
        Task.create({ id: 50, title: 'get started' }),
        Task.create({ id: 52, title: 'get done' }),
      ]);

      await Promise.all([user0.addTask(task1), user0.addTask([task2])]);

      const user = user0;
      const tasks = await user.getTasks();
      expect(tasks).to.have.length(2);
      expect(tasks.find(item => item.title === 'get started')).to.be.ok;
      expect(tasks.find(item => item.title === 'get done')).to.be.ok;
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', async function () {
        const sequelize = await Support.createSingleTransactionalTestSequelizeInstance(
          this.sequelize,
        );
        const User = sequelize.define('User', { username: DataTypes.STRING });
        const Task = sequelize.define('Task', { title: DataTypes.STRING });

        User.belongsToMany(Task, { through: 'UserTasks' });
        Task.belongsToMany(User, { through: 'UserTasks' });

        await sequelize.sync({ force: true });

        const [user, task, t] = await Promise.all([
          User.create({ username: 'foo' }),
          Task.create({ title: 'task' }),
          sequelize.startUnmanagedTransaction(),
        ]);

        await task.addUser(user, { transaction: t });
        const hasUser0 = await task.hasUser(user);
        expect(hasUser0).to.be.false;
        const hasUser = await task.hasUser(user, { transaction: t });
        expect(hasUser).to.be.true;
        await t.rollback();
      });

      it('supports transactions when updating a through model', async function () {
        const sequelize = await Support.createSingleTransactionalTestSequelizeInstance(
          this.sequelize,
        );
        const User = sequelize.define('User', { username: DataTypes.STRING });
        const Task = sequelize.define('Task', { title: DataTypes.STRING });

        const UserTask = sequelize.define('UserTask', {
          status: DataTypes.STRING,
        });

        User.belongsToMany(Task, { through: UserTask, as: 'Tasks', inverse: 'Users' });
        await sequelize.sync({ force: true });

        const [user, task, t] = await Promise.all([
          User.create({ username: 'foo' }),
          Task.create({ title: 'task' }),
          sequelize.startUnmanagedTransaction({ isolationLevel: IsolationLevel.SERIALIZABLE }),
        ]);

        await task.addUser(user, { through: { status: 'pending' } }); // Create without transaction, so the old value is
        // accesible from outside the transaction
        await task.addUser(user, { transaction: t, through: { status: 'completed' } }); // Add an already exisiting user in
        // a transaction, updating a value
        // in the join table

        const [tasks, transactionTasks] = await Promise.all([
          user.getTasks(),
          user.getTasks({ transaction: t }),
        ]);

        expect(tasks[0].UserTask.status).to.equal('pending');
        expect(transactionTasks[0].UserTask.status).to.equal('completed');

        await t.rollback();
      });
    }

    it('supports passing the primary key instead of an object', async function () {
      const User = this.sequelize.define('User', { username: DataTypes.STRING });
      const Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      User.belongsToMany(Task, { through: 'UserTasks', as: 'Tasks', inverse: 'Users' });

      await this.sequelize.sync({ force: true });

      const [user0, task] = await Promise.all([
        User.create({ id: 12 }),
        Task.create({ id: 50, title: 'get started' }),
      ]);

      await user0.addTask(task.id);
      const user = user0;
      const tasks = await user.getTasks();
      expect(tasks[0].title).to.equal('get started');
    });

    it('should not pass indexes to the join table', async function () {
      const User = this.sequelize.define(
        'User',
        { username: DataTypes.STRING },
        {
          indexes: [
            {
              name: 'username_unique',
              unique: true,
              method: 'BTREE',
              fields: ['username'],
            },
          ],
        },
      );
      const Task = this.sequelize.define(
        'Task',
        { title: DataTypes.STRING },
        {
          indexes: [
            {
              name: 'title_index',
              method: 'BTREE',
              fields: ['title'],
            },
          ],
        },
      );
      // create associations
      User.belongsToMany(Task, { through: 'UserTasks' });
      Task.belongsToMany(User, { through: 'UserTasks' });
      await this.sequelize.sync({ force: true });
    });

    it('should catch EmptyResultError when rejectOnEmpty is set', async function () {
      const User = this.sequelize.define(
        'User',
        { username: DataTypes.STRING },
        { rejectOnEmpty: true },
      );
      const Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      User.belongsToMany(Task, { through: 'UserTasks' });
      Task.belongsToMany(User, { through: 'UserTasks' });

      await this.sequelize.sync({ force: true });

      const [user0, task] = await Promise.all([
        User.create({ id: 12 }),
        Task.create({ id: 50, title: 'get started' }),
      ]);

      await user0.addTask(task);
      const user = user0;
      const tasks = await user.getTasks();
      expect(tasks[0].title).to.equal('get started');
    });
  });

  describe('addMultipleAssociations', () => {
    it('supports both single instance and array', async function () {
      const User = this.sequelize.define('User', { username: DataTypes.STRING });
      const Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      User.belongsToMany(Task, { through: 'UserTasks' });
      Task.belongsToMany(User, { through: 'UserTasks' });

      await this.sequelize.sync({ force: true });

      const [user0, task1, task2] = await Promise.all([
        User.create({ id: 12 }),
        Task.create({ id: 50, title: 'get started' }),
        Task.create({ id: 52, title: 'get done' }),
      ]);

      await Promise.all([user0.addTasks(task1), user0.addTasks([task2])]);

      const user = user0;
      const tasks = await user.getTasks();
      expect(tasks).to.have.length(2);
      expect(
        tasks.some(item => {
          return item.title === 'get started';
        }),
      ).to.be.ok;
      expect(
        tasks.some(item => {
          return item.title === 'get done';
        }),
      ).to.be.ok;
    });

    it('adds associations without removing the current ones', async function () {
      const User = this.sequelize.define('User', { username: DataTypes.STRING });
      const Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      User.belongsToMany(Task, { through: 'UserTasks' });
      Task.belongsToMany(User, { through: 'UserTasks' });

      await this.sequelize.sync({ force: true });

      await User.bulkCreate([{ username: 'foo ' }, { username: 'bar ' }, { username: 'baz ' }]);

      const [task, users1] = await Promise.all([Task.create({ title: 'task' }), User.findAll()]);

      const users = users1;
      await task.setUsers([users1[0]]);
      await task.addUsers([users[1], users[2]]);
      const users0 = await task.getUsers();
      expect(users0).to.have.length(3);

      // Re-add user 0's object, this should be harmless
      // Re-add user 0's id, this should be harmless

      await Promise.all([
        expect(task.addUsers([users[0]])).not.to.be.rejected,
        expect(task.addUsers([users[0].id])).not.to.be.rejected,
      ]);

      expect(await task.getUsers()).to.have.length(3);
    });
  });

  describe('through model validations', () => {
    beforeEach(async function () {
      const Project = this.sequelize.define('Project', {
        name: DataTypes.STRING,
      });

      const Employee = this.sequelize.define('Employee', {
        name: DataTypes.STRING,
      });

      const Participation = this.sequelize.define('Participation', {
        role: {
          type: DataTypes.STRING,
          allowNull: false,
          validate: {
            len: {
              args: [2, 50],
              msg: 'too bad',
            },
          },
        },
      });

      Project.belongsToMany(Employee, {
        as: 'Participants',
        through: Participation,
        inverse: { as: 'Projects' },
      });

      await this.sequelize.sync({ force: true });

      const [project, employee] = await Promise.all([
        Project.create({ name: 'project 1' }),
        Employee.create({ name: 'employee 1' }),
      ]);

      this.project = project;
      this.employee = employee;
    });

    it('runs on add', async function () {
      await expect(this.project.addParticipant(this.employee, { through: { role: '' } })).to.be
        .rejected;
    });

    it('runs on set', async function () {
      await expect(this.project.setParticipants([this.employee], { through: { role: '' } })).to.be
        .rejected;
    });

    it('runs on create', async function () {
      await expect(
        this.project.createParticipant({ name: 'employee 2' }, { through: { role: '' } }),
      ).to.be.rejected;
    });
  });

  describe('optimizations using bulk create, destroy and update', () => {
    beforeEach(function () {
      this.User = this.sequelize.define(
        'User',
        { username: DataTypes.STRING },
        { timestamps: false },
      );
      this.Task = this.sequelize.define('Task', { title: DataTypes.STRING }, { timestamps: false });

      this.User.belongsToMany(this.Task, { through: 'UserTasks' });
      this.Task.belongsToMany(this.User, { through: 'UserTasks' });

      return this.sequelize.sync({ force: true });
    });

    it('uses one insert into statement', async function () {
      const spy = sinon.spy();

      const [user, task1, task2] = await Promise.all([
        this.User.create({ username: 'foo' }),
        this.Task.create({ id: 12, title: 'task1' }),
        this.Task.create({ id: 15, title: 'task2' }),
      ]);

      await user.setTasks([task1, task2], {
        logging: spy,
      });

      expect(spy.calledTwice).to.be.ok;
    });

    it('uses one delete from statement', async function () {
      const spy = sinon.spy();

      const [user0, task1, task2] = await Promise.all([
        this.User.create({ username: 'foo' }),
        this.Task.create({ title: 'task1' }),
        this.Task.create({ title: 'task2' }),
      ]);

      await user0.setTasks([task1, task2]);
      const user = user0;

      await user.setTasks(null, {
        logging: spy,
      });

      expect(spy.calledTwice).to.be.ok;
    });
  }); // end optimization using bulk create, destroy and update

  describe('join table creation', () => {
    beforeEach(function () {
      this.User = this.sequelize.define(
        'User',
        { username: DataTypes.STRING },
        { tableName: 'users' },
      );
      this.Task = this.sequelize.define(
        'Task',
        { title: DataTypes.STRING },
        { tableName: 'tasks' },
      );

      this.User.belongsToMany(this.Task, { through: 'user_has_tasks' });
      this.Task.belongsToMany(this.User, { through: 'user_has_tasks' });

      return this.sequelize.sync({ force: true });
    });

    it('should work with non integer primary keys', async function () {
      const Beacons = this.sequelize.define('Beacon', {
        id: {
          primaryKey: true,
          type: DataTypes.UUID,
          defaultValue: sql.uuidV4,
        },
        name: {
          type: DataTypes.STRING,
        },
      });

      // User not to clash with the beforeEach definition
      const Users = this.sequelize.define('Usar', {
        name: {
          type: DataTypes.STRING,
        },
      });

      Beacons.belongsToMany(Users, { through: 'UserBeacons' });
      Users.belongsToMany(Beacons, { through: 'UserBeacons' });

      await this.sequelize.sync({ force: true });
    });

    it('makes join table non-paranoid by default', () => {
      const paranoidSequelize = Support.createSingleTestSequelizeInstance({
        define: {
          paranoid: true,
        },
      });
      const ParanoidUser = paranoidSequelize.define('ParanoidUser', {});
      const ParanoidTask = paranoidSequelize.define('ParanoidTask', {});

      const taskAssociation = ParanoidUser.belongsToMany(ParanoidTask, { through: 'UserTasks' });
      const userAssociation = ParanoidTask.belongsToMany(ParanoidUser, { through: 'UserTasks' });

      expect(ParanoidUser.options.paranoid).to.be.ok;
      expect(ParanoidTask.options.paranoid).to.be.ok;
      expect(userAssociation.throughModel).to.equal(taskAssociation.throughModel);
      expect(userAssociation.throughModel.options.paranoid).not.to.be.ok;
    });

    it('should allow creation of a paranoid join table', () => {
      const paranoidSequelize = Support.createSingleTestSequelizeInstance({
        define: {
          paranoid: true,
        },
      });
      const ParanoidUser = paranoidSequelize.define('ParanoidUser', {});
      const ParanoidTask = paranoidSequelize.define('ParanoidTask', {});

      const taskAssociation = ParanoidUser.belongsToMany(ParanoidTask, {
        through: {
          model: 'UserTasks',
          paranoid: true,
        },
      });
      const userAssociation = ParanoidTask.belongsToMany(ParanoidUser, {
        through: {
          model: 'UserTasks',
          paranoid: true,
        },
      });

      expect(ParanoidUser.options.paranoid).to.be.ok;
      expect(ParanoidTask.options.paranoid).to.be.ok;
      expect(userAssociation.throughModel).to.equal(taskAssociation.throughModel);
      expect(userAssociation.throughModel.options.paranoid).to.be.ok;
    });
  });

  describe('foreign keys', () => {
    it('generates camelCase foreign keys if underscored is not set on the through model', function () {
      const User = this.sequelize.define(
        'User',
        {},
        {
          tableName: 'users',
          underscored: true,
          timestamps: false,
        },
      );

      const Place = this.sequelize.define(
        'Place',
        {},
        {
          tableName: 'places',
          underscored: true,
          timestamps: false,
        },
      );

      User.belongsToMany(Place, { through: 'user_places' });
      Place.belongsToMany(User, { through: 'user_places' });

      const attributes = this.sequelize.models.getOrThrow('user_places').getAttributes();

      expect(attributes.placeId.field).to.equal('placeId');
      expect(attributes.userId.field).to.equal('userId');
    });

    it('generates snake_case foreign keys if underscored is set on the through model', function () {
      const User = this.sequelize.define('User', {}, { timestamps: false });
      const Place = this.sequelize.define('Place', {}, { timestamps: false });
      const UserPlaces = this.sequelize.define(
        'UserPlaces',
        {},
        { underscored: true, timestamps: false },
      );

      User.belongsToMany(Place, { through: UserPlaces });
      Place.belongsToMany(User, { through: UserPlaces });

      const attributes = UserPlaces.getAttributes();

      expect(attributes.placeId.field).to.equal('place_id');
      expect(attributes.userId.field).to.equal('user_id');
    });

    it('should infer otherKey from paired BTM relationship with a through string defined', function () {
      const User = this.sequelize.define('User', {});
      const Place = this.sequelize.define('Place', {});

      const Places = User.belongsToMany(Place, {
        through: 'user_places',
        foreignKey: 'user_id',
        otherKey: 'place_id',
      });

      expect(Places.foreignKey).to.equal('user_id');
      expect(Places.pairedWith.foreignKey).to.equal('place_id');

      expect(Places.otherKey).to.equal('place_id');
      expect(Places.pairedWith.otherKey).to.equal('user_id');
    });
  });

  describe('foreign key with fields specified', () => {
    beforeEach(function () {
      this.User = this.sequelize.define('User', { name: DataTypes.STRING });
      this.Project = this.sequelize.define('Project', { name: DataTypes.STRING });
      this.Puppy = this.sequelize.define('Puppy', { breed: DataTypes.STRING });

      this.User.belongsToMany(this.Project, {
        through: 'user_projects',
        as: 'Projects',
        inverse: {
          as: 'Users',
        },
        foreignKey: {
          field: 'user_id',
          name: 'userId',
        },
        otherKey: {
          field: 'project_id',
          name: 'projectId',
        },
      });
    });

    it('should correctly get associations even after a child instance is deleted', async function () {
      const spy = sinon.spy();

      await this.sequelize.sync({ force: true });

      const [user3, project1, project2] = await Promise.all([
        this.User.create({ name: 'Matt' }),
        this.Project.create({ name: 'Good Will Hunting' }),
        this.Project.create({ name: 'The Departed' }),
      ]);

      await user3.addProjects([project1, project2], {
        logging: spy,
      });

      const user2 = user3;
      expect(spy).to.have.been.calledTwice;
      spy.resetHistory();

      const [user1, projects0] = await Promise.all([
        user2,
        user2.getProjects({
          logging: spy,
        }),
      ]);

      expect(spy.calledOnce).to.be.ok;
      const project0 = projects0[0];
      expect(project0).to.be.ok;
      await project0.destroy();
      const user0 = user1;

      const user = await this.User.findOne({
        where: { id: user0.id },
        include: [{ model: this.Project, as: 'Projects' }],
      });

      const projects = user.Projects;
      const project = projects[0];

      expect(project).to.be.ok;
    });

    it('should correctly get associations when doubly linked', async function () {
      const spy = sinon.spy();
      await this.sequelize.sync({ force: true });

      const [user0, project0] = await Promise.all([
        this.User.create({ name: 'Matt' }),
        this.Project.create({ name: 'Good Will Hunting' }),
      ]);

      this.user = user0;
      this.project = project0;
      await user0.addProject(project0, { logging: spy });
      const user = user0;
      expect(spy.calledTwice).to.be.ok; // Once for SELECT, once for INSERT
      spy.resetHistory();

      const projects = await user.getProjects({
        logging: spy,
      });

      const project = projects[0];
      expect(spy.calledOnce).to.be.ok;
      spy.resetHistory();

      expect(project).to.be.ok;

      await this.user.removeProject(project, {
        logging: spy,
      });

      await project;
      expect(spy).to.have.been.calledOnce;
    });

    it('should be able to handle nested includes properly', async function () {
      this.Group = this.sequelize.define('Group', { groupName: DataTypes.STRING });

      this.Group.belongsToMany(this.User, {
        through: 'group_users',
        as: 'Users',
        foreignKey: {
          field: 'group_id',
          name: 'groupId',
        },
        otherKey: {
          field: 'user_id',
          name: 'userId',
        },
      });
      this.User.belongsToMany(this.Group, {
        through: 'group_users',
        as: 'Groups',
        foreignKey: {
          field: 'user_id',
          name: 'userId',
        },
        otherKey: {
          field: 'group_id',
          name: 'groupId',
        },
      });

      await this.sequelize.sync({ force: true });

      const [group1, user0, project0] = await Promise.all([
        this.Group.create({ groupName: 'The Illuminati' }),
        this.User.create({ name: 'Matt' }),
        this.Project.create({ name: 'Good Will Hunting' }),
      ]);

      await user0.addProject(project0);
      await group1.addUser(user0);
      const group0 = group1;

      // get the group and include both the users in the group and their project's
      const groups = await this.Group.findAll({
        where: { id: group0.id },
        include: [
          {
            model: this.User,
            as: 'Users',
            include: [{ model: this.Project, as: 'Projects' }],
          },
        ],
      });

      const group = groups[0];
      expect(group).to.be.ok;

      const user = group.Users[0];
      expect(user).to.be.ok;

      const project = user.Projects[0];
      expect(project).to.be.ok;
      expect(project.name).to.equal('Good Will Hunting');
    });
  });

  describe('primary key handling for join table', () => {
    beforeEach(function () {
      this.User = this.sequelize.define(
        'User',
        { username: DataTypes.STRING },
        { tableName: 'users' },
      );
      this.Task = this.sequelize.define(
        'Task',
        { title: DataTypes.STRING },
        { tableName: 'tasks' },
      );
    });

    it('removes the primary key if it was added by sequelize', function () {
      this.UserTasks = this.sequelize.define('usertasks', {});

      this.User.belongsToMany(this.Task, { through: this.UserTasks });
      this.Task.belongsToMany(this.User, { through: this.UserTasks });

      expect(Object.keys(this.UserTasks.primaryKeys).sort()).to.deep.equal(['taskId', 'userId']);
    });

    it('keeps the primary key if it was added by the user', function () {
      this.UserTasks = this.sequelize.define('UserTask', {
        id: {
          type: DataTypes.INTEGER,
          autoincrement: true,
          primaryKey: true,
        },
      });
      this.UserTasks2 = this.sequelize.define('UserTask2', {
        userTasksId: {
          type: DataTypes.INTEGER,
          autoincrement: true,
          primaryKey: true,
        },
      });

      this.User.belongsToMany(this.Task, { through: this.UserTasks });
      this.User.belongsToMany(this.Task, {
        through: this.UserTasks2,
        as: 'otherTasksB',
        inverse: { as: 'otherUsers' },
      });

      expect(Object.keys(this.UserTasks.primaryKeys)).to.deep.equal(['id']);
      expect(Object.keys(this.UserTasks2.primaryKeys)).to.deep.equal(['userTasksId']);

      for (const model of [this.UserTasks, this.UserTasks2]) {
        const index = model.getIndexes()[0];

        expect(index.fields.sort()).to.deep.equal(['taskId', 'userId']);
      }
    });

    describe('without sync', () => {
      beforeEach(async function () {
        await this.sequelize.queryInterface.createTable('users', {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          username: DataTypes.STRING,
          createdAt: DataTypes.DATE,
          updatedAt: DataTypes.DATE,
        });
        await this.sequelize.queryInterface.createTable('tasks', {
          id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
          },
          title: DataTypes.STRING,
          createdAt: DataTypes.DATE,
          updatedAt: DataTypes.DATE,
        });

        return this.sequelize.queryInterface.createTable('users_tasks', {
          taskId: DataTypes.INTEGER,
          userId: DataTypes.INTEGER,
          createdAt: DataTypes.DATE,
          updatedAt: DataTypes.DATE,
        });
      });

      it('removes all associations', async function () {
        this.UsersTasks = this.sequelize.define('UsersTasks', {}, { tableName: 'users_tasks' });

        this.User.belongsToMany(this.Task, { through: this.UsersTasks });
        this.Task.belongsToMany(this.User, { through: this.UsersTasks });

        expect(Object.keys(this.UsersTasks.primaryKeys).sort()).to.deep.equal(['taskId', 'userId']);

        const [user, task] = await Promise.all([
          this.User.create({ username: 'foo' }),
          this.Task.create({ title: 'foo' }),
        ]);

        await user.addTask(task);
        await user.setTasks(null);

        expect(await user.getTasks()).to.have.length(0);
      });
    });
  });

  describe('through', () => {
    describe('paranoid', () => {
      beforeEach(async function () {
        this.User = this.sequelize.define('User', {});
        this.Project = this.sequelize.define('Project', {});
        this.UserProjects = this.sequelize.define(
          'UserProjects',
          {},
          {
            paranoid: true,
          },
        );

        this.User.belongsToMany(this.Project, { through: this.UserProjects });
        this.Project.belongsToMany(this.User, { through: this.UserProjects });

        await this.sequelize.sync();

        this.users = await Promise.all([
          this.User.create(),
          this.User.create(),
          this.User.create(),
        ]);

        this.projects = await Promise.all([
          this.Project.create(),
          this.Project.create(),
          this.Project.create(),
        ]);
      });

      it('gets only non-deleted records by default', async function () {
        await this.users[0].addProjects(this.projects);
        await this.UserProjects.destroy({
          where: {
            projectId: this.projects[0].id,
          },
        });

        const result = await this.users[0].getProjects();

        expect(result.length).to.equal(2);
      });

      it('returns both deleted and non-deleted records with paranoid=false', async function () {
        await this.users[0].addProjects(this.projects);
        await this.UserProjects.destroy({
          where: {
            projectId: this.projects[0].id,
          },
        });

        const result = await this.users[0].getProjects({ through: { paranoid: false } });

        expect(result.length).to.equal(3);
      });

      it('hasAssociation also respects paranoid option', async function () {
        await this.users[0].addProjects(this.projects);
        await this.UserProjects.destroy({
          where: {
            projectId: this.projects[0].id,
          },
        });

        expect(
          await this.users[0].hasProjects(this.projects[0], { through: { paranoid: false } }),
        ).to.equal(true);

        expect(await this.users[0].hasProjects(this.projects[0])).to.equal(false);

        expect(await this.users[0].hasProjects(this.projects[1])).to.equal(true);

        expect(await this.users[0].hasProjects(this.projects)).to.equal(false);
      });
    });

    describe('fetching from join table', () => {
      beforeEach(function () {
        this.User = this.sequelize.define('User', {});
        this.Project = this.sequelize.define('Project', {});
        this.UserProjects = this.sequelize.define('UserProjects', {
          status: DataTypes.STRING,
          data: DataTypes.INTEGER,
        });

        this.User.belongsToMany(this.Project, { through: this.UserProjects });
        this.Project.belongsToMany(this.User, { through: this.UserProjects });

        return this.sequelize.sync();
      });

      it('should contain the data from the join table on .UserProjects a DAO', async function () {
        const [user, project0] = await Promise.all([this.User.create(), this.Project.create()]);

        await user.addProject(project0, { through: { status: 'active', data: 42 } });
        const projects = await user.getProjects();
        const project = projects[0];

        expect(project.userProject).to.be.ok;
        expect(project.status).not.to.exist;
        expect(project.userProject.status).to.equal('active');
        expect(project.userProject.data).to.equal(42);
      });

      it('should be able to alias the default name of the join table', async function () {
        const [user, project0] = await Promise.all([this.User.create(), this.Project.create()]);

        await user.addProject(project0, { through: { status: 'active', data: 42 } });

        const users = await this.User.findAll({
          include: [
            {
              model: this.Project,
              through: {
                as: 'myProject',
              },
            },
          ],
        });

        const project = users[0].projects[0];

        expect(project.UserProjects).not.to.exist;
        expect(project.status).not.to.exist;
        expect(project.myProject).to.be.ok;
        expect(project.myProject.status).to.equal('active');
        expect(project.myProject.data).to.equal(42);
      });

      it('should be able to limit the join table attributes returned', async function () {
        const [user, project0] = await Promise.all([this.User.create(), this.Project.create()]);

        await user.addProject(project0, { through: { status: 'active', data: 42 } });
        const projects = await user.getProjects({ joinTableAttributes: ['status'] });
        const project = projects[0];

        expect(project.userProject).to.be.ok;
        expect(project.status).not.to.exist;
        expect(project.userProject.status).to.equal('active');
        expect(project.userProject.data).not.to.exist;
      });
    });

    describe('inserting in join table', () => {
      beforeEach(function () {
        this.User = this.sequelize.define('User', {});
        this.Project = this.sequelize.define('Project', {});
        this.UserProjects = this.sequelize.define('UserProjects', {
          status: DataTypes.STRING,
          data: DataTypes.INTEGER,
        });

        this.User.belongsToMany(this.Project, { through: this.UserProjects });
        this.Project.belongsToMany(this.User, { through: this.UserProjects });

        return this.sequelize.sync();
      });

      describe('add', () => {
        it('should insert data provided on the object into the join table', async function () {
          const [u, p] = await Promise.all([this.User.create(), this.Project.create()]);

          p.UserProjects = { status: 'active' };

          await u.addProject(p);
          const up = await this.UserProjects.findOne({ where: { userId: u.id, projectId: p.id } });
          expect(up.status).to.equal('active');
        });

        it('should insert data provided as a second argument into the join table', async function () {
          const [u, p] = await Promise.all([this.User.create(), this.Project.create()]);

          await u.addProject(p, { through: { status: 'active' } });
          const up = await this.UserProjects.findOne({ where: { userId: u.id, projectId: p.id } });
          expect(up.status).to.equal('active');
        });

        it('should be able to add twice (second call result in UPDATE call) without any attributes (and timestamps off) on the through model', async function () {
          const Worker = this.sequelize.define('Worker', {}, { timestamps: false });
          const Task = this.sequelize.define('Task', {}, { timestamps: false });
          const WorkerTasks = this.sequelize.define('WorkerTasks', {}, { timestamps: false });

          Worker.belongsToMany(Task, { through: WorkerTasks });
          Task.belongsToMany(Worker, { through: WorkerTasks });

          await this.sequelize.sync({ force: true });
          const worker = await Worker.create({ id: 1337 });
          const task = await Task.create({ id: 7331 });
          await worker.addTask(task);
          await worker.addTask(task);
        });

        it('should be able to add twice (second call result in UPDATE call) with custom primary keys and without any attributes (and timestamps off) on the through model', async function () {
          const Worker = this.sequelize.define(
            'Worker',
            {
              id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true,
              },
            },
            { timestamps: false },
          );
          const Task = this.sequelize.define(
            'Task',
            {
              id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true,
              },
            },
            { timestamps: false },
          );
          const WorkerTasks = this.sequelize.define(
            'WorkerTasks',
            {
              id: {
                type: DataTypes.INTEGER,
                allowNull: false,
                primaryKey: true,
                autoIncrement: true,
              },
            },
            { timestamps: false },
          );

          Worker.belongsToMany(Task, { through: WorkerTasks });
          Task.belongsToMany(Worker, { through: WorkerTasks });

          await this.sequelize.sync({ force: true });
          const worker = await Worker.create({ id: 1337 });
          const task = await Task.create({ id: 7331 });
          await worker.addTask(task);
          await worker.addTask(task);
        });

        it('should be able to create an instance along with its many-to-many association which has an extra column in the junction table', async function () {
          const Foo = this.sequelize.define('foo', { name: DataTypes.STRING });
          const Bar = this.sequelize.define('bar', { name: DataTypes.STRING });
          const FooBar = this.sequelize.define('foobar', { baz: DataTypes.STRING });
          Foo.belongsToMany(Bar, { through: FooBar });
          Bar.belongsToMany(Foo, { through: FooBar });

          await this.sequelize.sync({ force: true });

          const foo0 = await Foo.create(
            {
              name: 'foo...',
              bars: [
                {
                  name: 'bar...',
                  foobar: {
                    baz: 'baz...',
                  },
                },
              ],
            },
            {
              include: Bar,
            },
          );

          expect(foo0.name).to.equal('foo...');
          expect(foo0.bars).to.have.length(1);
          expect(foo0.bars[0].name).to.equal('bar...');
          expect(foo0.bars[0].foobar).to.not.equal(null);
          expect(foo0.bars[0].foobar.baz).to.equal('baz...');

          const foo = await Foo.findOne({ include: Bar });
          expect(foo.name).to.equal('foo...');
          expect(foo.bars).to.have.length(1);
          expect(foo.bars[0].name).to.equal('bar...');
          expect(foo.bars[0].foobar).to.not.equal(null);
          expect(foo.bars[0].foobar.baz).to.equal('baz...');
        });
      });

      describe('set', () => {
        it('should be able to combine properties on the associated objects, and default values', async function () {
          await this.Project.bulkCreate([{}, {}]);

          const [user, projects] = await Promise.all([
            this.User.create(),
            await this.Project.findAll(),
          ]);

          const p1 = projects[0];
          const p2 = projects[1];

          p1.UserProjects = { status: 'inactive' };

          await user.setProjects([p1, p2], { through: { status: 'active' } });

          const [up1, up2] = await Promise.all([
            this.UserProjects.findOne({ where: { userId: user.id, projectId: p1.id } }),
            this.UserProjects.findOne({ where: { userId: user.id, projectId: p2.id } }),
          ]);

          expect(up1.status).to.equal('inactive');
          expect(up2.status).to.equal('active');
        });

        it('should be able to set twice (second call result in UPDATE calls) without any attributes (and timestamps off) on the through model', async function () {
          const Worker = this.sequelize.define('Worker', {}, { timestamps: false });
          const Task = this.sequelize.define('Task', {}, { timestamps: false });
          const WorkerTasks = this.sequelize.define('WorkerTasks', {}, { timestamps: false });

          Worker.belongsToMany(Task, { through: WorkerTasks });
          Task.belongsToMany(Worker, { through: WorkerTasks });

          await this.sequelize.sync({ force: true });

          const [worker0, tasks0] = await Promise.all([
            dialect === 'db2' ? Worker.create({ id: 1 }) : Worker.create(),
            Task.bulkCreate([{}, {}]).then(() => {
              return Task.findAll();
            }),
          ]);

          await worker0.setTasks(tasks0);
          const [worker, tasks] = [worker0, tasks0];

          await worker.setTasks(tasks);
        });
      });

      describe('query with through.where', () => {
        it('should support query the through model', async function () {
          const user = await this.User.create();

          await Promise.all([
            user.createProject({}, { through: { status: 'active', data: 1 } }),
            user.createProject({}, { through: { status: 'inactive', data: 2 } }),
            user.createProject({}, { through: { status: 'inactive', data: 3 } }),
          ]);

          const [activeProjects, inactiveProjectCount] = await Promise.all([
            user.getProjects({ through: { where: { status: 'active' } } }),
            user.countProjects({ through: { where: { status: 'inactive' } } }),
          ]);

          expect(activeProjects).to.have.lengthOf(1);
          expect(inactiveProjectCount).to.eql(2);
        });
      });
    });

    describe('removing from the join table', () => {
      it('should remove a single entry without any attributes (and timestamps off) on the through model', async function () {
        const Worker = this.sequelize.define('Worker', {}, { timestamps: false });
        const Task = this.sequelize.define('Task', {}, { timestamps: false });
        const WorkerTasks = this.sequelize.define('WorkerTasks', {}, { timestamps: false });

        Worker.belongsToMany(Task, { through: WorkerTasks });
        Task.belongsToMany(Worker, { through: WorkerTasks });

        // Test setup
        await this.sequelize.sync({ force: true });

        const [worker, tasks0] = await Promise.all([
          dialect === 'db2' ? Worker.create({ id: 1 }) : Worker.create({}),
          Task.bulkCreate([{}, {}, {}]).then(() => {
            return Task.findAll();
          }),
        ]);

        // Set all tasks, then remove one task by instance, then remove one task by id, then return all tasks
        await worker.setTasks(tasks0);

        await worker.removeTask(tasks0[0]);
        await worker.removeTask(tasks0[1].id);
        const tasks = await worker.getTasks();
        expect(tasks.length).to.equal(1);
      });

      it('should remove multiple entries without any attributes (and timestamps off) on the through model', async function () {
        const Worker = this.sequelize.define('Worker', {}, { timestamps: false });
        const Task = this.sequelize.define('Task', {}, { timestamps: false });
        const WorkerTasks = this.sequelize.define('WorkerTasks', {}, { timestamps: false });

        Worker.belongsToMany(Task, { through: WorkerTasks });
        Task.belongsToMany(Worker, { through: WorkerTasks });

        // Test setup
        await this.sequelize.sync({ force: true });

        const [worker, tasks0] = await Promise.all([
          dialect === 'db2' ? Worker.create({ id: 1 }) : Worker.create({}),
          Task.bulkCreate([{}, {}, {}, {}, {}]).then(() => {
            return Task.findAll();
          }),
        ]);

        // Set all tasks, then remove two tasks by instance, then remove two tasks by id, then return all tasks
        await worker.setTasks(tasks0);

        await worker.removeTasks([tasks0[0], tasks0[1]]);
        await worker.removeTasks([tasks0[2].id, tasks0[3].id]);
        const tasks = await worker.getTasks();
        expect(tasks.length).to.equal(1);
      });
    });
  });

  describe('multiple hasMany', () => {
    beforeEach(function () {
      this.User = this.sequelize.define('user', { name: DataTypes.STRING });
      this.Project = this.sequelize.define('project', { projectName: DataTypes.STRING });
    });

    describe('project has owners and users and owners and users have projects', () => {
      beforeEach(function () {
        this.Project.belongsToMany(this.User, {
          as: 'owners',
          through: 'projectOwners',
          inverse: { as: 'ownedProjects' },
        });
        this.Project.belongsToMany(this.User, {
          as: 'users',
          through: 'projectUsers',
          inverse: { as: 'memberProjects' },
        });

        return this.sequelize.sync({ force: true });
      });

      it('correctly sets user and owner', async function () {
        const p1 = this.Project.build({ projectName: 'p1' });
        const u1 = this.User.build({ name: 'u1' });
        const u2 = this.User.build({ name: 'u2' });

        await p1.save();

        await u1.save();
        await u2.save();
        await p1.setUsers([u1]);

        await p1.setOwners([u2]);
      });
    });
  });

  describe('Foreign key constraints', () => {
    beforeEach(function () {
      this.Task = this.sequelize.define('task', { title: DataTypes.STRING });
      this.User = this.sequelize.define('user', { username: DataTypes.STRING });
      this.UserTasks = this.sequelize.define('tasksusers', {
        userId: DataTypes.INTEGER,
        taskId: DataTypes.INTEGER,
      });
    });

    it('can cascade deletes both ways by default', async function () {
      this.User.belongsToMany(this.Task, { through: 'tasksusers' });
      this.Task.belongsToMany(this.User, { through: 'tasksusers' });

      await this.sequelize.sync({ force: true });

      const [user1, task1, user2, task2] = await Promise.all([
        this.User.create({ id: 67, username: 'foo' }),
        this.Task.create({ id: 52, title: 'task' }),
        this.User.create({ id: 89, username: 'bar' }),
        this.Task.create({ id: 42, title: 'kast' }),
      ]);

      await Promise.all([user1.setTasks([task1]), task2.setUsers([user2])]);

      await Promise.all([user1.destroy(), task2.destroy()]);

      const [tu1, tu2] = await Promise.all([
        this.sequelize.models.getOrThrow('tasksusers').findAll({ where: { userId: user1.id } }),
        this.sequelize.models.getOrThrow('tasksusers').findAll({ where: { taskId: task2.id } }),
        this.User.findOne({
          where: { username: 'Franz Joseph' },
          include: [
            {
              model: this.Task,
              where: {
                title: {
                  [Op.ne]: 'task',
                },
              },
            },
          ],
        }),
      ]);

      expect(tu1).to.have.length(0);
      expect(tu2).to.have.length(0);
    });

    if (current.dialect.supports.constraints.restrict) {
      it('can restrict deletes both ways', async function () {
        this.User.belongsToMany(this.Task, {
          through: 'tasksusers',
          foreignKey: { onDelete: 'RESTRICT' },
          otherKey: { onDelete: 'RESTRICT' },
        });

        await this.sequelize.sync({ force: true });

        const [user1, task1, user2, task2] = await Promise.all([
          this.User.create({ id: 67, username: 'foo' }),
          this.Task.create({ id: 52, title: 'task' }),
          this.User.create({ id: 89, username: 'bar' }),
          this.Task.create({ id: 42, title: 'kast' }),
        ]);

        await Promise.all([user1.setTasks([task1]), task2.setUsers([user2])]);

        await Promise.all([
          expect(user1.destroy()).to.have.been.rejectedWith(Sequelize.ForeignKeyConstraintError), // Fails because of
          // RESTRICT constraint
          expect(task2.destroy()).to.have.been.rejectedWith(Sequelize.ForeignKeyConstraintError),
        ]);
      });

      it('can cascade and restrict deletes', async function () {
        this.User.belongsToMany(this.Task, {
          through: 'tasksusers',
          foreignKey: { onDelete: 'RESTRICT' },
          otherKey: { onDelete: 'CASCADE' },
        });

        await this.sequelize.sync({ force: true });

        const [user1, task1, user2, task2] = await Promise.all([
          this.User.create({ id: 67, username: 'foo' }),
          this.Task.create({ id: 52, title: 'task' }),
          this.User.create({ id: 89, username: 'bar' }),
          this.Task.create({ id: 42, title: 'kast' }),
        ]);

        await Promise.all([user1.setTasks([task1]), task2.setUsers([user2])]);

        await Promise.all([
          expect(user1.destroy()).to.have.been.rejectedWith(Sequelize.ForeignKeyConstraintError), // Fails because of
          // RESTRICT constraint
          task2.destroy(),
        ]);

        const usertasks = await this.sequelize.models
          .getOrThrow('tasksusers')
          .findAll({ where: { taskId: task2.id } });
        // This should not exist because deletes cascade
        expect(usertasks).to.have.length(0);
      });
    }

    it('should be possible to remove all constraints', async function () {
      this.User.belongsToMany(this.Task, {
        foreignKeyConstraints: false,
        through: 'tasksusers',
        inverse: { foreignKeyConstraints: false },
      });

      const Through = this.sequelize.models.getOrThrow('tasksusers');
      expect(Through.getAttributes().taskId.references).to.eq(
        undefined,
        'Attribute taskId should not be a foreign key',
      );
      expect(Through.getAttributes().userId.references).to.eq(
        undefined,
        'Attribute userId should not be a foreign key',
      );

      await this.sequelize.sync({ force: true });

      const [user1, task1, user2, task2] = await Promise.all([
        this.User.create({ id: 67, username: 'foo' }),
        this.Task.create({ id: 52, title: 'task' }),
        this.User.create({ id: 89, username: 'bar' }),
        this.Task.create({ id: 42, title: 'kast' }),
      ]);

      await Promise.all([user1.setTasks([task1]), task2.setUsers([user2])]);

      await Promise.all([user1.destroy(), task2.destroy()]);

      const [ut1, ut2] = await Promise.all([
        this.sequelize.models.getOrThrow('tasksusers').findAll({ where: { userId: user1.id } }),
        this.sequelize.models.getOrThrow('tasksusers').findAll({ where: { taskId: task2.id } }),
      ]);

      expect(ut1).to.have.length(1);
      expect(ut2).to.have.length(1);
    });
  });

  describe('Association options', () => {
    describe('allows the user to provide an attribute definition object as foreignKey', () => {
      it('works when taking a column directly from the object', function () {
        const Project = this.sequelize.define('project', {});
        const User = this.sequelize.define('user', {
          uid: {
            type: DataTypes.INTEGER,
            primaryKey: true,
          },
        });

        const UserProjects = User.belongsToMany(Project, {
          foreignKey: { name: 'user_id', defaultValue: 42 },
          through: 'UserProjects',
        });
        expect(UserProjects.through.model.getAttributes().user_id).to.be.ok;
        const targetTable = UserProjects.through.model.getAttributes().user_id.references.table;
        assert(typeof targetTable === 'object');

        expect(targetTable).to.deep.equal(User.table);
        expect(UserProjects.through.model.getAttributes().user_id.references.key).to.equal('uid');
        expect(UserProjects.through.model.getAttributes().user_id.defaultValue).to.equal(42);
      });
    });

    it('should throw an error if foreignKey and as result in a name clash', function () {
      const User = this.sequelize.define('user', {
        user: DataTypes.INTEGER,
      });

      expect(User.belongsToMany.bind(User, User, { as: 'user', through: 'UserUser' })).to.throw(
        "Naming collision between attribute 'user' and association 'user' on model user. To remedy this, change the \"as\" options in your association definition",
      );
    });
  });

  describe('thisAssociations', () => {
    it('should work with this reference', async function () {
      const User = this.sequelize.define('User', {
        name: DataTypes.STRING(100),
      });
      const Follow = this.sequelize.define('Follow');

      User.belongsToMany(User, { through: Follow, as: 'Users', inverse: { as: 'Fans' } });

      await this.sequelize.sync({ force: true });

      const users = await Promise.all([
        User.create({ name: 'Khsama' }),
        User.create({ name: 'Vivek' }),
        User.create({ name: 'Satya' }),
      ]);

      await Promise.all([
        users[0].addFan(users[1]),
        users[1].addUser(users[2]),
        users[2].addFan(users[0]),
      ]);
    });

    it('should work with custom this reference', async function () {
      const User = this.sequelize.define('User', {
        name: DataTypes.STRING(100),
      });
      const UserFollowers = this.sequelize.define('UserFollower');

      User.belongsToMany(User, {
        as: {
          singular: 'Follower',
          plural: 'Followers',
        },
        through: UserFollowers,
        inverse: {
          as: 'Followings',
        },
      });

      User.belongsToMany(User, {
        as: {
          singular: 'Invitee',
          plural: 'Invitees',
        },
        foreignKey: 'inviteeId',
        through: 'Invites',
        inverse: {
          as: 'Hosts',
        },
      });

      await this.sequelize.sync({ force: true });

      const users = await Promise.all([
        User.create({ name: 'Jalrangi' }),
        User.create({ name: 'Sargrahi' }),
      ]);

      await Promise.all([
        users[0].addFollower(users[1]),
        users[1].addFollower(users[0]),
        users[0].addInvitee(users[1]),
        users[1].addInvitee(users[0]),
      ]);
    });
  });

  describe('Eager loading', () => {
    beforeEach(function () {
      this.Individual = this.sequelize.define('individual', {
        name: DataTypes.STRING,
      });
      this.Hat = this.sequelize.define('hat', {
        name: DataTypes.STRING,
      });
      this.Event = this.sequelize.define('event', {});
      this.Individual.belongsToMany(this.Hat, {
        through: this.Event,
        as: {
          singular: 'personwearinghat',
          plural: 'personwearinghats',
        },
      });
      this.Hat.belongsToMany(this.Individual, {
        through: this.Event,
        as: {
          singular: 'hatwornby',
          plural: 'hatwornbys',
        },
      });
    });

    it('should load with an alias', async function () {
      await this.sequelize.sync({ force: true });

      const [individual0, hat0] = await Promise.all([
        this.Individual.create({ name: 'Foo Bar' }),
        this.Hat.create({ name: 'Baz' }),
      ]);

      await individual0.addPersonwearinghat(hat0);

      const individual = await this.Individual.findOne({
        where: { name: 'Foo Bar' },
        include: [{ model: this.Hat, as: 'personwearinghats' }],
      });

      expect(individual.name).to.equal('Foo Bar');
      expect(individual.personwearinghats.length).to.equal(1);
      expect(individual.personwearinghats[0].name).to.equal('Baz');

      const hat = await this.Hat.findOne({
        where: { name: 'Baz' },
        include: [{ model: this.Individual, as: 'hatwornbys' }],
      });

      expect(hat.name).to.equal('Baz');
      expect(hat.hatwornbys.length).to.equal(1);
      expect(hat.hatwornbys[0].name).to.equal('Foo Bar');
    });

    it('should load all', async function () {
      await this.sequelize.sync({ force: true });

      const [individual0, hat0] = await Promise.all([
        this.Individual.create({ name: 'Foo Bar' }),
        this.Hat.create({ name: 'Baz' }),
      ]);

      await individual0.addPersonwearinghat(hat0);

      const individual = await this.Individual.findOne({
        where: { name: 'Foo Bar' },
        include: [{ all: true }],
      });

      expect(individual.name).to.equal('Foo Bar');
      expect(individual.personwearinghats.length).to.equal(1);
      expect(individual.personwearinghats[0].name).to.equal('Baz');

      const hat = await this.Hat.findOne({
        where: { name: 'Baz' },
        include: [{ all: true }],
      });

      expect(hat.name).to.equal('Baz');
      expect(hat.hatwornbys.length).to.equal(1);
      expect(hat.hatwornbys[0].name).to.equal('Foo Bar');
    });
  });

  describe('Disabling default unique constraint', () => {
    beforeEach(function () {
      this.Order = this.sequelize.define('order', {});
      this.Good = this.sequelize.define('good', {
        name: DataTypes.STRING,
      });
      this.OrderItem = this.sequelize.define('orderitem', {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
        },
        isUpsell: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
        },
      });

      this.Order.belongsToMany(this.Good, {
        through: {
          model: this.OrderItem,
          unique: false,
        },
      });
      this.Good.belongsToMany(this.Order, {
        through: {
          model: this.OrderItem,
          unique: false,
        },
      });
    });

    it('should create new relations in parallel', async function () {
      await this.sequelize.sync({ force: true });

      const { Good, Order } = this;

      const order = await Order.create();
      const good = await Good.create({ name: 'Drink' });

      await Promise.all([
        order.addGood(good, {
          through: {
            isUpsell: false,
          },
        }),
        order.addGood(good, {
          through: {
            isUpsell: true,
          },
        }),
      ]);

      const orderGoods = await order.getGoods();

      const [firstGood, secondGood] = orderGoods;

      expect(orderGoods.length).to.equal(2);
      expect(firstGood.orderGood.isUpsell).to.be.not.equal(secondGood.orderGood.isUpsell);
    });

    it('should create new relations sequentialy', async function () {
      await this.sequelize.sync({ force: true });

      const { Good, Order } = this;

      const order = await Order.create();
      const good = await Good.create({ name: 'Drink' });

      await order.addGood(good, {
        through: {
          isUpsell: false,
        },
      });
      await order.addGood(good, {
        through: {
          isUpsell: true,
        },
      });

      const orderGoods = await order.getGoods();

      const [firstGood, secondGood] = orderGoods;

      expect(orderGoods.length).to.equal(2);
      expect(firstGood.orderGood.isUpsell).to.be.not.equal(secondGood.orderGood.isUpsell);
    });
  });
});
