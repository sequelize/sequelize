'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('sequelize/lib/data-types'),
  Sequelize = require('sequelize'),
  moment = require('moment'),
  sinon = require('sinon'),
  Op = Sequelize.Op,
  current = Support.sequelize,
  _ = require('lodash'),
  dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('HasMany'), () => {
  describe('Model.associations', () => {
    it('should store all assocations when associting to the same table multiple times', function() {
      const User = this.sequelize.define('User', {}),
        Group = this.sequelize.define('Group', {});

      Group.hasMany(User);
      Group.hasMany(User, { foreignKey: 'primaryGroupId', as: 'primaryUsers' });
      Group.hasMany(User, { foreignKey: 'secondaryGroupId', as: 'secondaryUsers' });

      expect(Object.keys(Group.associations)).to.deep.equal(['Users', 'primaryUsers', 'secondaryUsers']);
    });
  });

  describe('count', () => {
    it('should not fail due to ambiguous field', async function() {
      const User = this.sequelize.define('User', { username: DataTypes.STRING }),
        Task = this.sequelize.define('Task', { title: DataTypes.STRING, active: DataTypes.BOOLEAN });

      User.hasMany(Task);
      const subtasks = Task.hasMany(Task, { as: 'subtasks' });

      await this.sequelize.sync({ force: true });

      const user0 = await User.create({
        username: 'John',
        Tasks: [{
          title: 'Get rich', active: true
        }]
      }, {
        include: [Task]
      });

      await Promise.all([
        user0.get('Tasks')[0].createSubtask({ title: 'Make a startup', active: false }),
        user0.get('Tasks')[0].createSubtask({ title: 'Engage rock stars', active: true })
      ]);

      const user = user0;

      await expect(user.countTasks({
        attributes: [Task.primaryKeyField, 'title'],
        include: [{
          attributes: [],
          association: subtasks,
          where: {
            active: true
          }
        }],
        group: this.sequelize.col(Task.name.concat('.', Task.primaryKeyField))
      })).to.eventually.equal(1);
    });
  });

  describe('get', () => {
    if (current.dialect.supports.groupedLimit) {
      describe('multiple', () => {
        it('should fetch associations for multiple instances', async function() {
          const User = this.sequelize.define('User', {}),
            Task = this.sequelize.define('Task', {});

          User.Tasks = User.hasMany(Task, { as: 'tasks' });

          await this.sequelize.sync({ force: true });

          const users = await Promise.all([User.create({
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
          }), User.create({
            id: 3
          })]);

          const result = await User.Tasks.get(users);
          expect(result[users[0].id].length).to.equal(3);
          expect(result[users[1].id].length).to.equal(1);
          expect(result[users[2].id].length).to.equal(0);
        });

        it('should fetch associations for multiple instances with limit and order', async function() {
          const User = this.sequelize.define('User', {}),
            Task = this.sequelize.define('Task', {
              title: DataTypes.STRING
            });

          User.Tasks = User.hasMany(Task, { as: 'tasks' });

          await this.sequelize.sync({ force: true });

          const users = await Promise.all([User.create({
            tasks: [
              { title: 'b' },
              { title: 'd' },
              { title: 'c' },
              { title: 'a' }
            ]
          }, {
            include: [User.Tasks]
          }), User.create({
            tasks: [
              { title: 'a' },
              { title: 'c' },
              { title: 'b' }
            ]
          }, {
            include: [User.Tasks]
          })]);

          const result = await User.Tasks.get(users, {
            limit: 2,
            order: [
              ['title', 'ASC']
            ]
          });

          expect(result[users[0].id].length).to.equal(2);
          expect(result[users[0].id][0].title).to.equal('a');
          expect(result[users[0].id][1].title).to.equal('b');

          expect(result[users[1].id].length).to.equal(2);
          expect(result[users[1].id][0].title).to.equal('a');
          expect(result[users[1].id][1].title).to.equal('b');
        });

        it('should fetch multiple layers of associations with limit and order with separate=true', async function() {
          const User = this.sequelize.define('User', {}),
            Task = this.sequelize.define('Task', {
              title: DataTypes.STRING
            }),
            SubTask = this.sequelize.define('SubTask', {
              title: DataTypes.STRING
            });

          User.Tasks = User.hasMany(Task, { as: 'tasks' });
          Task.SubTasks = Task.hasMany(SubTask, { as: 'subtasks' });

          await this.sequelize.sync({ force: true });

          await Promise.all([User.create({
            id: 1,
            tasks: [
              { title: 'b', subtasks: [
                { title: 'c' },
                { title: 'a' }
              ] },
              { title: 'd' },
              { title: 'c', subtasks: [
                { title: 'b' },
                { title: 'a' },
                { title: 'c' }
              ] },
              { title: 'a', subtasks: [
                { title: 'c' },
                { title: 'a' },
                { title: 'b' }
              ] }
            ]
          }, {
            include: [{ association: User.Tasks, include: [Task.SubTasks] }]
          }), User.create({
            id: 2,
            tasks: [
              { title: 'a', subtasks: [
                { title: 'b' },
                { title: 'a' },
                { title: 'c' }
              ] },
              { title: 'c', subtasks: [
                { title: 'a' }
              ] },
              { title: 'b', subtasks: [
                { title: 'a' },
                { title: 'b' }
              ] }
            ]
          }, {
            include: [{ association: User.Tasks, include: [Task.SubTasks] }]
          })]);

          const users = await User.findAll({
            include: [{
              association: User.Tasks,
              limit: 2,
              order: [['title', 'ASC']],
              separate: true,
              as: 'tasks',
              include: [
                {
                  association: Task.SubTasks,
                  order: [['title', 'DESC']],
                  separate: true,
                  as: 'subtasks'
                }
              ]
            }],
            order: [
              ['id', 'ASC']
            ]
          });

          expect(users[0].tasks.length).to.equal(2);

          expect(users[0].tasks[0].title).to.equal('a');
          expect(users[0].tasks[0].subtasks.length).to.equal(3);
          expect(users[0].tasks[0].subtasks[0].title).to.equal('c');
          expect(users[0].tasks[0].subtasks[1].title).to.equal('b');
          expect(users[0].tasks[0].subtasks[2].title).to.equal('a');

          expect(users[0].tasks[1].title).to.equal('b');
          expect(users[0].tasks[1].subtasks.length).to.equal(2);
          expect(users[0].tasks[1].subtasks[0].title).to.equal('c');
          expect(users[0].tasks[1].subtasks[1].title).to.equal('a');

          expect(users[1].tasks.length).to.equal(2);
          expect(users[1].tasks[0].title).to.equal('a');
          expect(users[1].tasks[0].subtasks.length).to.equal(3);
          expect(users[1].tasks[0].subtasks[0].title).to.equal('c');
          expect(users[1].tasks[0].subtasks[1].title).to.equal('b');
          expect(users[1].tasks[0].subtasks[2].title).to.equal('a');

          expect(users[1].tasks[1].title).to.equal('b');
          expect(users[1].tasks[1].subtasks.length).to.equal(2);
          expect(users[1].tasks[1].subtasks[0].title).to.equal('b');
          expect(users[1].tasks[1].subtasks[1].title).to.equal('a');
        });

        it('should fetch associations for multiple instances with limit and order and a belongsTo relation', async function() {
          const User = this.sequelize.define('User', {}),
            Task = this.sequelize.define('Task', {
              title: DataTypes.STRING,
              categoryId: {
                type: DataTypes.INTEGER,
                field: 'category_id'
              }
            }),
            Category = this.sequelize.define('Category', {});

          User.Tasks = User.hasMany(Task, { as: 'tasks' });
          Task.Category = Task.belongsTo(Category, { as: 'category', foreignKey: 'categoryId' });

          await this.sequelize.sync({ force: true });

          const users = await Promise.all([User.create({
            tasks: [
              { title: 'b', category: {} },
              { title: 'd', category: {} },
              { title: 'c', category: {} },
              { title: 'a', category: {} }
            ]
          }, {
            include: [{ association: User.Tasks, include: [Task.Category] }]
          }), User.create({
            tasks: [
              { title: 'a', category: {} },
              { title: 'c', category: {} },
              { title: 'b', category: {} }
            ]
          }, {
            include: [{ association: User.Tasks, include: [Task.Category] }]
          })]);

          const result = await User.Tasks.get(users, {
            limit: 2,
            order: [
              ['title', 'ASC']
            ],
            include: [Task.Category]
          });

          expect(result[users[0].id].length).to.equal(2);
          expect(result[users[0].id][0].title).to.equal('a');
          expect(result[users[0].id][0].category).to.be.ok;
          expect(result[users[0].id][1].title).to.equal('b');
          expect(result[users[0].id][1].category).to.be.ok;

          expect(result[users[1].id].length).to.equal(2);
          expect(result[users[1].id][0].title).to.equal('a');
          expect(result[users[1].id][0].category).to.be.ok;
          expect(result[users[1].id][1].title).to.equal('b');
          expect(result[users[1].id][1].category).to.be.ok;
        });

        it('supports schemas', async function() {
          const User = this.sequelize.define('User', {}).schema('work'),
            Task = this.sequelize.define('Task', {
              title: DataTypes.STRING
            }).schema('work'),
            SubTask = this.sequelize.define('SubTask', {
              title: DataTypes.STRING
            }).schema('work');

          User.Tasks = User.hasMany(Task, { as: 'tasks' });
          Task.SubTasks = Task.hasMany(SubTask, { as: 'subtasks' });

          await Support.dropTestSchemas(this.sequelize);
          await this.sequelize.createSchema('work');
          await User.sync({ force: true });
          await Task.sync({ force: true });
          await SubTask.sync({ force: true });

          await Promise.all([User.create({
            id: 1,
            tasks: [
              { title: 'b', subtasks: [
                { title: 'c' },
                { title: 'a' }
              ] },
              { title: 'd' },
              { title: 'c', subtasks: [
                { title: 'b' },
                { title: 'a' },
                { title: 'c' }
              ] },
              { title: 'a', subtasks: [
                { title: 'c' },
                { title: 'a' },
                { title: 'b' }
              ] }
            ]
          }, {
            include: [{ association: User.Tasks, include: [Task.SubTasks] }]
          }), User.create({
            id: 2,
            tasks: [
              { title: 'a', subtasks: [
                { title: 'b' },
                { title: 'a' },
                { title: 'c' }
              ] },
              { title: 'c', subtasks: [
                { title: 'a' }
              ] },
              { title: 'b', subtasks: [
                { title: 'a' },
                { title: 'b' }
              ] }
            ]
          }, {
            include: [{ association: User.Tasks, include: [Task.SubTasks] }]
          })]);

          const users = await User.findAll({
            include: [{
              association: User.Tasks,
              limit: 2,
              order: [['title', 'ASC']],
              separate: true,
              as: 'tasks',
              include: [
                {
                  association: Task.SubTasks,
                  order: [['title', 'DESC']],
                  separate: true,
                  as: 'subtasks'
                }
              ]
            }],
            order: [
              ['id', 'ASC']
            ]
          });

          expect(users[0].tasks.length).to.equal(2);

          expect(users[0].tasks[0].title).to.equal('a');
          expect(users[0].tasks[0].subtasks.length).to.equal(3);
          expect(users[0].tasks[0].subtasks[0].title).to.equal('c');
          expect(users[0].tasks[0].subtasks[1].title).to.equal('b');
          expect(users[0].tasks[0].subtasks[2].title).to.equal('a');

          expect(users[0].tasks[1].title).to.equal('b');
          expect(users[0].tasks[1].subtasks.length).to.equal(2);
          expect(users[0].tasks[1].subtasks[0].title).to.equal('c');
          expect(users[0].tasks[1].subtasks[1].title).to.equal('a');

          expect(users[1].tasks.length).to.equal(2);
          expect(users[1].tasks[0].title).to.equal('a');
          expect(users[1].tasks[0].subtasks.length).to.equal(3);
          expect(users[1].tasks[0].subtasks[0].title).to.equal('c');
          expect(users[1].tasks[0].subtasks[1].title).to.equal('b');
          expect(users[1].tasks[0].subtasks[2].title).to.equal('a');

          expect(users[1].tasks[1].title).to.equal('b');
          expect(users[1].tasks[1].subtasks.length).to.equal(2);
          expect(users[1].tasks[1].subtasks[0].title).to.equal('b');
          expect(users[1].tasks[1].subtasks[1].title).to.equal('a');
          await this.sequelize.dropSchema('work');
          const schemas = await this.sequelize.showAllSchemas();
          if (['postgres', 'mssql'].includes(dialect) || schemas === 'mariadb') {
            expect(schemas).to.be.empty;
          }
        });
      });
    }
  });

  describe('(1:N)', () => {
    describe('hasAssociation', () => {
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
          key: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
          },
          text: DataTypes.STRING
        });

        this.Article.hasMany(this.Label);

        return this.sequelize.sync({ force: true });
      });

      it('should only generate one set of foreignKeys', function() {
        this.Article = this.sequelize.define('Article', { 'title': DataTypes.STRING }, { timestamps: false });
        this.Label = this.sequelize.define('Label', { 'text': DataTypes.STRING }, { timestamps: false });

        this.Label.belongsTo(this.Article);
        this.Article.hasMany(this.Label);

        expect(Object.keys(this.Label.rawAttributes)).to.deep.equal(['id', 'text', 'ArticleId']);
        expect(Object.keys(this.Label.rawAttributes).length).to.equal(3);
      });

      if (current.dialect.supports.transactions) {
        it('supports transactions', async function() {
          const sequelize = await Support.prepareTransactionTest(this.sequelize);
          const Article = sequelize.define('Article', { 'title': DataTypes.STRING });
          const Label = sequelize.define('Label', { 'text': DataTypes.STRING });

          Article.hasMany(Label);

          await sequelize.sync({ force: true });

          const [article, label] = await Promise.all([
            Article.create({ title: 'foo' }),
            Label.create({ text: 'bar' })
          ]);

          const t = await sequelize.transaction();
          await article.setLabels([label], { transaction: t });
          const articles0 = await Article.findAll({ transaction: t });
          const hasLabel0 = await articles0[0].hasLabel(label);
          expect(hasLabel0).to.be.false;
          const articles = await Article.findAll({ transaction: t });
          const hasLabel = await articles[0].hasLabel(label, { transaction: t });
          expect(hasLabel).to.be.true;
          await t.rollback();
        });
      }

      it('does not have any labels assigned to it initially', async function() {
        const [article, label1, label2] = await Promise.all([
          this.Article.create({ title: 'Article' }),
          this.Label.create({ text: 'Awesomeness' }),
          this.Label.create({ text: 'Epicness' })
        ]);

        const [hasLabel1, hasLabel2] = await Promise.all([
          article.hasLabel(label1),
          article.hasLabel(label2)
        ]);

        expect(hasLabel1).to.be.false;
        expect(hasLabel2).to.be.false;
      });

      it('answers true if the label has been assigned', async function() {
        const [article, label1, label2] = await Promise.all([
          this.Article.create({ title: 'Article' }),
          this.Label.create({ text: 'Awesomeness' }),
          this.Label.create({ text: 'Epicness' })
        ]);

        await article.addLabel(label1);

        const [hasLabel1, hasLabel2] = await Promise.all([
          article.hasLabel(label1),
          article.hasLabel(label2)
        ]);

        expect(hasLabel1).to.be.true;
        expect(hasLabel2).to.be.false;
      });

      it('answers correctly if the label has been assigned when passing a primary key instead of an object', async function() {
        const [article, label1, label2] = await Promise.all([
          this.Article.create({ title: 'Article' }),
          this.Label.create({ text: 'Awesomeness' }),
          this.Label.create({ text: 'Epicness' })
        ]);

        await article.addLabel(label1);

        const [hasLabel1, hasLabel2] = await Promise.all([
          article.hasLabel(label1[this.Label.primaryKeyAttribute]),
          article.hasLabel(label2[this.Label.primaryKeyAttribute])
        ]);

        expect(hasLabel1).to.be.true;
        expect(hasLabel2).to.be.false;
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
          key: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true
          },
          text: DataTypes.STRING
        });

        this.Article.hasMany(this.Label);

        return this.sequelize.sync({ force: true });
      });

      if (current.dialect.supports.transactions) {
        it('supports transactions', async function() {
          const sequelize = await Support.prepareTransactionTest(this.sequelize);
          const Article = sequelize.define('Article', { 'title': DataTypes.STRING });
          const Label = sequelize.define('Label', { 'text': DataTypes.STRING });

          Article.hasMany(Label);

          await sequelize.sync({ force: true });

          const [article, label] = await Promise.all([
            Article.create({ title: 'foo' }),
            Label.create({ text: 'bar' })
          ]);

          const t = await sequelize.transaction();
          await article.setLabels([label], { transaction: t });
          const articles = await Article.findAll({ transaction: t });

          const [hasLabel1, hasLabel2] = await Promise.all([
            articles[0].hasLabels([label]),
            articles[0].hasLabels([label], { transaction: t })
          ]);

          expect(hasLabel1).to.be.false;
          expect(hasLabel2).to.be.true;

          await t.rollback();
        });
      }

      it('answers false if only some labels have been assigned', async function() {
        const [article, label1, label2] = await Promise.all([
          this.Article.create({ title: 'Article' }),
          this.Label.create({ text: 'Awesomeness' }),
          this.Label.create({ text: 'Epicness' })
        ]);

        await article.addLabel(label1);
        const result = await article.hasLabels([label1, label2]);
        expect(result).to.be.false;
      });

      it('answers false if only some labels have been assigned when passing a primary key instead of an object', async function() {
        const [article, label1, label2] = await Promise.all([
          this.Article.create({ title: 'Article' }),
          this.Label.create({ text: 'Awesomeness' }),
          this.Label.create({ text: 'Epicness' })
        ]);

        await article.addLabel(label1);

        const result = await article.hasLabels([
          label1[this.Label.primaryKeyAttribute],
          label2[this.Label.primaryKeyAttribute]
        ]);

        expect(result).to.be.false;
      });

      it('answers true if all label have been assigned', async function() {
        const [article, label1, label2] = await Promise.all([
          this.Article.create({ title: 'Article' }),
          this.Label.create({ text: 'Awesomeness' }),
          this.Label.create({ text: 'Epicness' })
        ]);

        await article.setLabels([label1, label2]);
        const result = await article.hasLabels([label1, label2]);
        expect(result).to.be.true;
      });

      it('answers true if all label have been assigned when passing a primary key instead of an object', async function() {
        const [article, label1, label2] = await Promise.all([
          this.Article.create({ title: 'Article' }),
          this.Label.create({ text: 'Awesomeness' }),
          this.Label.create({ text: 'Epicness' })
        ]);

        await article.setLabels([label1, label2]);

        const result = await article.hasLabels([
          label1[this.Label.primaryKeyAttribute],
          label2[this.Label.primaryKeyAttribute]
        ]);

        expect(result).to.be.true;
      });
    });

    describe('setAssociations', () => {
      if (current.dialect.supports.transactions) {
        it('supports transactions', async function() {
          const sequelize = await Support.prepareTransactionTest(this.sequelize);
          const Article = sequelize.define('Article', { 'title': DataTypes.STRING });
          const Label = sequelize.define('Label', { 'text': DataTypes.STRING });

          Article.hasMany(Label);

          await sequelize.sync({ force: true });

          const [article, label, t] = await Promise.all([
            Article.create({ title: 'foo' }),
            Label.create({ text: 'bar' }),
            sequelize.transaction()
          ]);

          await article.setLabels([label], { transaction: t });
          const labels0 = await Label.findAll({ where: { ArticleId: article.id }, transaction: undefined });
          expect(labels0.length).to.equal(0);

          const labels = await Label.findAll({ where: { ArticleId: article.id }, transaction: t });
          expect(labels.length).to.equal(1);
          await t.rollback();
        });
      }

      it('clears associations when passing null to the set-method', async function() {
        const User = this.sequelize.define('User', { username: DataTypes.STRING }),
          Task = this.sequelize.define('Task', { title: DataTypes.STRING });

        Task.hasMany(User);

        await this.sequelize.sync({ force: true });

        const [user, task] = await Promise.all([
          User.create({ username: 'foo' }),
          Task.create({ title: 'task' })
        ]);

        await task.setUsers([user]);
        const users0 = await task.getUsers();
        expect(users0).to.have.length(1);

        await task.setUsers(null);
        const users = await task.getUsers();
        expect(users).to.have.length(0);
      });

      it('supports passing the primary key instead of an object', async function() {
        const Article = this.sequelize.define('Article', { title: DataTypes.STRING }),
          Label = this.sequelize.define('Label', { text: DataTypes.STRING });

        Article.hasMany(Label);

        await this.sequelize.sync({ force: true });

        const [article, label1, label2] = await Promise.all([
          Article.create({}),
          Label.create({ text: 'label one' }),
          Label.create({ text: 'label two' })
        ]);

        await article.addLabel(label1.id);
        await article.setLabels([label2.id]);
        const labels = await article.getLabels();
        expect(labels).to.have.length(1);
        expect(labels[0].text).to.equal('label two');
      });
    });

    describe('addAssociations', () => {
      if (current.dialect.supports.transactions) {
        it('supports transactions', async function() {
          const sequelize = await Support.prepareTransactionTest(this.sequelize);
          const Article = sequelize.define('Article', { 'title': DataTypes.STRING });
          const Label = sequelize.define('Label', { 'text': DataTypes.STRING });
          Article.hasMany(Label);

          await sequelize.sync({ force: true });

          const [article, label] = await Promise.all([
            Article.create({ title: 'foo' }),
            Label.create({ text: 'bar' })
          ]);

          const t = await sequelize.transaction();
          await article.addLabel(label, { transaction: t });
          const labels0 = await Label.findAll({ where: { ArticleId: article.id }, transaction: undefined });
          expect(labels0.length).to.equal(0);

          const labels = await Label.findAll({ where: { ArticleId: article.id }, transaction: t });
          expect(labels.length).to.equal(1);
          await t.rollback();
        });
      }

      it('supports passing the primary key instead of an object', async function() {
        const Article = this.sequelize.define('Article', { 'title': DataTypes.STRING }),
          Label = this.sequelize.define('Label', { 'text': DataTypes.STRING });

        Article.hasMany(Label);

        await this.sequelize.sync({ force: true });

        const [article, label] = await Promise.all([
          Article.create({}),
          Label.create({ text: 'label one' })
        ]);

        await article.addLabel(label.id);
        const labels = await article.getLabels();
        expect(labels[0].text).to.equal('label one'); // Make sure that we didn't modify one of the other attributes while building / saving a new instance
      });
    });

    describe('addMultipleAssociations', () => {
      it('adds associations without removing the current ones', async function() {
        const User = this.sequelize.define('User', { username: DataTypes.STRING }),
          Task = this.sequelize.define('Task', { title: DataTypes.STRING });

        Task.hasMany(User);

        await this.sequelize.sync({ force: true });

        await User.bulkCreate([
          { username: 'foo ' },
          { username: 'bar ' },
          { username: 'baz ' }
        ]);

        const task = await Task.create({ title: 'task' });
        const users0 = await User.findAll();
        const users = users0;
        await task.setUsers([users0[0]]);
        await task.addUsers([users[1], users[2]]);
        expect(await task.getUsers()).to.have.length(3);
      });

      it('handles decent sized bulk creates', async function() {
        const User = this.sequelize.define('User', { username: DataTypes.STRING, num: DataTypes.INTEGER, status: DataTypes.STRING }),
          Task = this.sequelize.define('Task', { title: DataTypes.STRING });

        Task.hasMany(User);

        await this.sequelize.sync({ force: true });
        const users0 = _.range(1000).map(i => ({ username: `user${i}`, num: i, status: 'live' }));
        await User.bulkCreate(users0);
        await Task.create({ title: 'task' });
        const users = await User.findAll();
        expect(users).to.have.length(1000);
      });
    });
    it('clears associations when passing null to the set-method with omitNull set to true', async function() {
      this.sequelize.options.omitNull = true;

      const User = this.sequelize.define('User', { username: DataTypes.STRING }),
        Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      Task.hasMany(User);

      try {
        await this.sequelize.sync({ force: true });
        const user = await User.create({ username: 'foo' });
        const task = await Task.create({ title: 'task' });
        await task.setUsers([user]);
        const _users0 = await task.getUsers();
        expect(_users0).to.have.length(1);

        await task.setUsers(null);
        const _users = await task.getUsers();
        expect(_users).to.have.length(0);
      } finally {
        this.sequelize.options.omitNull = false;
      }
    });

    describe('createAssociations', () => {
      it('creates a new associated object', async function() {
        const Article = this.sequelize.define('Article', { 'title': DataTypes.STRING }),
          Label = this.sequelize.define('Label', { 'text': DataTypes.STRING });

        Article.hasMany(Label);

        await this.sequelize.sync({ force: true });
        const article0 = await Article.create({ title: 'foo' });
        await article0.createLabel({ text: 'bar' });
        const article = article0;
        const labels = await Label.findAll({ where: { ArticleId: article.id } });
        expect(labels.length).to.equal(1);
      });

      it('creates the object with the association directly', async function() {
        const spy = sinon.spy();

        const Article = this.sequelize.define('Article', {
            'title': DataTypes.STRING

          }),
          Label = this.sequelize.define('Label', {
            'text': DataTypes.STRING
          });

        Article.hasMany(Label);

        await this.sequelize.sync({ force: true });
        const article = await Article.create({ title: 'foo' });
        const label = await article.createLabel({ text: 'bar' }, { logging: spy });
        expect(spy.calledOnce).to.be.true;
        expect(label.ArticleId).to.equal(article.id);
      });

      if (current.dialect.supports.transactions) {
        it('supports transactions', async function() {
          const sequelize = await Support.prepareTransactionTest(this.sequelize);
          const Article = sequelize.define('Article', { 'title': DataTypes.STRING });
          const Label = sequelize.define('Label', { 'text': DataTypes.STRING });

          Article.hasMany(Label);

          await sequelize.sync({ force: true });
          const article = await Article.create({ title: 'foo' });
          const t = await sequelize.transaction();
          await article.createLabel({ text: 'bar' }, { transaction: t });
          const labels1 = await Label.findAll();
          expect(labels1.length).to.equal(0);
          const labels0 = await Label.findAll({ where: { ArticleId: article.id } });
          expect(labels0.length).to.equal(0);
          const labels = await Label.findAll({ where: { ArticleId: article.id }, transaction: t });
          expect(labels.length).to.equal(1);
          await t.rollback();
        });
      }

      it('supports passing the field option', async function() {
        const Article = this.sequelize.define('Article', {
            'title': DataTypes.STRING
          }),
          Label = this.sequelize.define('Label', {
            'text': DataTypes.STRING
          });

        Article.hasMany(Label);

        await this.sequelize.sync({ force: true });
        const article0 = await Article.create();

        await article0.createLabel({
          text: 'yolo'
        }, {
          fields: ['text']
        });

        const article = article0;
        const labels = await article.getLabels();
        expect(labels.length).to.be.ok;
      });
    });

    describe('getting assocations with options', () => {
      beforeEach(async function() {
        this.User = this.sequelize.define('User', { username: DataTypes.STRING });
        this.Task = this.sequelize.define('Task', { title: DataTypes.STRING, active: DataTypes.BOOLEAN });

        this.User.hasMany(this.Task);

        await this.sequelize.sync({ force: true });

        const [john, task1, task2] = await Promise.all([
          this.User.create({ username: 'John' }),
          this.Task.create({ title: 'Get rich', active: true }),
          this.Task.create({ title: 'Die trying', active: false })
        ]);

        return john.setTasks([task1, task2]);
      });

      it('should treat the where object of associations as a first class citizen', async function() {
        this.Article = this.sequelize.define('Article', {
          'title': DataTypes.STRING
        });
        this.Label = this.sequelize.define('Label', {
          'text': DataTypes.STRING,
          'until': DataTypes.DATE
        });

        this.Article.hasMany(this.Label);

        await this.sequelize.sync({ force: true });

        const [article, label1, label2] = await Promise.all([
          this.Article.create({ title: 'Article' }),
          this.Label.create({ text: 'Awesomeness', until: '2014-01-01 01:00:00' }),
          this.Label.create({ text: 'Epicness', until: '2014-01-03 01:00:00' })
        ]);

        await article.setLabels([label1, label2]);
        const labels = await article.getLabels({ where: { until: { [Op.gt]: moment('2014-01-02').toDate() } } });
        expect(labels).to.be.instanceof(Array);
        expect(labels).to.have.length(1);
        expect(labels[0].text).to.equal('Epicness');
      });

      it('gets all associated objects when no options are passed', async function() {
        const john = await this.User.findOne({ where: { username: 'John' } });
        const tasks = await john.getTasks();
        expect(tasks).to.have.length(2);
      });

      it('only get objects that fulfill the options', async function() {
        const john = await this.User.findOne({ where: { username: 'John' } });
        const tasks = await john.getTasks({ where: { active: true }, limit: 10, order: [['id', 'DESC']] });
        expect(tasks).to.have.length(1);
      });
    });

    describe('countAssociations', () => {
      beforeEach(async function() {
        this.User = this.sequelize.define('User', { username: DataTypes.STRING });
        this.Task = this.sequelize.define('Task', { title: DataTypes.STRING, active: DataTypes.BOOLEAN });

        this.User.hasMany(this.Task, {
          foreignKey: 'userId'
        });

        await this.sequelize.sync({ force: true });

        const [john, task1, task2] = await Promise.all([
          this.User.create({ username: 'John' }),
          this.Task.create({ title: 'Get rich', active: true }),
          this.Task.create({ title: 'Die trying', active: false })
        ]);

        this.user = john;

        return john.setTasks([task1, task2]);
      });

      it('should count all associations', async function() {
        await expect(this.user.countTasks({})).to.eventually.equal(2);
      });

      it('should count filtered associations', async function() {
        await expect(this.user.countTasks({
          where: {
            active: true
          }
        })).to.eventually.equal(1);
      });

      it('should count scoped associations', async function() {
        this.User.hasMany(this.Task, {
          foreignKey: 'userId',
          as: 'activeTasks',
          scope: {
            active: true
          }
        });

        await expect(this.user.countActiveTasks({})).to.eventually.equal(1);
      });
    });

    describe('thisAssociations', () => {
      it('should work with alias', async function() {
        const Person = this.sequelize.define('Group', {});

        Person.hasMany(Person, { as: 'Children' });

        await this.sequelize.sync();
      });
    });
  });

  describe('foreign key constraints', () => {
    describe('1:m', () => {
      it('sets null by default', async function() {
        const Task = this.sequelize.define('Task', { title: DataTypes.STRING }),
          User = this.sequelize.define('User', { username: DataTypes.STRING });

        User.hasMany(Task);

        await this.sequelize.sync({ force: true });

        const [user, task0] = await Promise.all([
          User.create({ username: 'foo' }),
          Task.create({ title: 'task' })
        ]);

        await user.setTasks([task0]);
        await user.destroy();
        const task = await task0.reload();
        expect(task.UserId).to.equal(null);
      });

      it('sets to CASCADE if allowNull: false', async function() {
        const Task = this.sequelize.define('Task', { title: DataTypes.STRING }),
          User = this.sequelize.define('User', { username: DataTypes.STRING });

        User.hasMany(Task, { foreignKey: { allowNull: false } }); // defaults to CASCADE

        await this.sequelize.sync({ force: true });

        const user = await User.create({ username: 'foo' });
        await Task.create({ title: 'task', UserId: user.id });
        await user.destroy();
        const tasks = await Task.findAll();
        expect(tasks).to.be.empty;
      });

      it('should be possible to remove all constraints', async function() {
        const Task = this.sequelize.define('Task', { title: DataTypes.STRING }),
          User = this.sequelize.define('User', { username: DataTypes.STRING });

        User.hasMany(Task, { constraints: false });

        await this.sequelize.sync({ force: true });

        const [user, task0] = await Promise.all([
          User.create({ username: 'foo' }),
          Task.create({ title: 'task' })
        ]);

        const task = task0;
        await user.setTasks([task0]);
        await user.destroy();
        await task.reload();
        expect(task.UserId).to.equal(user.id);
      });

      it('can cascade deletes', async function() {
        const Task = this.sequelize.define('Task', { title: DataTypes.STRING }),
          User = this.sequelize.define('User', { username: DataTypes.STRING });

        User.hasMany(Task, { onDelete: 'cascade' });

        await this.sequelize.sync({ force: true });

        const [user, task] = await Promise.all([
          User.create({ username: 'foo' }),
          Task.create({ title: 'task' })
        ]);

        await user.setTasks([task]);
        await user.destroy();
        const tasks = await Task.findAll();
        expect(tasks).to.have.length(0);
      });

      // NOTE: mssql does not support changing an autoincrement primary key
      if (!['mssql', 'db2', 'oracle'].includes(dialect)) {
        it('can cascade updates', async function() {
          const Task = this.sequelize.define('Task', { title: DataTypes.STRING }),
            User = this.sequelize.define('User', { username: DataTypes.STRING });

          User.hasMany(Task, { onUpdate: 'cascade' });

          await this.sequelize.sync({ force: true });

          const [user0, task] = await Promise.all([
            User.create({ username: 'foo' }),
            Task.create({ title: 'task' })
          ]);

          await user0.setTasks([task]);
          const user = user0;
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
          const Task = this.sequelize.define('Task', { title: DataTypes.STRING }),
            User = this.sequelize.define('User', { username: DataTypes.STRING });

          User.hasMany(Task, { onDelete: 'restrict' });

          let tasks;
          await this.sequelize.sync({ force: true });

          const [user, task] = await Promise.all([
            User.create({ username: 'foo' }),
            Task.create({ title: 'task' })
          ]);

          await user.setTasks([task]);

          try {
            tasks = await user.destroy();
          } catch (err) {
            if (!(err instanceof Sequelize.ForeignKeyConstraintError))
              throw err;

            // Should fail due to FK violation
            tasks = await Task.findAll();
          }

          expect(tasks).to.have.length(1);
        });

        it('can restrict updates', async function() {
          const Task = this.sequelize.define('Task', { title: DataTypes.STRING }),
            User = this.sequelize.define('User', { username: DataTypes.STRING });

          User.hasMany(Task, { onUpdate: 'restrict' });

          let tasks;
          await this.sequelize.sync({ force: true });

          const [user0, task] = await Promise.all([
            User.create({ username: 'foo' }),
            Task.create({ title: 'task' })
          ]);

          await user0.setTasks([task]);
          const user = user0;
          // Changing the id of a DAO requires a little dance since
          // the `UPDATE` query generated by `save()` uses `id` in the
          // `WHERE` clause

          const tableName = user.sequelize.getQueryInterface().queryGenerator.addSchema(user.constructor);

          try {
            tasks = await user.sequelize.getQueryInterface().update(user, tableName, { id: 999 }, { id: user.id });
          } catch (err) {
            if (!(err instanceof Sequelize.ForeignKeyConstraintError))
              throw err;

            // Should fail due to FK violation
            tasks = await Task.findAll();
          }

          expect(tasks).to.have.length(1);
        });
      }
    });
  });

  describe('Association options', () => {
    it('should setup underscored field with foreign keys when using underscored', function() {
      const User = this.sequelize.define('User', { username: Sequelize.STRING }, { underscored: true });
      const Account = this.sequelize.define('Account', { name: Sequelize.STRING }, { underscored: true });

      User.hasMany(Account);

      expect(Account.rawAttributes.UserId).to.exist;
      expect(Account.rawAttributes.UserId.field).to.equal('user_id');
    });

    it('should use model name when using camelcase', function() {
      const User = this.sequelize.define('User', { username: Sequelize.STRING }, { underscored: false });
      const Account = this.sequelize.define('Account', { name: Sequelize.STRING }, { underscored: false });

      User.hasMany(Account);

      expect(Account.rawAttributes.UserId).to.exist;
      expect(Account.rawAttributes.UserId.field).to.equal('UserId');
    });

    it('can specify data type for auto-generated relational keys', async function() {
      const User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING }),
        dataTypes = [Sequelize.INTEGER, Sequelize.BIGINT, Sequelize.STRING],
        Tasks = {};

      for (const dataType of dataTypes) {
        const tableName = `TaskXYZ_${dataType.key}`;
        Tasks[dataType] = this.sequelize.define(tableName, { title: DataTypes.STRING });

        User.hasMany(Tasks[dataType], { foreignKey: 'userId', keyType: dataType, constraints: false });

        await Tasks[dataType].sync({ force: true });
        expect(Tasks[dataType].rawAttributes.userId.type).to.be.an.instanceof(dataType);
      }
    });

    it('infers the keyType if none provided', async function() {
      const User = this.sequelize.define('User', {
          id: { type: DataTypes.STRING, primaryKey: true },
          username: DataTypes.STRING
        }),
        Task = this.sequelize.define('Task', {
          title: DataTypes.STRING
        });

      User.hasMany(Task);

      await this.sequelize.sync({ force: true });
      expect(Task.rawAttributes.UserId.type instanceof DataTypes.STRING).to.be.ok;
    });

    describe('allows the user to provide an attribute definition object as foreignKey', () => {
      it('works with a column that hasnt been defined before', function() {
        const Task = this.sequelize.define('task', {}),
          User = this.sequelize.define('user', {});

        User.hasMany(Task, {
          foreignKey: {
            name: 'uid',
            allowNull: false
          }
        });

        expect(Task.rawAttributes.uid).to.be.ok;
        expect(Task.rawAttributes.uid.allowNull).to.be.false;
        expect(Task.rawAttributes.uid.references.model).to.equal(User.getTableName());
        expect(Task.rawAttributes.uid.references.key).to.equal('id');
      });

      it('works when taking a column directly from the object', function() {
        const Project = this.sequelize.define('project', {
            user_id: {
              type: Sequelize.INTEGER,
              defaultValue: 42
            }
          }),
          User = this.sequelize.define('user', {
            uid: {
              type: Sequelize.INTEGER,
              primaryKey: true
            }
          });

        User.hasMany(Project, { foreignKey: Project.rawAttributes.user_id });

        expect(Project.rawAttributes.user_id).to.be.ok;
        expect(Project.rawAttributes.user_id.references.model).to.equal(User.getTableName());
        expect(Project.rawAttributes.user_id.references.key).to.equal('uid');
        expect(Project.rawAttributes.user_id.defaultValue).to.equal(42);
      });

      it('works when merging with an existing definition', function() {
        const Task = this.sequelize.define('task', {
            userId: {
              defaultValue: 42,
              type: Sequelize.INTEGER
            }
          }),
          User = this.sequelize.define('user', {});

        User.hasMany(Task, { foreignKey: { allowNull: true } });

        expect(Task.rawAttributes.userId).to.be.ok;
        expect(Task.rawAttributes.userId.defaultValue).to.equal(42);
        expect(Task.rawAttributes.userId.allowNull).to.be.ok;
      });
    });

    it('should throw an error if foreignKey and as result in a name clash', function() {
      const User = this.sequelize.define('user', {
        user: Sequelize.INTEGER
      });

      expect(User.hasMany.bind(User, User, { as: 'user' })).to
        .throw('Naming collision between attribute \'user\' and association \'user\' on model user. To remedy this, change either foreignKey or as in your association definition');
    });

    it('should ignore group from ancestor on deep separated query', async function() {
      const User = this.sequelize.define('user', {
        userId: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        username: Sequelize.STRING
      });
      const Task = this.sequelize.define('task', {
        taskId: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        title: Sequelize.STRING
      });
      const Job = this.sequelize.define('job', {
        jobId: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
        title: Sequelize.STRING
      });

      Task.hasMany(Job, { foreignKey: 'taskId' });
      User.hasMany(Task, { foreignKey: 'userId' });

      await this.sequelize.sync({ force: true });

      await User.create({
        username: 'John Doe',
        tasks: [
          { title: 'Task #1', jobs: [{ title: 'Job #1' }, { title: 'Job #2' }] },
          { title: 'Task #2', jobs: [{ title: 'Job #3' }, { title: 'Job #4' }] }
        ]
      }, { include: [{ model: Task, include: [Job] }] });

      const { count, rows } = await User.findAndCountAll({
        attributes: ['userId'],
        include: [
          { model: Task, separate: true, include: [{ model: Job, separate: true }] }
        ],
        group: [['userId']]
      });

      expect(count.length).to.equal(1);
      expect(count).to.deep.equal([{ userId: 1, count: 1 }]);
      expect(rows[0].tasks[0].jobs.length).to.equal(2);
    });
  });

  describe('sourceKey', () => {
    beforeEach(function() {
      const User = this.sequelize.define('UserXYZ',
        { username: Sequelize.STRING, email: Sequelize.STRING },
        { indexes: [{ fields: ['email'], unique: true }] }
      );
      const Task = this.sequelize.define('TaskXYZ',
        { title: Sequelize.STRING, userEmail: { type: Sequelize.STRING, field: 'user_email_xyz' } });

      User.hasMany(Task, { foreignKey: 'userEmail', sourceKey: 'email', as: 'tasks' });

      this.User = User;
      this.Task = Task;

      return this.sequelize.sync({ force: true });
    });

    it('should use sourceKey', async function() {
      const User = this.User,
        Task = this.Task;

      const user = await User.create({ username: 'John', email: 'john@example.com' });
      await Task.create({ title: 'Fix PR', userEmail: 'john@example.com' });
      const tasks = await user.getTasks();
      expect(tasks.length).to.equal(1);
      expect(tasks[0].title).to.equal('Fix PR');
    });

    it('should count related records', async function() {
      const User = this.User,
        Task = this.Task;

      const user = await User.create({ username: 'John', email: 'john@example.com' });
      await Task.create({ title: 'Fix PR', userEmail: 'john@example.com' });
      const tasksCount = await user.countTasks();
      expect(tasksCount).to.equal(1);
    });

    it('should set right field when add relative', async function() {
      const User = this.User,
        Task = this.Task;

      const user = await User.create({ username: 'John', email: 'john@example.com' });
      const task = await Task.create({ title: 'Fix PR' });
      await user.addTask(task);
      const hasTask = await user.hasTask(task.id);
      expect(hasTask).to.be.true;
    });

    it('should create with nested associated models', async function() {
      const User = this.User,
        values = {
          username: 'John',
          email: 'john@example.com',
          tasks: [{ title: 'Fix new PR' }]
        };

      const user0 = await User.create(values, { include: ['tasks'] });
      // Make sure tasks are defined for created user
      expect(user0).to.have.property('tasks');
      expect(user0.tasks).to.be.an('array');
      expect(user0.tasks).to.lengthOf(1);
      expect(user0.tasks[0].title).to.be.equal(values.tasks[0].title, 'task title is correct');

      const user = await User.findOne({ where: { email: values.email } });
      const tasks = await user.getTasks();
      // Make sure tasks relationship is successful
      expect(tasks).to.be.an('array');
      expect(tasks).to.lengthOf(1);
      expect(tasks[0].title).to.be.equal(values.tasks[0].title, 'task title is correct');
    });

    it('should create nested associations with symmetric getters/setters on FK', async function() {
      // Dummy getter/setter to test they are symmetric
      function toCustomFormat(string) {
        return string && `FORMAT-${string}`;
      }
      function fromCustomFormat(string) {
        return string && string.slice(7);
      }

      const Parent = this.sequelize.define('Parent', {
        id: {
          type: DataTypes.STRING,
          primaryKey: true,
          get() {
            return fromCustomFormat(this.getDataValue('id'));
          },
          set(value) {
            this.setDataValue('id', toCustomFormat(value));
          }
        }
      });

      const Child = this.sequelize.define('Child', {
        id: {
          type: DataTypes.STRING,
          primaryKey: true
        },
        parent: {
          type: DataTypes.STRING,
          get() {
            return fromCustomFormat(this.getDataValue('parent'));
          },
          set(value) {
            this.setDataValue('parent', toCustomFormat(value));
          }
        }
      });
      Child.belongsTo(Parent, {
        foreignKey: 'parent',
        targetKey: 'id'
      });
      Parent.hasMany(Child, {
        foreignKey: 'parent',
        targetKey: 'id',
        as: 'children'
      });

      const values = {
        id: 'sJn369d8Em',
        children: [{ id: 'dgeQAQaW7A' }]
      };
      await this.sequelize.sync({ force: true });
      const father = await Parent.create(values, { include: { model: Child, as: 'children' } });
      // Make sure tasks are defined for created user
      expect(father.id).to.be.equal('sJn369d8Em');
      expect(father.get('id', { raw: true })).to.be.equal('FORMAT-sJn369d8Em');

      expect(father).to.have.property('children');
      expect(father.children).to.be.an('array');
      expect(father.children).to.lengthOf(1);

      expect(father.children[0].parent).to.be.equal('sJn369d8Em');
      expect(father.children[0].get('parent', { raw: true })).to.be.equal('FORMAT-sJn369d8Em');
    });
  });

  describe('sourceKey with where clause in include', () => {
    beforeEach(function() {
      this.User = this.sequelize.define('User',
        { username: Sequelize.STRING, email: { type: Sequelize.STRING, field: 'mail' } },
        { indexes: [{ fields: ['mail'], unique: true }] }
      );
      this.Task = this.sequelize.define('Task',
        { title: Sequelize.STRING, userEmail: Sequelize.STRING, taskStatus: Sequelize.STRING });

      this.User.hasMany(this.Task, {
        foreignKey: 'userEmail',
        sourceKey: 'email'
      });

      return this.sequelize.sync({ force: true });
    });

    it('should use the specified sourceKey instead of the primary key', async function() {
      await this.User.create({ username: 'John', email: 'john@example.com' });

      await this.Task.bulkCreate([
        { title: 'Active Task', userEmail: 'john@example.com', taskStatus: 'Active' },
        { title: 'Inactive Task', userEmail: 'john@example.com', taskStatus: 'Inactive' }
      ]);

      const user = await this.User.findOne({
        include: [
          {
            model: this.Task,
            where: { taskStatus: 'Active' }
          }
        ],
        where: { username: 'John' }
      });

      expect(user).to.be.ok;
      expect(user.Tasks.length).to.equal(1);
      expect(user.Tasks[0].title).to.equal('Active Task');
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
      this.Individual.hasMany(this.Hat, {
        as: {
          singular: 'personwearinghat',
          plural: 'personwearinghats'
        }
      });
    });

    it('should load with an alias', async function() {
      await this.sequelize.sync({ force: true });

      const [individual0, hat] = await Promise.all([
        this.Individual.create({ name: 'Foo Bar' }),
        this.Hat.create({ name: 'Baz' })
      ]);

      await individual0.addPersonwearinghat(hat);

      const individual = await this.Individual.findOne({
        where: { name: 'Foo Bar' },
        include: [{ model: this.Hat, as: 'personwearinghats' }]
      });

      expect(individual.name).to.equal('Foo Bar');
      expect(individual.personwearinghats.length).to.equal(1);
      expect(individual.personwearinghats[0].name).to.equal('Baz');
    });

    it('should load all', async function() {
      await this.sequelize.sync({ force: true });

      const [individual0, hat] = await Promise.all([
        this.Individual.create({ name: 'Foo Bar' }),
        this.Hat.create({ name: 'Baz' })
      ]);

      await individual0.addPersonwearinghat(hat);

      const individual = await this.Individual.findOne({
        where: { name: 'Foo Bar' },
        include: [{ all: true }]
      });

      expect(individual.name).to.equal('Foo Bar');
      expect(individual.personwearinghats.length).to.equal(1);
      expect(individual.personwearinghats[0].name).to.equal('Baz');
    });
  });
});
