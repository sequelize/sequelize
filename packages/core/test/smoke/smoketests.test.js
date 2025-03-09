'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../integration/support');
const { DataTypes, sql } = require('@sequelize/core');
const sinon = require('sinon');

const dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('Smoke Tests'), () => {
  describe('getAssociations', () => {
    beforeEach(async function () {
      this.User = this.sequelize.define('User', { username: DataTypes.STRING });
      this.Task = this.sequelize.define('Task', {
        title: DataTypes.STRING,
        active: DataTypes.BOOLEAN,
      });

      this.User.belongsToMany(this.Task, { through: 'UserTasks' });
      this.Task.belongsToMany(this.User, { through: 'UserTasks' });

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

    it('gets all associated objects with all fields', async function () {
      const john = await this.User.findOne({ where: { username: 'John' } });
      const tasks = await john.getTasks();
      for (const attr of Object.keys(tasks[0].getAttributes())) {
        expect(tasks[0]).to.have.property(attr);
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
              fields: ['UserUserSecondId', 'GroupGroupSecondId'],
            },
          ],
        },
      );

      User.belongsToMany(Group, { through: User_has_Group, sourceKey: 'userSecondId' });
      Group.belongsToMany(User, { through: User_has_Group, sourceKey: 'groupSecondId' });

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
      expect(users[0].Groups[0].User_has_Group.UserUserSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(users[0].Groups[0].User_has_Group.UserUserSecondId).to.deep.equal(
          users[0].userSecondId,
        );
      } else {
        expect(users[0].Groups[0].User_has_Group.UserUserSecondId).to.equal(users[0].userSecondId);
      }

      expect(users[0].Groups[0].User_has_Group.GroupGroupSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(users[0].Groups[0].User_has_Group.GroupGroupSecondId).to.deep.equal(
          users[0].Groups[0].groupSecondId,
        );
      } else {
        expect(users[0].Groups[0].User_has_Group.GroupGroupSecondId).to.equal(
          users[0].Groups[0].groupSecondId,
        );
      }

      expect(users[1].Groups[0].User_has_Group.UserUserSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(users[1].Groups[0].User_has_Group.UserUserSecondId).to.deep.equal(
          users[1].userSecondId,
        );
      } else {
        expect(users[1].Groups[0].User_has_Group.UserUserSecondId).to.equal(users[1].userSecondId);
      }

      expect(users[1].Groups[0].User_has_Group.GroupGroupSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(users[1].Groups[0].User_has_Group.GroupGroupSecondId).to.deep.equal(
          users[1].Groups[0].groupSecondId,
        );
      } else {
        expect(users[1].Groups[0].User_has_Group.GroupGroupSecondId).to.equal(
          users[1].Groups[0].groupSecondId,
        );
      }

      expect(groups.length).to.equal(2);
      expect(groups[0].Users.length).to.equal(1);
      expect(groups[1].Users.length).to.equal(1);
      expect(groups[0].Users[0].User_has_Group.GroupGroupSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(groups[0].Users[0].User_has_Group.GroupGroupSecondId).to.deep.equal(
          groups[0].groupSecondId,
        );
      } else {
        expect(groups[0].Users[0].User_has_Group.GroupGroupSecondId).to.equal(
          groups[0].groupSecondId,
        );
      }

      expect(groups[0].Users[0].User_has_Group.UserUserSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(groups[0].Users[0].User_has_Group.UserUserSecondId).to.deep.equal(
          groups[0].Users[0].userSecondId,
        );
      } else {
        expect(groups[0].Users[0].User_has_Group.UserUserSecondId).to.equal(
          groups[0].Users[0].userSecondId,
        );
      }

      expect(groups[1].Users[0].User_has_Group.GroupGroupSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(groups[1].Users[0].User_has_Group.GroupGroupSecondId).to.deep.equal(
          groups[1].groupSecondId,
        );
      } else {
        expect(groups[1].Users[0].User_has_Group.GroupGroupSecondId).to.equal(
          groups[1].groupSecondId,
        );
      }

      expect(groups[1].Users[0].User_has_Group.UserUserSecondId).to.be.ok;
      if (dialect === 'db2') {
        expect(groups[1].Users[0].User_has_Group.UserUserSecondId).to.deep.equal(
          groups[1].Users[0].userSecondId,
        );
      } else {
        expect(groups[1].Users[0].User_has_Group.UserUserSecondId).to.equal(
          groups[1].Users[0].userSecondId,
        );
      }
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

      this.Article.belongsToMany(this.Label, { through: this.ArticleLabel });
      this.Label.belongsToMany(this.Article, { through: this.ArticleLabel });

      return this.sequelize.sync({ force: true });
    });

    it('answers false if only some labels have been assigned when passing a primary key instead of an object', async function () {
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

    it('should count scoped through associations', async function () {
      this.User.belongsToMany(this.Task, {
        as: 'startedTasks',
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
  });

  describe('belongsTo and hasMany at once', () => {
    beforeEach(function () {
      this.A = this.sequelize.define('a', { name: DataTypes.STRING });
      this.B = this.sequelize.define('b', { name: DataTypes.STRING });
    });

    describe('target belongs to source', () => {
      beforeEach(function () {
        this.B.belongsTo(this.A, { as: 'relation1' });
        this.A.belongsToMany(this.B, { as: 'relation2', through: 'AB' });
        this.B.belongsToMany(this.A, { as: 'relation2', through: 'AB' });

        return this.sequelize.sync({ force: true });
      });

      it('correctly uses bId in A', async function () {
        const a1 = this.A.build({ name: 'a1' });
        const b1 = this.B.build({ name: 'b1' });

        await a1.save();

        await b1.save();
        await b1.setRelation1(a1);
        const b = await this.B.findOne({ where: { name: 'b1' } });
        expect(b.relation1Id).to.be.eq(a1.id);
      });
    });
  });
});

describe(Support.getTestDialectTeaser('Instance'), () => {
  before(function () {
    this.clock = sinon.useFakeTimers();
  });

  afterEach(function () {
    this.clock.reset();
  });

  after(function () {
    this.clock.restore();
  });

  beforeEach(async function () {
    this.User = this.sequelize.define('User', {
      username: { type: DataTypes.STRING },
      uuidv1: { type: DataTypes.UUID, defaultValue: sql.uuidV1 },
      uuidv4: { type: DataTypes.UUID, defaultValue: sql.uuidV4 },
      touchedAt: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
      aNumber: { type: DataTypes.INTEGER },
      bNumber: { type: DataTypes.INTEGER },
      aDate: { type: DataTypes.DATE },

      validateTest: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: { isInt: true },
      },
      validateCustom: {
        type: DataTypes.STRING,
        allowNull: true,
        validate: { len: { msg: 'Length failed.', args: [1, 20] } },
      },

      dateAllowNullTrue: {
        type: DataTypes.DATE,
        allowNull: true,
      },

      isSuperUser: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    });

    await this.User.sync({ force: true });
  });

  describe('Escaping', () => {
    it('is done properly for special characters', async function () {
      // Ideally we should test more: "\0\n\r\b\t\\\'\"\x1a"
      // But this causes sqlite to fail and exits the entire test suite immediately
      const bio = `${dialect}'"\n`; // Need to add the dialect here so in case of failure I know what DB it failed for

      const u1 = await this.User.create({ username: bio });
      const u2 = await this.User.findByPk(u1.id);
      expect(u2.username).to.equal(bio);
    });
  });

  describe('values', () => {
    it('returns all values', async function () {
      const User = this.sequelize.define(
        'UserHelper',
        {
          username: DataTypes.STRING,
        },
        { timestamps: false, logging: false },
      );

      await User.sync();
      const user = User.build({ username: 'foo' });
      expect(user.get({ plain: true })).to.deep.equal({ username: 'foo', id: null });
    });
  });

  describe(Support.getTestDialectTeaser('Model'), () => {
    before(function () {
      this.clock = sinon.useFakeTimers();
    });

    after(function () {
      this.clock.restore();
    });

    beforeEach(async function () {
      this.User = this.sequelize.define('User', {
        username: DataTypes.STRING,
        secretValue: DataTypes.STRING,
        data: DataTypes.STRING,
        intVal: DataTypes.INTEGER,
        theDate: DataTypes.DATE,
        aBool: DataTypes.BOOLEAN,
      });

      await this.User.sync({ force: true });
    });

    describe('save', () => {
      it('should map the correct fields when saving instance (#10589)', async function () {
        const User = this.sequelize.define('User', {
          id3: {
            field: 'id',
            type: DataTypes.INTEGER,
            primaryKey: true,
          },
          id: {
            field: 'id2',
            type: DataTypes.INTEGER,
            allowNull: false,
          },
          id2: {
            field: 'id3',
            type: DataTypes.INTEGER,
            allowNull: false,
          },
        });

        await this.sequelize.sync({ force: true });
        await User.create({ id3: 94, id: 87, id2: 943 });
        const user = await User.findByPk(94);
        await user.set('id2', 8877);
        await user.save({ id2: 8877 });
        expect((await User.findByPk(94)).id2).to.equal(8877);
      });
    });
  });
});
