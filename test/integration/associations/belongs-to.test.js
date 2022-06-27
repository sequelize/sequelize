'use strict';

const chai = require('chai'),
  sinon = require('sinon'),
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('sequelize/lib/data-types'),
  Sequelize = require('sequelize'),
  current = Support.sequelize,
  dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('BelongsTo'), () => {
  describe('Model.associations', () => {
    it('should store all associations when associating to the same table multiple times', function() {
      const User = this.sequelize.define('User', {}),
        Group = this.sequelize.define('Group', {});

      Group.belongsTo(User);
      Group.belongsTo(User, { foreignKey: 'primaryGroupId', as: 'primaryUsers' });
      Group.belongsTo(User, { foreignKey: 'secondaryGroupId', as: 'secondaryUsers' });

      expect(
        Object.keys(Group.associations)
      ).to.deep.equal(['User', 'primaryUsers', 'secondaryUsers']);
    });
  });

  describe('get', () => {
    describe('multiple', () => {
      it('should fetch associations for multiple instances', async function() {
        const User = this.sequelize.define('User', {}),
          Task = this.sequelize.define('Task', {});

        Task.User = Task.belongsTo(User, { as: 'user' });

        await this.sequelize.sync({ force: true });

        const tasks = await Promise.all([Task.create({
          id: 1,
          user: { id: 1 }
        }, {
          include: [Task.User]
        }), Task.create({
          id: 2,
          user: { id: 2 }
        }, {
          include: [Task.User]
        }), Task.create({
          id: 3
        })]);

        const result = await Task.User.get(tasks);
        expect(result[tasks[0].id].id).to.equal(tasks[0].user.id);
        expect(result[tasks[1].id].id).to.equal(tasks[1].user.id);
        expect(result[tasks[2].id]).to.be.undefined;
      });
    });
  });

  describe('getAssociation', () => {
    if (current.dialect.supports.transactions) {
      it('supports transactions', async function() {
        const sequelize = await Support.prepareTransactionTest(this.sequelize);
        const User = sequelize.define('User', { username: Support.Sequelize.STRING }),
          Group = sequelize.define('Group', { name: Support.Sequelize.STRING });

        Group.belongsTo(User);

        await sequelize.sync({ force: true });
        const user = await User.create({ username: 'foo' });
        const group = await Group.create({ name: 'bar' });
        const t = await sequelize.transaction();
        await group.setUser(user, { transaction: t });
        const groups = await Group.findAll();
        const associatedUser = await groups[0].getUser();
        expect(associatedUser).to.be.null;
        const groups0 = await Group.findAll({ transaction: t });
        const associatedUser0 = await groups0[0].getUser({ transaction: t });
        expect(associatedUser0).to.be.not.null;
        await t.rollback();
      });
    }

    it('should be able to handle a where object that\'s a first class citizen.', async function() {
      const User = this.sequelize.define('UserXYZ', { username: Sequelize.STRING, gender: Sequelize.STRING }),
        Task = this.sequelize.define('TaskXYZ', { title: Sequelize.STRING, status: Sequelize.STRING });

      Task.belongsTo(User);

      await User.sync({ force: true });
      // Can't use Promise.all cause of foreign key references
      await Task.sync({ force: true });

      const [userA, , task] = await Promise.all([
        User.create({ username: 'foo', gender: 'male' }),
        User.create({ username: 'bar', gender: 'female' }),
        Task.create({ title: 'task', status: 'inactive' })
      ]);

      await task.setUserXYZ(userA);
      const user = await task.getUserXYZ({ where: { gender: 'female' } });
      expect(user).to.be.null;
    });

    it('supports schemas', async function() {
      const User = this.sequelize.define('UserXYZ', { username: Sequelize.STRING, gender: Sequelize.STRING }).schema('archive'),
        Task = this.sequelize.define('TaskXYZ', { title: Sequelize.STRING, status: Sequelize.STRING }).schema('archive');

      Task.belongsTo(User);

      await Support.dropTestSchemas(this.sequelize);
      await this.sequelize.createSchema('archive');
      await User.sync({ force: true });
      await Task.sync({ force: true });

      const [user0, task] = await Promise.all([
        User.create({ username: 'foo', gender: 'male' }),
        Task.create({ title: 'task', status: 'inactive' })
      ]);

      await task.setUserXYZ(user0);
      const user = await task.getUserXYZ();
      expect(user).to.be.ok;
      await this.sequelize.dropSchema('archive');
      const schemas = await this.sequelize.showAllSchemas();
      if (['postgres', 'mssql', 'mariadb'].includes(dialect)) {
        expect(schemas).to.not.have.property('archive');
      }
    });

    it('supports schemas when defining custom foreign key attribute #9029', async function() {
      const User = this.sequelize.define('UserXYZ', {
          uid: {
            type: Sequelize.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false
          }
        }).schema('archive'),
        Task = this.sequelize.define('TaskXYZ', {
          user_id: {
            type: Sequelize.INTEGER,
            references: { model: User, key: 'uid' }
          }
        }).schema('archive');

      Task.belongsTo(User, { foreignKey: 'user_id' });

      await Support.dropTestSchemas(this.sequelize);
      await this.sequelize.createSchema('archive');
      await User.sync({ force: true });
      await Task.sync({ force: true });
      const user0 = await User.create({});
      const task = await Task.create({});
      await task.setUserXYZ(user0);
      const user = await task.getUserXYZ();
      expect(user).to.be.ok;

      await this.sequelize.dropSchema('archive');
    });
  });

  describe('setAssociation', () => {

    if (current.dialect.supports.transactions) {
      it('supports transactions', async function() {
        const sequelize = await Support.prepareTransactionTest(this.sequelize);
        const User = sequelize.define('User', { username: Support.Sequelize.STRING }),
          Group = sequelize.define('Group', { name: Support.Sequelize.STRING });

        Group.belongsTo(User);

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

    it('can set the association with declared primary keys...', async function() {
      const User = this.sequelize.define('UserXYZ', { user_id: { type: DataTypes.INTEGER, primaryKey: true }, username: DataTypes.STRING }),
        Task = this.sequelize.define('TaskXYZ', { task_id: { type: DataTypes.INTEGER, primaryKey: true }, title: DataTypes.STRING });

      Task.belongsTo(User, { foreignKey: 'user_id' });

      await this.sequelize.sync({ force: true });
      const user = await User.create({ user_id: 1, username: 'foo' });
      const task = await Task.create({ task_id: 1, title: 'task' });
      await task.setUserXYZ(user);
      const user1 = await task.getUserXYZ();
      expect(user1).not.to.be.null;

      await task.setUserXYZ(null);
      const user0 = await task.getUserXYZ();
      expect(user0).to.be.null;
    });

    it('clears the association if null is passed', async function() {
      const User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING }),
        Task = this.sequelize.define('TaskXYZ', { title: DataTypes.STRING });

      Task.belongsTo(User);

      await this.sequelize.sync({ force: true });
      const user = await User.create({ username: 'foo' });
      const task = await Task.create({ title: 'task' });
      await task.setUserXYZ(user);
      const user1 = await task.getUserXYZ();
      expect(user1).not.to.be.null;

      await task.setUserXYZ(null);
      const user0 = await task.getUserXYZ();
      expect(user0).to.be.null;
    });

    it('should throw a ForeignKeyConstraintError if the associated record does not exist', async function() {
      const User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING }),
        Task = this.sequelize.define('TaskXYZ', { title: DataTypes.STRING });

      Task.belongsTo(User);

      await this.sequelize.sync({ force: true });
      await expect(Task.create({ title: 'task', UserXYZId: 5 })).to.be.rejectedWith(Sequelize.ForeignKeyConstraintError);
      const task = await Task.create({ title: 'task' });

      await expect(Task.update({ title: 'taskUpdate', UserXYZId: 5 }, { where: { id: task.id } })).to.be.rejectedWith(Sequelize.ForeignKeyConstraintError);
    });

    it('supports passing the primary key instead of an object', async function() {
      const User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING }),
        Task = this.sequelize.define('TaskXYZ', { title: DataTypes.STRING });

      Task.belongsTo(User);

      await this.sequelize.sync({ force: true });
      const user = await User.create({ id: 15, username: 'jansemand' });
      const task = await Task.create({});
      await task.setUserXYZ(user.id);
      const user0 = await task.getUserXYZ();
      expect(user0.username).to.equal('jansemand');
    });

    it('should support logging', async function() {
      const User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING }),
        Task = this.sequelize.define('TaskXYZ', { title: DataTypes.STRING }),
        spy = sinon.spy();

      Task.belongsTo(User);

      await this.sequelize.sync({ force: true });
      const user = await User.create();
      const task = await Task.create({});
      await task.setUserXYZ(user, { logging: spy });
      expect(spy.called).to.be.ok;
    });

    it('should not clobber atributes', async function() {
      const Comment = this.sequelize.define('comment', {
        text: DataTypes.STRING
      });

      const Post = this.sequelize.define('post', {
        title: DataTypes.STRING
      });

      Post.hasOne(Comment);
      Comment.belongsTo(Post);

      await this.sequelize.sync();

      const post = await Post.create({
        title: 'Post title'
      });

      const comment = await Comment.create({
        text: 'OLD VALUE'
      });

      comment.text = 'UPDATED VALUE';
      await comment.setPost(post);
      expect(comment.text).to.equal('UPDATED VALUE');
    });

    it('should set the foreign key value without saving when using save: false', async function() {
      const Comment = this.sequelize.define('comment', {
        text: DataTypes.STRING
      });

      const Post = this.sequelize.define('post', {
        title: DataTypes.STRING
      });

      Post.hasMany(Comment, { foreignKey: 'post_id' });
      Comment.belongsTo(Post, { foreignKey: 'post_id' });

      await this.sequelize.sync({ force: true });
      const [post, comment] = await Promise.all([Post.create(), Comment.create()]);
      expect(comment.get('post_id')).not.to.be.ok;

      const setter = await comment.setPost(post, { save: false });

      expect(setter).to.be.undefined;
      expect(comment.get('post_id')).to.equal(post.get('id'));
      expect(comment.changed('post_id')).to.be.true;
    });

    it('supports setting same association twice', async function() {
      const Home = this.sequelize.define('home', {});
      const User = this.sequelize.define('user');

      Home.belongsTo(User);

      await this.sequelize.sync({ force: true });
      const [home, user] = await Promise.all([
        Home.create(),
        User.create()
      ]);
      await home.setUser(user);
      expect(await home.getUser()).to.have.property('id', user.id);
    });
  });

  describe('createAssociation', () => {
    it('creates an associated model instance', async function() {
      const User = this.sequelize.define('User', { username: DataTypes.STRING }),
        Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      Task.belongsTo(User);

      await this.sequelize.sync({ force: true });
      const task = await Task.create({ title: 'task' });
      const user = await task.createUser({ username: 'bob' });
      expect(user).not.to.be.null;
      expect(user.username).to.equal('bob');
    });

    if (current.dialect.supports.transactions) {
      it('supports transactions', async function() {
        const sequelize = await Support.prepareTransactionTest(this.sequelize);
        const User = sequelize.define('User', { username: Support.Sequelize.STRING }),
          Group = sequelize.define('Group', { name: Support.Sequelize.STRING });

        Group.belongsTo(User);

        await sequelize.sync({ force: true });
        const group = await Group.create({ name: 'bar' });
        const t = await sequelize.transaction();
        await group.createUser({ username: 'foo' }, { transaction: t });
        const user = await group.getUser();
        expect(user).to.be.null;

        const user0 = await group.getUser({ transaction: t });
        expect(user0).not.to.be.null;

        await t.rollback();
      });
    }
  });

  describe('foreign key', () => {
    it('should setup underscored field with foreign keys when using underscored', function() {
      const User = this.sequelize.define('User', { username: Sequelize.STRING }, { underscored: true }),
        Account = this.sequelize.define('Account', { name: Sequelize.STRING }, { underscored: true });

      User.belongsTo(Account);

      expect(User.rawAttributes.AccountId).to.exist;
      expect(User.rawAttributes.AccountId.field).to.equal('account_id');
    });

    it('should use model name when using camelcase', function() {
      const User = this.sequelize.define('User', { username: Sequelize.STRING }, { underscored: false }),
        Account = this.sequelize.define('Account', { name: Sequelize.STRING }, { underscored: false });

      User.belongsTo(Account);

      expect(User.rawAttributes.AccountId).to.exist;
      expect(User.rawAttributes.AccountId.field).to.equal('AccountId');
    });

    it('should support specifying the field of a foreign key', async function() {
      const User = this.sequelize.define('User', { username: Sequelize.STRING }, { underscored: false }),
        Account = this.sequelize.define('Account', { title: Sequelize.STRING }, { underscored: false });

      User.belongsTo(Account, {
        foreignKey: {
          name: 'AccountId',
          field: 'account_id'
        }
      });

      expect(User.rawAttributes.AccountId).to.exist;
      expect(User.rawAttributes.AccountId.field).to.equal('account_id');

      await Account.sync({ force: true });
      // Can't use Promise.all cause of foreign key references
      await User.sync({ force: true });

      const [user1, account] = await Promise.all([
        User.create({ username: 'foo' }),
        Account.create({ title: 'pepsico' })
      ]);

      await user1.setAccount(account);
      const user0 = await user1.getAccount();
      expect(user0).to.not.be.null;

      const user = await User.findOne({
        where: { username: 'foo' },
        include: [Account]
      });

      // the sql query should correctly look at account_id instead of AccountId
      expect(user.Account).to.exist;
    });

    it('should set foreignKey on foreign table', async function() {
      const Mail = this.sequelize.define('mail', {}, { timestamps: false });
      const Entry = this.sequelize.define('entry', {}, { timestamps: false });
      const User = this.sequelize.define('user', {}, { timestamps: false });

      Entry.belongsTo(User, {
        as: 'owner',
        foreignKey: {
          name: 'ownerId',
          allowNull: false
        }
      });
      Entry.belongsTo(Mail, {
        as: 'mail',
        foreignKey: {
          name: 'mailId',
          allowNull: false
        }
      });
      Mail.belongsToMany(User, {
        as: 'recipients',
        through: 'MailRecipients',
        otherKey: {
          name: 'recipientId',
          allowNull: false
        },
        foreignKey: {
          name: 'mailId',
          allowNull: false
        },
        timestamps: false
      });
      Mail.hasMany(Entry, {
        as: 'entries',
        foreignKey: {
          name: 'mailId',
          allowNull: false
        }
      });
      User.hasMany(Entry, {
        as: 'entries',
        foreignKey: {
          name: 'ownerId',
          allowNull: false
        }
      });

      await this.sequelize.sync({ force: true });
      await User.create(dialect === 'db2' ? { id: 1 } : {});
      const mail = await Mail.create(dialect === 'db2' ? { id: 1 } : {});
      await Entry.create({ mailId: mail.id, ownerId: 1 });
      await Entry.create({ mailId: mail.id, ownerId: 1 });
      // set recipients
      await mail.setRecipients([1]);

      const result = await Entry.findAndCountAll({
        offset: 0,
        limit: 10,
        order: [['id', 'DESC']],
        include: [
          {
            association: Entry.associations.mail,
            include: [
              {
                association: Mail.associations.recipients,
                through: {
                  where: {
                    recipientId: 1
                  }
                },
                required: true
              }
            ],
            required: true
          }
        ]
      });

      expect(result.count).to.equal(2);
      expect(result.rows[0].get({ plain: true })).to.deep.equal(
        {
          id: 2,
          ownerId: 1,
          mailId: 1,
          mail: {
            id: 1,
            recipients: [{
              id: 1,
              MailRecipients: {
                mailId: 1,
                recipientId: 1
              }
            }]
          }
        }
      );
    });
  });

  describe('foreign key constraints', () => {
    it('are enabled by default', async function() {
      const Task = this.sequelize.define('Task', { title: DataTypes.STRING }),
        User = this.sequelize.define('User', { username: DataTypes.STRING });

      Task.belongsTo(User); // defaults to SET NULL

      await this.sequelize.sync({ force: true });

      const user = await User.create({ username: 'foo' });
      const task = await Task.create({ title: 'task' });
      await task.setUser(user);
      await user.destroy();
      await task.reload();
      expect(task.UserId).to.equal(null);
    });

    it('sets to NO ACTION if allowNull: false', async function() {
      const Task = this.sequelize.define('Task', { title: DataTypes.STRING }),
        User = this.sequelize.define('User', { username: DataTypes.STRING });

      Task.belongsTo(User, { foreignKey: { allowNull: false } }); // defaults to NO ACTION

      await this.sequelize.sync({ force: true });

      const user = await User.create({ username: 'foo' });
      await Task.create({ title: 'task', UserId: user.id });
      await expect(user.destroy()).to.eventually.be.rejectedWith(Sequelize.ForeignKeyConstraintError);
      const tasks = await Task.findAll();
      expect(tasks).to.have.length(1);
    });

    it('should be possible to disable them', async function() {
      const Task = this.sequelize.define('Task', { title: Sequelize.STRING }),
        User = this.sequelize.define('User', { username: Sequelize.STRING });

      Task.belongsTo(User, { constraints: false });

      await this.sequelize.sync({ force: true });
      const user = await User.create({ username: 'foo' });
      const task = await Task.create({ title: 'task' });
      await task.setUser(user);
      await user.destroy();
      await task.reload();
      expect(task.UserId).to.equal(user.id);
    });

    it('can cascade deletes', async function() {
      const Task = this.sequelize.define('Task', { title: DataTypes.STRING }),
        User = this.sequelize.define('User', { username: DataTypes.STRING });

      Task.belongsTo(User, { onDelete: 'cascade' });

      await this.sequelize.sync({ force: true });
      const user = await User.create({ username: 'foo' });
      const task = await Task.create({ title: 'task' });
      await task.setUser(user);
      await user.destroy();
      const tasks = await Task.findAll();
      expect(tasks).to.have.length(0);
    });

    if (current.dialect.supports.constraints.restrict) {
      it('can restrict deletes', async function() {
        const Task = this.sequelize.define('Task', { title: DataTypes.STRING }),
          User = this.sequelize.define('User', { username: DataTypes.STRING });

        Task.belongsTo(User, { onDelete: 'restrict' });

        await this.sequelize.sync({ force: true });
        const user = await User.create({ username: 'foo' });
        const task = await Task.create({ title: 'task' });
        await task.setUser(user);
        await expect(user.destroy()).to.eventually.be.rejectedWith(Sequelize.ForeignKeyConstraintError);
        const tasks = await Task.findAll();
        expect(tasks).to.have.length(1);
      });

      it('can restrict updates', async function() {
        const Task = this.sequelize.define('Task', { title: DataTypes.STRING }),
          User = this.sequelize.define('User', { username: DataTypes.STRING });

        Task.belongsTo(User, { onUpdate: 'restrict' });

        await this.sequelize.sync({ force: true });
        const user = await User.create({ username: 'foo' });
        const task = await Task.create({ title: 'task' });
        await task.setUser(user);

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

    // NOTE: mssql does not support changing an autoincrement primary key
    if (!['mssql', 'db2', 'oracle'].includes(Support.getTestDialect())) {
      it('can cascade updates', async function() {
        const Task = this.sequelize.define('Task', { title: DataTypes.STRING }),
          User = this.sequelize.define('User', { username: DataTypes.STRING });

        Task.belongsTo(User, { onUpdate: 'cascade' });

        await this.sequelize.sync({ force: true });
        const user = await User.create({ username: 'foo' });
        const task = await Task.create({ title: 'task' });
        await task.setUser(user);

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
  });

  describe('association column', () => {
    it('has correct type and name for non-id primary keys with non-integer type', async function() {
      const User = this.sequelize.define('UserPKBT', {
        username: {
          type: DataTypes.STRING
        }
      });

      const Group = this.sequelize.define('GroupPKBT', {
        name: {
          type: DataTypes.STRING,
          primaryKey: true
        }
      });

      User.belongsTo(Group);

      await this.sequelize.sync({ force: true });
      expect(User.rawAttributes.GroupPKBTName.type).to.an.instanceof(DataTypes.STRING);
    });

    it('should support a non-primary key as the association column on a target without a primary key', async function() {
      const User = this.sequelize.define('User', { username: { type: DataTypes.STRING, unique: true } });
      const Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      User.removeAttribute('id');
      Task.belongsTo(User, { foreignKey: 'user_name', targetKey: 'username' });

      await this.sequelize.sync({ force: true });
      const newUser = await User.create({ username: 'bob' });
      const newTask = await Task.create({ title: 'some task' });
      await newTask.setUser(newUser);
      const foundTask = await Task.findOne({ where: { title: 'some task' } });
      const foundUser = await foundTask.getUser();
      await expect(foundUser.username).to.equal('bob');
      const foreignKeysDescriptions = await this.sequelize.getQueryInterface().getForeignKeyReferencesForTable('Tasks');
      expect(foreignKeysDescriptions[0]).to.includes({
        referencedColumnName: 'username',
        referencedTableName: 'Users',
        columnName: 'user_name'
      });
    });

    it('should support a non-primary unique key as the association column', async function() {
      const User = this.sequelize.define('User', {
        username: {
          type: DataTypes.STRING,
          field: 'user_name',
          unique: true
        }
      });
      const Task = this.sequelize.define('Task', {
        title: DataTypes.STRING
      });

      Task.belongsTo(User, { foreignKey: 'user_name', targetKey: 'username' });

      await this.sequelize.sync({ force: true });
      const newUser = await User.create({ username: 'bob' });
      const newTask = await Task.create({ title: 'some task' });
      await newTask.setUser(newUser);
      const foundTask = await Task.findOne({ where: { title: 'some task' } });
      const foundUser = await foundTask.getUser();
      await expect(foundUser.username).to.equal('bob');
      const foreignKeysDescriptions = await this.sequelize.getQueryInterface().getForeignKeyReferencesForTable('Tasks');
      expect(foreignKeysDescriptions[0]).to.includes({
        referencedColumnName: 'user_name',
        referencedTableName: 'Users',
        columnName: 'user_name'
      });
    });

    it('should support a non-primary key as the association column with a field option', async function() {
      const User = this.sequelize.define('User', {
        username: {
          type: DataTypes.STRING,
          field: 'the_user_name_field',
          unique: true
        }
      });
      const Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      User.removeAttribute('id');
      Task.belongsTo(User, { foreignKey: 'user_name', targetKey: 'username' });

      await this.sequelize.sync({ force: true });
      const newUser = await User.create({ username: 'bob' });
      const newTask = await Task.create({ title: 'some task' });
      await newTask.setUser(newUser);
      const foundTask = await Task.findOne({ where: { title: 'some task' } });
      const foundUser = await foundTask.getUser();
      await expect(foundUser.username).to.equal('bob');
      const foreignKeysDescriptions = await this.sequelize.getQueryInterface().getForeignKeyReferencesForTable('Tasks');
      expect(foreignKeysDescriptions[0]).to.includes({
        referencedColumnName: 'the_user_name_field',
        referencedTableName: 'Users',
        columnName: 'user_name'
      });
    });

    it('should support a non-primary key as the association column in a table with a composite primary key', async function() {
      const User = this.sequelize.define('User', {
        username: {
          type: DataTypes.STRING,
          field: 'the_user_name_field',
          unique: true
        },
        age: {
          type: DataTypes.INTEGER,
          field: 'the_user_age_field',
          primaryKey: true
        },
        weight: {
          type: DataTypes.INTEGER,
          field: 'the_user_weight_field',
          primaryKey: true
        }
      });
      const Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      Task.belongsTo(User, { foreignKey: 'user_name', targetKey: 'username' });

      await this.sequelize.sync({ force: true });
      const newUser = await User.create({ username: 'bob', age: 18, weight: 40 });
      const newTask = await Task.create({ title: 'some task' });
      await newTask.setUser(newUser);
      const foundTask = await Task.findOne({ where: { title: 'some task' } });
      const foundUser = await foundTask.getUser();
      await expect(foundUser.username).to.equal('bob');
      const foreignKeysDescriptions = await this.sequelize.getQueryInterface().getForeignKeyReferencesForTable('Tasks');
      expect(foreignKeysDescriptions[0]).to.includes({
        referencedColumnName: 'the_user_name_field',
        referencedTableName: 'Users',
        columnName: 'user_name'
      });
    });
  });

  describe('association options', () => {
    it('can specify data type for auto-generated relational keys', async function() {
      const User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING }),
        dataTypes = [DataTypes.INTEGER, DataTypes.BIGINT, DataTypes.STRING],
        Tasks = {};

      dataTypes.forEach(dataType => {
        const tableName = `TaskXYZ_${dataType.key}`;
        Tasks[dataType] = this.sequelize.define(tableName, { title: DataTypes.STRING });
        Tasks[dataType].belongsTo(User, { foreignKey: 'userId', keyType: dataType, constraints: false });
      });

      await this.sequelize.sync({ force: true });
      dataTypes.forEach(dataType => {
        expect(Tasks[dataType].rawAttributes.userId.type).to.be.an.instanceof(dataType);
      });
    });

    describe('allows the user to provide an attribute definition object as foreignKey', () => {
      it('works with a column that hasnt been defined before', function() {
        const Task = this.sequelize.define('task', {}),
          User = this.sequelize.define('user', {});

        Task.belongsTo(User, {
          foreignKey: {
            allowNull: false,
            name: 'uid'
          }
        });

        expect(Task.rawAttributes.uid).to.be.ok;
        expect(Task.rawAttributes.uid.allowNull).to.be.false;
        expect(Task.rawAttributes.uid.references.model).to.equal(User.getTableName());
        expect(Task.rawAttributes.uid.references.key).to.equal('id');
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

        Profile.belongsTo(User, { foreignKey: Profile.rawAttributes.user_id });

        expect(Profile.rawAttributes.user_id).to.be.ok;
        expect(Profile.rawAttributes.user_id.references.model).to.equal(User.getTableName());
        expect(Profile.rawAttributes.user_id.references.key).to.equal('uid');
        expect(Profile.rawAttributes.user_id.allowNull).to.be.false;
      });

      it('works when merging with an existing definition', function() {
        const Task = this.sequelize.define('task', {
            projectId: {
              defaultValue: 42,
              type: Sequelize.INTEGER
            }
          }),
          Project = this.sequelize.define('project', {});

        Task.belongsTo(Project, { foreignKey: { allowNull: true } });

        expect(Task.rawAttributes.projectId).to.be.ok;
        expect(Task.rawAttributes.projectId.defaultValue).to.equal(42);
        expect(Task.rawAttributes.projectId.allowNull).to.be.ok;
      });
    });

    it('should throw an error if foreignKey and as result in a name clash', function() {
      const Person = this.sequelize.define('person', {}),
        Car = this.sequelize.define('car', {});

      expect(Car.belongsTo.bind(Car, Person, { foreignKey: 'person' })).to
        .throw('Naming collision between attribute \'person\' and association \'person\' on model car. To remedy this, change either foreignKey or as in your association definition');
    });

    it('should throw an error if an association clashes with the name of an already define attribute', function() {
      const Person = this.sequelize.define('person', {}),
        Car = this.sequelize.define('car', {
          person: Sequelize.INTEGER
        });

      expect(Car.belongsTo.bind(Car, Person, { as: 'person' })).to
        .throw('Naming collision between attribute \'person\' and association \'person\' on model car. To remedy this, change either foreignKey or as in your association definition');
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
      this.Individual.belongsTo(this.Hat, {
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
