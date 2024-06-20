'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../support');
const { DataTypes, Sequelize } = require('@sequelize/core');

const current = Support.sequelize;
const dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('HasOne'), () => {
  describe('get', () => {
    describe('multiple', () => {
      it('should fetch associations for multiple instances', async function () {
        const User = this.sequelize.define('User', {});
        const Player = this.sequelize.define('Player', {});

        Player.User = Player.hasOne(User, { as: 'user' });

        await this.sequelize.sync({ force: true });

        const players = await Promise.all([
          Player.create(
            {
              id: 1,
              user: {},
            },
            {
              include: [Player.User],
            },
          ),
          Player.create(
            {
              id: 2,
              user: {},
            },
            {
              include: [Player.User],
            },
          ),
          Player.create({
            id: 3,
          }),
        ]);

        const result = await Player.User.get(players);
        expect(result.get(players[0].id).id).to.equal(players[0].user.id);
        expect(result.get(players[1].id).id).to.equal(players[1].user.id);
        expect(result.get(players[2].id)).to.equal(undefined);
      });
    });
  });

  describe('getAssociation', () => {
    if (current.dialect.supports.transactions) {
      it('supports transactions', async function () {
        const sequelize = await Support.createSingleTransactionalTestSequelizeInstance(
          this.sequelize,
        );
        const User = sequelize.define('User', { username: DataTypes.STRING });
        const Group = sequelize.define('Group', { name: DataTypes.STRING });

        Group.hasOne(User);

        await sequelize.sync({ force: true });
        const fakeUser = await User.create({ username: 'foo' });
        const user = await User.create({ username: 'foo' });
        const group = await Group.create({ name: 'bar' });
        const t = await sequelize.startUnmanagedTransaction();
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

    it("should be able to handle a where object that's a first class citizen.", async function () {
      const User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING });
      const Task = this.sequelize.define('TaskXYZ', {
        title: DataTypes.STRING,
        status: DataTypes.STRING,
      });

      User.hasOne(Task);

      await User.sync({ force: true });
      await Task.sync({ force: true });
      const user = await User.create({ username: 'foo' });
      const task = await Task.create({ title: 'task', status: 'inactive' });
      await user.setTaskXYZ(task);
      const task0 = await user.getTaskXYZ({ where: { status: 'active' } });
      expect(task0).to.be.null;
    });

    if (current.dialect.supports.schemas) {
      it('supports schemas', async function () {
        const User = this.sequelize
          .define('User', { username: DataTypes.STRING })
          .withSchema('admin');
        const Group = this.sequelize
          .define('Group', { name: DataTypes.STRING })
          .withSchema('admin');

        Group.hasOne(User);

        await this.sequelize.createSchema('admin');
        await Group.sync({ force: true });
        await User.sync({ force: true });

        const [fakeUser, user, group] = await Promise.all([
          User.create({ username: 'foo' }),
          User.create({ username: 'foo' }),
          Group.create({ name: 'bar' }),
        ]);

        await group.setUser(user);
        const groups = await Group.findAll();
        const associatedUser = await groups[0].getUser();
        expect(associatedUser).not.to.be.null;
        expect(associatedUser.id).to.equal(user.id);
        expect(associatedUser.id).not.to.equal(fakeUser.id);
        await this.sequelize.queryInterface.dropAllTables({ schema: 'admin' });
        await this.sequelize.dropSchema('admin');
        const schemas = await this.sequelize.queryInterface.listSchemas();
        expect(schemas).to.not.include('admin');
      });
    }
  });

  describe('createAssociation', () => {
    it('creates an associated model instance', async function () {
      const User = this.sequelize.define('User', { username: DataTypes.STRING });
      const Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      User.hasOne(Task);

      await this.sequelize.sync({ force: true });
      const user = await User.create({ username: 'bob' });
      await user.createTask({ title: 'task' });
      const task = await user.getTask();
      expect(task).not.to.be.null;
      expect(task.title).to.equal('task');
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', async function () {
        const sequelize = await Support.createSingleTransactionalTestSequelizeInstance(
          this.sequelize,
        );
        const User = sequelize.define('User', { username: DataTypes.STRING });
        const Group = sequelize.define('Group', { name: DataTypes.STRING });

        User.hasOne(Group);

        await sequelize.sync({ force: true });
        const user = await User.create({ username: 'bob' });
        const t = await sequelize.startUnmanagedTransaction();
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
    it('throws a ForeignKeyConstraintError if the associated record does not exist', async function () {
      const User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING });
      const Task = this.sequelize.define('TaskXYZ', { title: DataTypes.STRING });

      User.hasOne(Task);

      await User.sync({ force: true });
      await Task.sync({ force: true });
      await expect(Task.create({ title: 'task', userXYZId: 5 })).to.be.rejectedWith(
        Sequelize.ForeignKeyConstraintError,
      );
      const task = await Task.create({ title: 'task' });

      await expect(
        Task.update({ title: 'taskUpdate', userXYZId: 5 }, { where: { id: task.id } }),
      ).to.be.rejectedWith(Sequelize.ForeignKeyConstraintError);
    });

    it('should setup underscored field with foreign keys when using underscored', function () {
      const User = this.sequelize.define(
        'User',
        { username: DataTypes.STRING },
        { underscored: true },
      );
      const Account = this.sequelize.define(
        'Account',
        { name: DataTypes.STRING },
        { underscored: true },
      );

      Account.hasOne(User);

      expect(User.getAttributes().accountId).to.exist;
      expect(User.getAttributes().accountId.field).to.equal('account_id');
    });

    it('should use model name when using camelcase', function () {
      const User = this.sequelize.define(
        'User',
        { username: DataTypes.STRING },
        { underscored: false },
      );
      const Account = this.sequelize.define(
        'Account',
        { name: DataTypes.STRING },
        { underscored: false },
      );

      Account.hasOne(User);

      expect(User.getAttributes().accountId).to.exist;
      expect(User.getAttributes().accountId.field).to.equal('accountId');
    });

    it('should support specifying the field of a foreign key', async function () {
      const User = this.sequelize.define('UserXYZ', {
        username: DataTypes.STRING,
        gender: DataTypes.STRING,
      });
      const Task = this.sequelize.define('TaskXYZ', {
        title: DataTypes.STRING,
        status: DataTypes.STRING,
      });

      Task.hasOne(User, {
        foreignKey: {
          name: 'taskId',
          field: 'task_id',
        },
      });

      expect(User.getAttributes().taskId).to.exist;
      expect(User.getAttributes().taskId.field).to.equal('task_id');
      await Task.sync({ force: true });
      await User.sync({ force: true });

      const [user0, task0] = await Promise.all([
        User.create({ username: 'foo', gender: 'male' }),
        Task.create({ title: 'task', status: 'inactive' }),
      ]);

      await task0.setUserXYZ(user0);
      const user = await task0.getUserXYZ();
      // the sql query should correctly look at task_id instead of taskId
      expect(user).to.not.be.null;

      const task = await Task.findOne({
        where: { title: 'task' },
        include: [User],
      });

      expect(task.userXYZ).to.exist;
    });

    it('should support custom primary key field name in sub queries', async function () {
      const User = this.sequelize.define('UserXYZ', {
        username: DataTypes.STRING,
        gender: DataTypes.STRING,
      });
      const Task = this.sequelize.define('TaskXYZ', {
        id: {
          field: 'Id',
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
        },
        title: DataTypes.STRING,
        status: DataTypes.STRING,
      });

      Task.hasOne(User);

      await Task.sync({ force: true });
      await User.sync({ force: true });

      const task0 = await Task.create(
        { title: 'task', status: 'inactive', User: { username: 'foo', gender: 'male' } },
        { include: User },
      );
      await expect(task0.reload({ subQuery: true })).to.not.eventually.be.rejected;
    });
  });

  describe('foreign key constraints', () => {
    it('are enabled by default', async function () {
      const Task = this.sequelize.define('Task', { title: DataTypes.STRING });
      const User = this.sequelize.define('User', { username: DataTypes.STRING });

      User.hasOne(Task); // defaults to set NULL

      await User.sync({ force: true });

      await Task.sync({ force: true });
      const user = await User.create({ username: 'foo' });
      const task = await Task.create({ title: 'task' });
      await user.setTask(task);
      await user.destroy();
      await task.reload();
      expect(task.userId).to.equal(null);
    });

    it('should be possible to disable them', async function () {
      const Task = this.sequelize.define('Task', { title: DataTypes.STRING });
      const User = this.sequelize.define('User', { username: DataTypes.STRING });

      User.hasOne(Task, { foreignKeyConstraints: false });

      await User.sync({ force: true });
      await Task.sync({ force: true });
      const user = await User.create({ username: 'foo' });
      const task = await Task.create({ title: 'task' });
      await user.setTask(task);
      await user.destroy();
      await task.reload();
      expect(task.userId).to.equal(user.id);
    });

    it('can cascade deletes', async function () {
      const Task = this.sequelize.define('Task', { title: DataTypes.STRING });
      const User = this.sequelize.define('User', { username: DataTypes.STRING });

      User.hasOne(Task, { foreignKey: { onDelete: 'cascade' } });

      await User.sync({ force: true });
      await Task.sync({ force: true });
      const user = await User.create({ username: 'foo' });
      const task = await Task.create({ title: 'task' });
      await user.setTask(task);
      await user.destroy();
      const tasks = await Task.findAll();
      expect(tasks).to.have.length(0);
    });

    it('works when cascading a delete with hooks but there is no associate (i.e. "has zero")', async function () {
      const Task = this.sequelize.define('Task', { title: DataTypes.STRING });
      const User = this.sequelize.define('User', { username: DataTypes.STRING });

      User.hasOne(Task, { foreignKey: { onDelete: 'cascade' }, hooks: true });

      await User.sync({ force: true });
      await Task.sync({ force: true });
      const user = await User.create({ username: 'foo' });

      await user.destroy();
    });

    // NOTE: mssql does not support changing an autoincrement primary key
    if (!['mssql', 'db2', 'ibmi'].includes(dialect)) {
      it('can cascade updates', async function () {
        const Task = this.sequelize.define('Task', { title: DataTypes.STRING });
        const User = this.sequelize.define('User', { username: DataTypes.STRING });

        User.hasOne(Task, { foreignKey: { onUpdate: 'cascade' } });

        await User.sync({ force: true });
        await Task.sync({ force: true });
        const user = await User.create({ username: 'foo' });
        const task = await Task.create({ title: 'task' });
        await user.setTask(task);

        // Changing the id of a DAO requires a little dance since
        // the `UPDATE` query generated by `save()` uses `id` in the
        // `WHERE` clause

        const tableName = User.table;
        await user.sequelize.queryInterface.update(user, tableName, { id: 999 }, { id: user.id });
        const tasks = await Task.findAll();
        expect(tasks).to.have.length(1);
        expect(tasks[0].userId).to.equal(999);
      });
    }

    if (current.dialect.supports.constraints.restrict) {
      it('can restrict deletes', async function () {
        const Task = this.sequelize.define('Task', { title: DataTypes.STRING });
        const User = this.sequelize.define('User', { username: DataTypes.STRING });

        User.hasOne(Task, { foreignKey: { onDelete: 'restrict' } });

        await User.sync({ force: true });
        await Task.sync({ force: true });
        const user = await User.create({ username: 'foo' });
        const task = await Task.create({ title: 'task' });
        await user.setTask(task);
        await expect(user.destroy()).to.eventually.be.rejectedWith(
          Sequelize.ForeignKeyConstraintError,
        );
        const tasks = await Task.findAll();
        expect(tasks).to.have.length(1);
      });

      it('can restrict updates', async function () {
        const Task = this.sequelize.define('Task', { title: DataTypes.STRING });
        const User = this.sequelize.define('User', { username: DataTypes.STRING });

        User.hasOne(Task, { foreignKey: { onUpdate: 'restrict' } });

        await User.sync({ force: true });
        await Task.sync({ force: true });
        const user = await User.create({ username: 'foo' });
        const task = await Task.create({ title: 'task' });
        await user.setTask(task);

        // Changing the id of a DAO requires a little dance since
        // the `UPDATE` query generated by `save()` uses `id` in the
        // `WHERE` clause

        const tableName = User.table;

        await expect(
          user.sequelize.queryInterface.update(user, tableName, { id: 999 }, { id: user.id }),
        ).to.eventually.be.rejectedWith(Sequelize.ForeignKeyConstraintError);

        // Should fail due to FK restriction
        const tasks = await Task.findAll();

        expect(tasks).to.have.length(1);
      });
    }
  });

  describe('association column', () => {
    it('has correct type for non-id primary keys with non-integer type', async function () {
      const User = this.sequelize.define('UserPKBT', {
        username: {
          type: DataTypes.STRING,
        },
      });

      const Group = this.sequelize.define('GroupPKBT', {
        name: {
          type: DataTypes.STRING,
          primaryKey: true,
        },
      });

      Group.hasOne(User);

      await this.sequelize.sync({ force: true });
      expect(User.getAttributes().groupPKBTName.type).to.an.instanceof(DataTypes.STRING);
    });

    it('should support a non-primary key as the association column on a target with custom primary key', async function () {
      const User = this.sequelize.define('User', {
        user_name: {
          unique: true,
          type: DataTypes.STRING,
        },
      });

      const Task = this.sequelize.define('Task', {
        title: DataTypes.STRING,
        username: DataTypes.STRING,
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

    it('should support a non-primary unique key as the association column', async function () {
      const User = this.sequelize.define('User', {
        username: {
          type: DataTypes.STRING,
          unique: true,
        },
      });

      const Task = this.sequelize.define('Task', {
        title: DataTypes.STRING,
        username: DataTypes.STRING,
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

    it('should support a non-primary unique key as the association column with a field option', async function () {
      const User = this.sequelize.define('User', {
        username: {
          type: DataTypes.STRING,
          unique: true,
          field: 'the_user_name_field',
        },
      });

      const Task = this.sequelize.define('Task', {
        title: DataTypes.STRING,
        username: DataTypes.STRING,
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
    it('can specify data type for autogenerated relational keys', async function () {
      const User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING });
      const dataTypes = [DataTypes.INTEGER, DataTypes.STRING];
      const Tasks = {};

      if (current.dialect.supports.dataTypes.BIGINT) {
        dataTypes.push(DataTypes.BIGINT);
      }

      await Promise.all(
        dataTypes.map(async dataType => {
          const tableName = `TaskXYZ_${dataType.getDataTypeId()}`;
          Tasks[dataType] = this.sequelize.define(tableName, { title: DataTypes.STRING });

          User.hasOne(Tasks[dataType], {
            foreignKey: { name: 'userId', type: dataType },
            foreignKeyConstraints: false,
          });

          await Tasks[dataType].sync({ force: true });
          expect(Tasks[dataType].getAttributes().userId.type).to.be.an.instanceof(dataType);
        }),
      );
    });
  });

  describe('Counter part', () => {
    describe('BelongsTo', () => {
      it('should only generate one foreign key', function () {
        const Orders = this.sequelize.define('Orders', {}, { timestamps: false });
        const InternetOrders = this.sequelize.define('InternetOrders', {}, { timestamps: false });

        InternetOrders.belongsTo(Orders, {
          foreignKeyConstraints: true,
          inverse: {
            type: 'hasOne',
          },
        });

        expect(Object.keys(InternetOrders.getAttributes()).length).to.equal(2);

        // The model is named incorrectly.
        // The modal name should always be singular, so here sequelize assumes that "Orders" is singular
        expect(InternetOrders.getAttributes().ordersId).to.be.ok;
        expect(InternetOrders.getAttributes().orderId).not.to.be.ok;
      });
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
      this.Individual.hasOne(this.Hat, {
        as: 'personwearinghat',
      });
    });

    it('should load with an alias', async function () {
      await this.sequelize.sync({ force: true });

      const [individual1, hat] = await Promise.all([
        this.Individual.create({ name: 'Foo Bar' }),
        this.Hat.create({ name: 'Baz' }),
      ]);

      await individual1.setPersonwearinghat(hat);

      const individual0 = await this.Individual.findOne({
        where: { name: 'Foo Bar' },
        include: [{ model: this.Hat, as: 'personwearinghat' }],
      });

      expect(individual0.name).to.equal('Foo Bar');
      expect(individual0.personwearinghat.name).to.equal('Baz');
    });

    it('should load all', async function () {
      await this.sequelize.sync({ force: true });

      const [individual0, hat] = await Promise.all([
        this.Individual.create({ name: 'Foo Bar' }),
        this.Hat.create({ name: 'Baz' }),
      ]);

      await individual0.setPersonwearinghat(hat);

      const individual = await this.Individual.findOne({
        where: { name: 'Foo Bar' },
        include: [{ all: true }],
      });

      expect(individual.name).to.equal('Foo Bar');
      expect(individual.personwearinghat.name).to.equal('Baz');
    });
  });
});
