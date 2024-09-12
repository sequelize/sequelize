'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  Sequelize = require('sequelize'),
  current = Support.sequelize,
  dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('HasOne'), () => {
  describe('Model.associations', () => {
    it('should store all associations when associating to the same table multiple times', function() {
      const User = this.sequelize.define('User', {}),
        Group = this.sequelize.define('Group', {});

      Group.hasOne(User);
      Group.hasOne(User, { foreignKey: 'primaryGroupId', as: 'primaryUsers' });
      Group.hasOne(User, { foreignKey: 'secondaryGroupId', as: 'secondaryUsers' });

      expect(
        Object.keys(Group.associations)
      ).to.deep.equal(['User', 'primaryUsers', 'secondaryUsers']);
    });
  });

  describe('get', () => {
    describe('multiple', () => {
      it('should fetch associations for multiple instances', async function() {
        const User = this.sequelize.define('User', {}),
          Player = this.sequelize.define('Player', {});

        Player.User = Player.hasOne(User, { as: 'user' });

        await this.sequelize.sync({ force: true });

        const players = await Promise.all([Player.create({
          id: 1,
          user: {}
        }, {
          include: [Player.User]
        }), Player.create({
          id: 2,
          user: {}
        }, {
          include: [Player.User]
        }), Player.create({
          id: 3
        })]);

        const result = await Player.User.get(players);
        expect(result[players[0].id].id).to.equal(players[0].user.id);
        expect(result[players[1].id].id).to.equal(players[1].user.id);
        expect(result[players[2].id]).to.equal(null);
      });
    });
  });

  describe('getAssociation', () => {
    if (current.dialect.supports.transactions) {
      it('supports transactions', async function() {
        const sequelize = await Support.prepareTransactionTest(this.sequelize);
        const User = sequelize.define('User', { username: Support.Sequelize.STRING }),
          Group = sequelize.define('Group', { name: Support.Sequelize.STRING });

        Group.hasOne(User);

        await sequelize.sync({ force: true });
        const fakeUser = await User.create({ username: 'foo' });
        const user = await User.create({ username: 'foo' });
        const group = await Group.create({ name: 'bar' });
        const t = await sequelize.transaction();
        await group.setUser(user, { transaction: t });
        const groups = await Group.findAll();
        const associatedUser = await groups[0].getUser();
        expect(associatedUser).to.be.null;
        const groups0 = await Group.findAll({ transaction: t });
        const associatedUser0 = await groups0[0].getUser({ transaction: t });
        expect(associatedUser0).not.to.be.null;
        expect(associatedUser0.id).to.equal(user.id);
        expect(associatedUser0.id).not.to.equal(fakeUser.id);
        await t.rollback();
      });
    }

    it('should be able to handle a where object that\'s a first class citizen.', async function() {
      const User = this.sequelize.define('UserXYZ', { username: Sequelize.STRING }),
        Task = this.sequelize.define('TaskXYZ', { title: Sequelize.STRING, status: Sequelize.STRING });

      User.hasOne(Task);

      await User.sync({ force: true });
      await Task.sync({ force: true });
      const user = await User.create({ username: 'foo' });
      const task = await Task.create({ title: 'task', status: 'inactive' });
      await user.setTaskXYZ(task);
      const task0 = await user.getTaskXYZ({ where: { status: 'active' } });
      expect(task0).to.be.null;
    });

    it('supports schemas', async function() {
      const User = this.sequelize.define('User', { username: Support.Sequelize.STRING }).schema('admin'),
        Group = this.sequelize.define('Group', { name: Support.Sequelize.STRING }).schema('admin');

      Group.hasOne(User);

      await Support.dropTestSchemas(this.sequelize);
      await this.sequelize.createSchema('admin');
      await Group.sync({ force: true });
      await User.sync({ force: true });

      const [fakeUser, user, group] = await Promise.all([
        User.create({ username: 'foo' }),
        User.create({ username: 'foo' }),
        Group.create({ name: 'bar' })
      ]);

      await group.setUser(user);
      const groups = await Group.findAll();
      const associatedUser = await groups[0].getUser();
      expect(associatedUser).not.to.be.null;
      expect(associatedUser.id).to.equal(user.id);
      expect(associatedUser.id).not.to.equal(fakeUser.id);
      await this.sequelize.dropSchema('admin');
      const schemas = await this.sequelize.showAllSchemas();
      if (['postgres', 'mssql', 'mariadb'].includes(dialect)) {
        expect(schemas).to.not.have.property('admin');
      }
    });
  });

  describe('setAssociation', () => {
    if (current.dialect.supports.transactions) {
      it('supports transactions', async function() {
        const sequelize = await Support.prepareTransactionTest(this.sequelize);
        const User = sequelize.define('User', { username: Support.Sequelize.STRING }),
          Group = sequelize.define('Group', { name: Support.Sequelize.STRING });

        Group.hasOne(User);

        await sequelize.sync({ force: true });
        const user = await User.create({ username: 'foo' });
        const group = await Group.create({ name: 'bar' });
        const t = await sequelize.transaction();
        await group.setUser(user, { transaction: t });
        const groups = await Group.findAll();
        const associatedUser = await groups[0].getUser();
        expect(associatedUser).to.be.null;
        await t.rollback();
      });
    }

    it('can set an association with predefined primary keys', async function() {
      const User = this.sequelize.define('UserXYZZ', { userCoolIdTag: { type: Sequelize.INTEGER, primaryKey: true }, username: Sequelize.STRING }),
        Task = this.sequelize.define('TaskXYZZ', { taskOrSomething: { type: Sequelize.INTEGER, primaryKey: true }, title: Sequelize.STRING });

      User.hasOne(Task, { foreignKey: 'userCoolIdTag' });

      await User.sync({ force: true });
      await Task.sync({ force: true });
      const user = await User.create({ userCoolIdTag: 1, username: 'foo' });
      const task = await Task.create({ taskOrSomething: 1, title: 'bar' });
      await user.setTaskXYZZ(task);
      const task0 = await user.getTaskXYZZ();
      expect(task0).not.to.be.null;

      await user.setTaskXYZZ(null);
      const _task = await user.getTaskXYZZ();
      expect(_task).to.be.null;
    });

    it('clears the association if null is passed', async function() {
      const User = this.sequelize.define('UserXYZ', { username: Sequelize.STRING }),
        Task = this.sequelize.define('TaskXYZ', { title: Sequelize.STRING });

      User.hasOne(Task);

      await User.sync({ force: true });
      await Task.sync({ force: true });
      const user = await User.create({ username: 'foo' });
      const task = await Task.create({ title: 'task' });
      await user.setTaskXYZ(task);
      const task1 = await user.getTaskXYZ();
      expect(task1).not.to.equal(null);

      await user.setTaskXYZ(null);
      const task0 = await user.getTaskXYZ();
      expect(task0).to.equal(null);
    });

    it('should throw a ForeignKeyConstraintError if the associated record does not exist', async function() {
      const User = this.sequelize.define('UserXYZ', { username: Sequelize.STRING }),
        Task = this.sequelize.define('TaskXYZ', { title: Sequelize.STRING });

      User.hasOne(Task);

      await User.sync({ force: true });
      await Task.sync({ force: true });
      await expect(Task.create({ title: 'task', UserXYZId: 5 })).to.be.rejectedWith(Sequelize.ForeignKeyConstraintError);
      const task = await Task.create({ title: 'task' });

      await expect(Task.update({ title: 'taskUpdate', UserXYZId: 5 }, { where: { id: task.id } })).to.be.rejectedWith(Sequelize.ForeignKeyConstraintError);
    });

    it('supports passing the primary key instead of an object', async function() {
      const User = this.sequelize.define('UserXYZ', { username: Sequelize.STRING }),
        Task = this.sequelize.define('TaskXYZ', { title: Sequelize.STRING });

      User.hasOne(Task);

      await this.sequelize.sync({ force: true });
      const user = await User.create({});
      const task = await Task.create({ id: 19, title: 'task it!' });
      await user.setTaskXYZ(task.id);
      const task0 = await user.getTaskXYZ();
      expect(task0.title).to.equal('task it!');
    });

    it('supports updating with a primary key instead of an object', async function() {
      const User = this.sequelize.define('UserXYZ', { username: Sequelize.STRING }),
        Task = this.sequelize.define('TaskXYZ', { title: Sequelize.STRING });

      User.hasOne(Task);

      await this.sequelize.sync({ force: true });

      const [user0, task1] = await Promise.all([
        User.create({ id: 1, username: 'foo' }),
        Task.create({ id: 20, title: 'bar' })
      ]);

      await user0.setTaskXYZ(task1.id);
      const task0 = await user0.getTaskXYZ();
      expect(task0).not.to.be.null;

      const [user, task2] = await Promise.all([
        user0,
        Task.create({ id: 2, title: 'bar2' })
      ]);

      await user.setTaskXYZ(task2.id);
      const task = await user.getTaskXYZ();
      expect(task).not.to.be.null;
    });

    it('supports setting same association twice', async function() {
      const Home = this.sequelize.define('home', {}),
        User = this.sequelize.define('user');

      User.hasOne(Home);

      await this.sequelize.sync({ force: true });

      const [home, user] = await Promise.all([
        Home.create(),
        User.create()
      ]);

      await user.setHome(home);
      await user.setHome(home);
      await expect(user.getHome()).to.eventually.have.property('id', home.get('id'));
    });
  });

  describe('createAssociation', () => {
    it('creates an associated model instance', async function() {
      const User = this.sequelize.define('User', { username: Sequelize.STRING }),
        Task = this.sequelize.define('Task', { title: Sequelize.STRING });

      User.hasOne(Task);

      await this.sequelize.sync({ force: true });
      const user = await User.create({ username: 'bob' });
      await user.createTask({ title: 'task' });
      const task = await user.getTask();
      expect(task).not.to.be.null;
      expect(task.title).to.equal('task');
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', async function() {
        const sequelize = await Support.prepareTransactionTest(this.sequelize);
        const User = sequelize.define('User', { username: Sequelize.STRING }),
          Group = sequelize.define('Group', { name: Sequelize.STRING });

        User.hasOne(Group);

        await sequelize.sync({ force: true });
        const user = await User.create({ username: 'bob' });
        const t = await sequelize.transaction();
        await user.createGroup({ name: 'testgroup' }, { transaction: t });
        const users = await User.findAll();
        const group = await users[0].getGroup();
        expect(group).to.be.null;
        const users0 = await User.findAll({ transaction: t });
        const group0 = await users0[0].getGroup({ transaction: t });
        expect(group0).to.be.not.null;
        await t.rollback();
      });
    }

  });

  describe('foreign key', () => {
    it('should setup underscored field with foreign keys when using underscored', function() {
      const User = this.sequelize.define('User', { username: Sequelize.STRING }, { underscored: true }),
        Account = this.sequelize.define('Account', { name: Sequelize.STRING }, { underscored: true });

      Account.hasOne(User);

      expect(User.rawAttributes.AccountId).to.exist;
      expect(User.rawAttributes.AccountId.field).to.equal('account_id');
    });

    it('should use model name when using camelcase', function() {
      const User = this.sequelize.define('User', { username: Sequelize.STRING }, { underscored: false }),
        Account = this.sequelize.define('Account', { name: Sequelize.STRING }, { underscored: false });

      Account.hasOne(User);

      expect(User.rawAttributes.AccountId).to.exist;
      expect(User.rawAttributes.AccountId.field).to.equal('AccountId');
    });

    it('should support specifying the field of a foreign key', async function() {
      const User = this.sequelize.define('UserXYZ', { username: Sequelize.STRING, gender: Sequelize.STRING }),
        Task = this.sequelize.define('TaskXYZ', { title: Sequelize.STRING, status: Sequelize.STRING });

      Task.hasOne(User, {
        foreignKey: {
          name: 'taskId',
          field: 'task_id'
        }
      });

      expect(User.rawAttributes.taskId).to.exist;
      expect(User.rawAttributes.taskId.field).to.equal('task_id');
      await Task.sync({ force: true });
      await User.sync({ force: true });

      const [user0, task0] = await Promise.all([
        User.create({ username: 'foo', gender: 'male' }),
        Task.create({ title: 'task', status: 'inactive' })
      ]);

      await task0.setUserXYZ(user0);
      const user = await task0.getUserXYZ();
      // the sql query should correctly look at task_id instead of taskId
      expect(user).to.not.be.null;

      const task = await Task.findOne({
        where: { title: 'task' },
        include: [User]
      });

      expect(task.UserXYZ).to.exist;
    });

    it('should support custom primary key field name in sub queries', async function() {
      const User = this.sequelize.define('UserXYZ', { username: Sequelize.STRING, gender: Sequelize.STRING }),
        Task = this.sequelize.define('TaskXYZ', { id: {
          field: 'Id',
          type: Sequelize.INTEGER,
          autoIncrement: true,
          primaryKey: true
        }, title: Sequelize.STRING, status: Sequelize.STRING });

      Task.hasOne(User);

      await Task.sync({ force: true });
      await User.sync({ force: true });

      const task0 = await Task.create({ title: 'task', status: 'inactive', User: { username: 'foo', gender: 'male' } }, { include: User });
      await expect(task0.reload({ subQuery: true })).to.not.eventually.be.rejected;
    });
  });

  describe('foreign key constraints', () => {
    it('are enabled by default', async function() {
      const Task = this.sequelize.define('Task', { title: Sequelize.STRING }),
        User = this.sequelize.define('User', { username: Sequelize.STRING });

      User.hasOne(Task); // defaults to set NULL

      await User.sync({ force: true });

      await Task.sync({ force: true });
      const user = await User.create({ username: 'foo' });
      const task = await Task.create({ title: 'task' });
      await user.setTask(task);
      await user.destroy();
      await task.reload();
      expect(task.UserId).to.equal(null);
    });

    it('sets to CASCADE if allowNull: false', async function() {
      const Task = this.sequelize.define('Task', { title: Sequelize.STRING }),
        User = this.sequelize.define('User', { username: Sequelize.STRING });

      User.hasOne(Task, { foreignKey: { allowNull: false } }); // defaults to CASCADE

      await this.sequelize.sync({ force: true });

      const user = await User.create({ username: 'foo' });
      await Task.create({ title: 'task', UserId: user.id });
      await user.destroy();
      const tasks = await Task.findAll();
      expect(tasks).to.be.empty;
    });

    it('should be possible to disable them', async function() {
      const Task = this.sequelize.define('Task', { title: Sequelize.STRING }),
        User = this.sequelize.define('User', { username: Sequelize.STRING });

      User.hasOne(Task, { constraints: false });

      await User.sync({ force: true });
      await Task.sync({ force: true });
      const user = await User.create({ username: 'foo' });
      const task = await Task.create({ title: 'task' });
      await user.setTask(task);
      await user.destroy();
      await task.reload();
      expect(task.UserId).to.equal(user.id);
    });

    it('can cascade deletes', async function() {
      const Task = this.sequelize.define('Task', { title: Sequelize.STRING }),
        User = this.sequelize.define('User', { username: Sequelize.STRING });

      User.hasOne(Task, { onDelete: 'cascade' });

      await User.sync({ force: true });
      await Task.sync({ force: true });
      const user = await User.create({ username: 'foo' });
      const task = await Task.create({ title: 'task' });
      await user.setTask(task);
      await user.destroy();
      const tasks = await Task.findAll();
      expect(tasks).to.have.length(0);
    });

    it('works when cascading a delete with hooks but there is no associate (i.e. "has zero")', async function() {
      const Task = this.sequelize.define('Task', { title: Sequelize.STRING }),
        User = this.sequelize.define('User', { username: Sequelize.STRING });

      User.hasOne(Task, { onDelete: 'cascade', hooks: true });

      await User.sync({ force: true });
      await Task.sync({ force: true });
      const user = await User.create({ username: 'foo' });

      await user.destroy();
    });

    // NOTE: mssql does not support changing an autoincrement primary key
    if (!['mssql', 'db2', 'oracle'].includes(Support.getTestDialect())) {
      it('can cascade updates', async function() {
        const Task = this.sequelize.define('Task', { title: Sequelize.STRING }),
          User = this.sequelize.define('User', { username: Sequelize.STRING });

        User.hasOne(Task, { onUpdate: 'cascade' });

        await User.sync({ force: true });
        await Task.sync({ force: true });
        const user = await User.create({ username: 'foo' });
        const task = await Task.create({ title: 'task' });
        await user.setTask(task);

        // Changing the id of a DAO requires a little dance since
        // the `UPDATE` query generated by `save()` uses `id` in the
        // `WHERE` clause

        const tableName = user.sequelize.getQueryInterface().queryGenerator.addSchema(user.constructor);
        await user.sequelize.getQueryInterface().update(user, tableName, { id: 999 }, { id: user.id });
        const tasks = await Task.findAll();
        expect(tasks).to.have.length(1);
        expect(tasks[0].UserId).to.equal(999);
      });
    }

    if (current.dialect.supports.constraints.restrict) {

      it('can restrict deletes', async function() {
        const Task = this.sequelize.define('Task', { title: Sequelize.STRING }),
          User = this.sequelize.define('User', { username: Sequelize.STRING });

        User.hasOne(Task, { onDelete: 'restrict' });

        await User.sync({ force: true });
        await Task.sync({ force: true });
        const user = await User.create({ username: 'foo' });
        const task = await Task.create({ title: 'task' });
        await user.setTask(task);
        await expect(user.destroy()).to.eventually.be.rejectedWith(Sequelize.ForeignKeyConstraintError);
        const tasks = await Task.findAll();
        expect(tasks).to.have.length(1);
      });

      it('can restrict updates', async function() {
        const Task = this.sequelize.define('Task', { title: Sequelize.STRING }),
          User = this.sequelize.define('User', { username: Sequelize.STRING });

        User.hasOne(Task, { onUpdate: 'restrict' });

        await User.sync({ force: true });
        await Task.sync({ force: true });
        const user = await User.create({ username: 'foo' });
        const task = await Task.create({ title: 'task' });
        await user.setTask(task);

        // Changing the id of a DAO requires a little dance since
        // the `UPDATE` query generated by `save()` uses `id` in the
        // `WHERE` clause

        const tableName = user.sequelize.getQueryInterface().queryGenerator.addSchema(user.constructor);

        await expect(
          user.sequelize.getQueryInterface().update(user, tableName, { id: 999 }, { id: user.id })
        ).to.eventually.be.rejectedWith(Sequelize.ForeignKeyConstraintError);

        // Should fail due to FK restriction
        const tasks = await Task.findAll();

        expect(tasks).to.have.length(1);
      });

    }

  });

  describe('association column', () => {
    it('has correct type for non-id primary keys with non-integer type', async function() {
      const User = this.sequelize.define('UserPKBT', {
        username: {
          type: Sequelize.STRING
        }
      });

      const Group = this.sequelize.define('GroupPKBT', {
        name: {
          type: Sequelize.STRING,
          primaryKey: true
        }
      });

      Group.hasOne(User);

      await this.sequelize.sync({ force: true });
      expect(User.rawAttributes.GroupPKBTName.type).to.an.instanceof(Sequelize.STRING);
    });

    it('should support a non-primary key as the association column on a target with custom primary key', async function() {
      const User = this.sequelize.define('User', {
        user_name: {
          unique: true,
          type: Sequelize.STRING
        }
      });

      const Task = this.sequelize.define('Task', {
        title: Sequelize.STRING,
        username: Sequelize.STRING
      });

      User.hasOne(Task, { foreignKey: 'username', sourceKey: 'user_name' });

      await this.sequelize.sync({ force: true });
      const newUser = await User.create({ user_name: 'bob' });
      const newTask = await Task.create({ title: 'some task' });
      await newUser.setTask(newTask);
      const foundUser = await User.findOne({ where: { user_name: 'bob' } });
      const foundTask = await foundUser.getTask();
      expect(foundTask.title).to.equal('some task');
    });

    it('should support a non-primary unique key as the association column', async function() {
      const User = this.sequelize.define('User', {
        username: {
          type: Sequelize.STRING,
          unique: true
        }
      });

      const Task = this.sequelize.define('Task', {
        title: Sequelize.STRING,
        username: Sequelize.STRING
      });

      User.hasOne(Task, { foreignKey: 'username', sourceKey: 'username' });

      await this.sequelize.sync({ force: true });
      const newUser = await User.create({ username: 'bob' });
      const newTask = await Task.create({ title: 'some task' });
      await newUser.setTask(newTask);
      const foundUser = await User.findOne({ where: { username: 'bob' } });
      const foundTask = await foundUser.getTask();
      expect(foundTask.title).to.equal('some task');
    });

    it('should support a non-primary unique key as the association column with a field option', async function() {
      const User = this.sequelize.define('User', {
        username: {
          type: Sequelize.STRING,
          unique: true,
          field: 'the_user_name_field'
        }
      });

      const Task = this.sequelize.define('Task', {
        title: Sequelize.STRING,
        username: Sequelize.STRING
      });

      User.hasOne(Task, { foreignKey: 'username', sourceKey: 'username' });

      await this.sequelize.sync({ force: true });
      const newUser = await User.create({ username: 'bob' });
      const newTask = await Task.create({ title: 'some task' });
      await newUser.setTask(newTask);
      const foundUser = await User.findOne({ where: { username: 'bob' } });
      const foundTask = await foundUser.getTask();
      expect(foundTask.title).to.equal('some task');
    });
  });

  describe('Association options', () => {
    it('can specify data type for autogenerated relational keys', async function() {
      const User = this.sequelize.define('UserXYZ', { username: Sequelize.STRING }),
        dataTypes = [Sequelize.INTEGER, Sequelize.BIGINT, Sequelize.STRING],
        Tasks = {};

      await Promise.all(dataTypes.map(async dataType => {
        const tableName = `TaskXYZ_${dataType.key}`;
        Tasks[dataType] = this.sequelize.define(tableName, { title: Sequelize.STRING });

        User.hasOne(Tasks[dataType], { foreignKey: 'userId', keyType: dataType, constraints: false });

        await Tasks[dataType].sync({ force: true });
        expect(Tasks[dataType].rawAttributes.userId.type).to.be.an.instanceof(dataType);
      }));
    });

    describe('allows the user to provide an attribute definition object as foreignKey', () => {
      it('works with a column that hasnt been defined before', function() {
        const User = this.sequelize.define('user', {});
        let Profile = this.sequelize.define('project', {});

        User.hasOne(Profile, {
          foreignKey: {
            allowNull: false,
            name: 'uid'
          }
        });

        expect(Profile.rawAttributes.uid).to.be.ok;
        expect(Profile.rawAttributes.uid.references.model).to.equal(User.getTableName());
        expect(Profile.rawAttributes.uid.references.key).to.equal('id');
        expect(Profile.rawAttributes.uid.allowNull).to.be.false;

        // Let's clear it
        Profile = this.sequelize.define('project', {});
        User.hasOne(Profile, {
          foreignKey: {
            allowNull: false,
            name: 'uid'
          }
        });

        expect(Profile.rawAttributes.uid).to.be.ok;
        expect(Profile.rawAttributes.uid.references.model).to.equal(User.getTableName());
        expect(Profile.rawAttributes.uid.references.key).to.equal('id');
        expect(Profile.rawAttributes.uid.allowNull).to.be.false;
      });

      it('works when taking a column directly from the object', function() {
        const User = this.sequelize.define('user', {
            uid: {
              type: Sequelize.INTEGER,
              primaryKey: true
            }
          }),
          Profile = this.sequelize.define('project', {
            user_id: {
              type: Sequelize.INTEGER,
              allowNull: false
            }
          });

        User.hasOne(Profile, { foreignKey: Profile.rawAttributes.user_id });

        expect(Profile.rawAttributes.user_id).to.be.ok;
        expect(Profile.rawAttributes.user_id.references.model).to.equal(User.getTableName());
        expect(Profile.rawAttributes.user_id.references.key).to.equal('uid');
        expect(Profile.rawAttributes.user_id.allowNull).to.be.false;
      });

      it('works when merging with an existing definition', function() {
        const User = this.sequelize.define('user', {
            uid: {
              type: Sequelize.INTEGER,
              primaryKey: true
            }
          }),
          Project = this.sequelize.define('project', {
            userUid: {
              type: Sequelize.INTEGER,
              defaultValue: 42
            }
          });

        User.hasOne(Project, { foreignKey: { allowNull: false } });

        expect(Project.rawAttributes.userUid).to.be.ok;
        expect(Project.rawAttributes.userUid.allowNull).to.be.false;
        expect(Project.rawAttributes.userUid.references.model).to.equal(User.getTableName());
        expect(Project.rawAttributes.userUid.references.key).to.equal('uid');
        expect(Project.rawAttributes.userUid.defaultValue).to.equal(42);
      });
    });

    it('should throw an error if an association clashes with the name of an already define attribute', function() {
      const User = this.sequelize.define('user', {
          attribute: Sequelize.STRING
        }),
        Attribute = this.sequelize.define('attribute', {});

      expect(User.hasOne.bind(User, Attribute)).to
        .throw('Naming collision between attribute \'attribute\' and association \'attribute\' on model user. To remedy this, change either foreignKey or as in your association definition');
    });
  });

  describe('Counter part', () => {
    describe('BelongsTo', () => {
      it('should only generate one foreign key', function() {
        const Orders = this.sequelize.define('Orders', {}, { timestamps: false }),
          InternetOrders = this.sequelize.define('InternetOrders', {}, { timestamps: false });

        InternetOrders.belongsTo(Orders, {
          foreignKeyConstraint: true
        });
        Orders.hasOne(InternetOrders, {
          foreignKeyConstraint: true
        });

        expect(Object.keys(InternetOrders.rawAttributes).length).to.equal(2);
        expect(InternetOrders.rawAttributes.OrderId).to.be.ok;
        expect(InternetOrders.rawAttributes.OrdersId).not.to.be.ok;
      });
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
      this.Individual.hasOne(this.Hat, {
        as: 'personwearinghat'
      });
    });

    it('should load with an alias', async function() {
      await this.sequelize.sync({ force: true });

      const [individual1, hat] = await Promise.all([
        this.Individual.create({ name: 'Foo Bar' }),
        this.Hat.create({ name: 'Baz' })
      ]);

      await individual1.setPersonwearinghat(hat);

      const individual0 = await this.Individual.findOne({
        where: { name: 'Foo Bar' },
        include: [{ model: this.Hat, as: 'personwearinghat' }]
      });

      expect(individual0.name).to.equal('Foo Bar');
      expect(individual0.personwearinghat.name).to.equal('Baz');

      const individual = await this.Individual.findOne({
        where: { name: 'Foo Bar' },
        include: [{
          model: this.Hat,
          as: { singular: 'personwearinghat' }
        }]
      });

      expect(individual.name).to.equal('Foo Bar');
      expect(individual.personwearinghat.name).to.equal('Baz');
    });

    it('should load all', async function() {
      await this.sequelize.sync({ force: true });

      const [individual0, hat] = await Promise.all([
        this.Individual.create({ name: 'Foo Bar' }),
        this.Hat.create({ name: 'Baz' })
      ]);

      await individual0.setPersonwearinghat(hat);

      const individual = await this.Individual.findOne({
        where: { name: 'Foo Bar' },
        include: [{ all: true }]
      });

      expect(individual.name).to.equal('Foo Bar');
      expect(individual.personwearinghat.name).to.equal('Baz');
    });
  });
});
