'use strict';

/* jshint -W030 */
const chai = require('chai');
const expect = chai.expect;
const Support = require('./../support');
const DataTypes = require('./../../../lib/data-types');
const Sequelize = require('../../../index');
const moment = require('moment');
const sinon = require('sinon');
const current = Support.sequelize;
const dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('HasMany'), () => {
  describe('Model.associations', () => {
    it('should store all assocations when associting to the same table multiple times', function() {
      const User = this.sequelize.define('User', {}), Group = this.sequelize.define('Group', {});

      Group.hasMany(User);
      Group.hasMany(User, { foreignKey: 'primaryGroupId', as: 'primaryUsers' });
      Group.hasMany(User, { foreignKey: 'secondaryGroupId', as: 'secondaryUsers' });

      expect(Object.keys(Group.associations)).to.deep.equal(['Users', 'primaryUsers', 'secondaryUsers']);
    });
  });

  describe('get', () => {
    if (current.dialect.supports.groupedLimit) {
      describe('multiple', () => {
        it('should fetch associations for multiple instances', function () {
          const User = this.sequelize.define('User', {}), Task = this.sequelize.define('Task', {});

          User.Tasks = User.hasMany(Task, {as: 'tasks'});

          return this.sequelize.sync({force: true}).then(() => Sequelize.Promise.join(
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
            }),
            User.create({
              id: 3
            })
          )).then(users => User.Tasks.get(users).then(result => {
            expect(result[users[0].id].length).to.equal(3);
            expect(result[users[1].id].length).to.equal(1);
            expect(result[users[2].id].length).to.equal(0);
          }));
        });

        it('should fetch associations for multiple instances with limit and order', function () {
          const User = this.sequelize.define('User', {}),
                Task = this.sequelize.define('Task', {
                      title: DataTypes.STRING
                    });

          User.Tasks = User.hasMany(Task, {as: 'tasks'});

          return this.sequelize.sync({force: true}).then(() => Sequelize.Promise.join(
            User.create({
              tasks: [
                {title: 'b'},
                {title: 'd'},
                {title: 'c'},
                {title: 'a'}
              ]
            }, {
              include: [User.Tasks]
            }),
            User.create({
              tasks: [
                {title: 'a'},
                {title: 'c'},
                {title: 'b'}
              ]
            }, {
              include: [User.Tasks]
            })
          )).then(users => User.Tasks.get(users, {
            limit: 2,
            order: [
              ['title', 'ASC']
            ]
          }).then(result => {
            expect(result[users[0].id].length).to.equal(2);
            expect(result[users[0].id][0].title).to.equal('a');
            expect(result[users[0].id][1].title).to.equal('b');

            expect(result[users[1].id].length).to.equal(2);
            expect(result[users[1].id][0].title).to.equal('a');
            expect(result[users[1].id][1].title).to.equal('b');
          }));
        });

        it('should fetch multiple layers of associations with limit and order with separate=true', function () {
          const User = this.sequelize.define('User', {}),
                Task = this.sequelize.define('Task', {
                      title: DataTypes.STRING
                    }),
                SubTask = this.sequelize.define('SubTask', {
                      title: DataTypes.STRING
                    });

          User.Tasks = User.hasMany(Task, {as: 'tasks'});
          Task.SubTasks = Task.hasMany(SubTask, {as: 'subtasks'});

          return this.sequelize.sync({force: true}).then(() => Sequelize.Promise.join(
            User.create({
              id: 1,
              tasks: [
                {title: 'b', subtasks: [
                  {title:'c'},
                  {title:'a'}
                ]},
                {title: 'd'},
                {title: 'c', subtasks: [
                  {title:'b'},
                  {title:'a'},
                  {title:'c'}
                ]},
                {title: 'a', subtasks: [
                  {title:'c'},
                  {title:'a'},
                  {title:'b'}
                ]}
              ]
            }, {
              include: [{association: User.Tasks, include: [Task.SubTasks]}]
            }),
            User.create({
              id: 2,
              tasks: [
                {title: 'a', subtasks: [
                  {title:'b'},
                  {title:'a'},
                  {title:'c'}
                ]},
                {title: 'c', subtasks: [
                  {title:'a'}
                ]},
                {title: 'b', subtasks: [
                  {title:'a'},
                  {title:'b'}
                ]}
              ]
            }, {
              include: [{association: User.Tasks, include: [Task.SubTasks]}]
            })
          )).then(users => User.findAll({
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
          }).then(users => {
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
          }));
        });

        it('should fetch associations for multiple instances with limit and order and a belongsTo relation', function () {
          const User = this.sequelize.define('User', {}),
                Task = this.sequelize.define('Task', {
                      title: DataTypes.STRING,
                      categoryId: {
                        type: DataTypes.INTEGER,
                        field: 'category_id'
                      }
                    }),
                Category = this.sequelize.define('Category', {});

          User.Tasks = User.hasMany(Task, {as: 'tasks'});
          Task.Category = Task.belongsTo(Category, {as: 'category', foreignKey: 'categoryId'});

          return this.sequelize.sync({force: true}).then(() => Sequelize.Promise.join(
            User.create({
              tasks: [
                {title: 'b', category: {}},
                {title: 'd', category: {}},
                {title: 'c', category: {}},
                {title: 'a', category: {}}
              ]
            }, {
              include: [{association: User.Tasks, include: [Task.Category]}]
            }),
            User.create({
              tasks: [
                {title: 'a', category: {}},
                {title: 'c', category: {}},
                {title: 'b', category: {}}
              ]
            }, {
              include: [{association: User.Tasks, include: [Task.Category]}]
            })
          )).then(users => User.Tasks.get(users, {
            limit: 2,
            order: [
              ['title', 'ASC']
            ],
            include: [Task.Category],
          }).then(result => {
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
          }));
        });
      });
    }
  });

  describe('(1:N)', () => {

    describe('hasSingle', () => {
      beforeEach(function() {
        this.Article = this.sequelize.define('Article', { 'title': DataTypes.STRING });
        this.Label = this.sequelize.define('Label', { 'text': DataTypes.STRING });

        this.Article.hasMany(this.Label);

        return this.sequelize.sync({ force: true });
      });

      it('should only generate one set of foreignKeys', function() {
        this.Article = this.sequelize.define('Article', { 'title': DataTypes.STRING }, {timestamps: false});
        this.Label = this.sequelize.define('Label', { 'text': DataTypes.STRING }, {timestamps: false});

        this.Label.belongsTo(this.Article);
        this.Article.hasMany(this.Label);

        expect(Object.keys(this.Label.rawAttributes)).to.deep.equal(['id', 'text', 'ArticleId']);
        expect(Object.keys(this.Label.rawAttributes).length).to.equal(3);
      });

      if (current.dialect.supports.transactions) {
        it('supports transactions', function() {
          let Article, Label, sequelize, article, label, t;
          return Support.prepareTransactionTest(this.sequelize).then(_sequelize => {
            sequelize = _sequelize;
            Article = sequelize.define('Article', { 'title': DataTypes.STRING });
            Label = sequelize.define('Label', { 'text': DataTypes.STRING });

            Article.hasMany(Label);

            return sequelize.sync({ force: true });
          }).then(() => Sequelize.Promise.all([
            Article.create({ title: 'foo' }),
            Label.create({ text: 'bar' })
          ])).spread((_article, _label) => {
            article = _article;
            label = _label;
            return sequelize.transaction();
          }).then(_t => {
            t = _t;
            return article.setLabels([label], { transaction: t });
          }).then(() => Article.all({ transaction: t })).then(articles => articles[0].hasLabel(label).then(hasLabel => {
            expect(hasLabel).to.be.false;
          })).then(() => Article.all({ transaction: t })).then(articles => articles[0].hasLabel(label, { transaction: t }).then(hasLabel => {
            expect(hasLabel).to.be.true;
            return t.rollback();
          }));
        });
      }

      it('does not have any labels assigned to it initially', function() {
        return Sequelize.Promise.all([
          this.Article.create({ title: 'Article' }),
          this.Label.create({ text: 'Awesomeness' }),
          this.Label.create({ text: 'Epicness' })
        ]).spread((article, label1, label2) => Sequelize.Promise.all([
          article.hasLabel(label1),
          article.hasLabel(label2)
        ])).spread((hasLabel1, hasLabel2) => {
          expect(hasLabel1).to.be.false;
          expect(hasLabel2).to.be.false;
        });
      });

      it('answers true if the label has been assigned', function() {
        return Sequelize.Promise.all([
          this.Article.create({ title: 'Article' }),
          this.Label.create({ text: 'Awesomeness' }),
          this.Label.create({ text: 'Epicness' })
        ]).spread((article, label1, label2) => article.addLabel(label1).then(() => Sequelize.Promise.all([
          article.hasLabel(label1),
          article.hasLabel(label2)
        ]))).spread((hasLabel1, hasLabel2) => {
          expect(hasLabel1).to.be.true;
          expect(hasLabel2).to.be.false;
        });
      });

      it('answers correctly if the label has been assigned when passing a primary key instead of an object', function() {
        return Sequelize.Promise.all([
          this.Article.create({ title: 'Article' }),
          this.Label.create({ text: 'Awesomeness' }),
          this.Label.create({ text: 'Epicness' })
        ]).spread((article, label1, label2) => article.addLabel(label1).then(() => Sequelize.Promise.all([
          article.hasLabel(label1.id),
          article.hasLabel(label2.id)
        ]))).spread((hasLabel1, hasLabel2) => {
          expect(hasLabel1).to.be.true;
          expect(hasLabel2).to.be.false;
        });
      });
    });

    describe('hasAll', () => {
      beforeEach(function() {
        this.Article = this.sequelize.define('Article', {
          'title': DataTypes.STRING
        });
        this.Label = this.sequelize.define('Label', {
          'text': DataTypes.STRING
        });

        this.Article.hasMany(this.Label);

        return this.sequelize.sync({ force: true });
      });

      if (current.dialect.supports.transactions) {
        it('supports transactions', function() {
          return Support.prepareTransactionTest(this.sequelize).bind({}).then(function(sequelize) {
            this.sequelize = sequelize;
            this.Article = sequelize.define('Article', { 'title': DataTypes.STRING });
            this.Label = sequelize.define('Label', { 'text': DataTypes.STRING });

            this.Article.hasMany(this.Label);

            return this.sequelize.sync({ force: true });
          }).then(function() {
            return Sequelize.Promise.all([
              this.Article.create({ title: 'foo' }),
              this.Label.create({ text: 'bar' })
            ]);
          }).spread(function(article, label) {
            this.article = article;
            this.label = label;
            return this.sequelize.transaction();
          }).then(function(t) {
            this.t = t;
            return this.article.setLabels([this.label], { transaction: t });
          }).then(function() {
            return this.Article.all({ transaction: this.t });
          }).then(function(articles) {
            return Sequelize.Promise.all([
              articles[0].hasLabels([this.label]),
              articles[0].hasLabels([this.label], { transaction: this.t })
            ]);
          }).spread(function(hasLabel1, hasLabel2) {
            expect(hasLabel1).to.be.false;
            expect(hasLabel2).to.be.true;

            return this.t.rollback();
          });
        });
      }

      it('answers false if only some labels have been assigned', function() {
        return Sequelize.Promise.all([
          this.Article.create({ title: 'Article' }),
          this.Label.create({ text: 'Awesomeness' }),
          this.Label.create({ text: 'Epicness' })
        ]).spread((article, label1, label2) => article.addLabel(label1).then(() => article.hasLabels([label1, label2]))).then(result => {
          expect(result).to.be.false;
        });
      });

      it('answers false if only some labels have been assigned when passing a primary key instead of an object', function() {
        return Sequelize.Promise.all([
          this.Article.create({ title: 'Article' }),
          this.Label.create({ text: 'Awesomeness' }),
          this.Label.create({ text: 'Epicness' })
        ]).spread((article, label1, label2) => article.addLabel(label1).then(() => article.hasLabels([label1.id, label2.id]).then(result => {
          expect(result).to.be.false;
        })));
      });

      it('answers true if all label have been assigned', function() {
        return Sequelize.Promise.all([
          this.Article.create({ title: 'Article' }),
          this.Label.create({ text: 'Awesomeness' }),
          this.Label.create({ text: 'Epicness' })
        ]).spread((article, label1, label2) => article.setLabels([label1, label2]).then(() => article.hasLabels([label1, label2]).then(result => {
          expect(result).to.be.true;
        })));
      });

      it('answers true if all label have been assigned when passing a primary key instead of an object', function() {
        return Sequelize.Promise.all([
          this.Article.create({ title: 'Article' }),
          this.Label.create({ text: 'Awesomeness' }),
          this.Label.create({ text: 'Epicness' })
        ]).spread((article, label1, label2) => article.setLabels([label1, label2]).then(() => article.hasLabels([label1.id, label2.id]).then(result => {
          expect(result).to.be.true;
        })));
      });
    });

    describe('setAssociations', () => {

      if (current.dialect.supports.transactions) {
        it('supports transactions', function() {
          return Support.prepareTransactionTest(this.sequelize).bind({}).then(function(sequelize) {
            this.Article = sequelize.define('Article', { 'title': DataTypes.STRING });
            this.Label = sequelize.define('Label', { 'text': DataTypes.STRING });

            this.Article.hasMany(this.Label);

            this.sequelize = sequelize;
            return sequelize.sync({ force: true });
          }).then(function() {
            return Sequelize.Promise.all([
              this.Article.create({ title: 'foo' }),
              this.Label.create({ text: 'bar' }),
              this.sequelize.transaction()
            ]);
          }).spread(function(article, label, t) {
            this.article = article;
            this. t = t;
            return article.setLabels([label], { transaction: t });
          }).then(function() {
            return this.Label.findAll({ where: { ArticleId: this.article.id }, transaction: undefined });
          }).then(function(labels) {
            expect(labels.length).to.equal(0);

            return this.Label.findAll({ where: { ArticleId: this.article.id }, transaction: this.t });
          }).then(function(labels) {
            expect(labels.length).to.equal(1);
            return this.t.rollback();
          });
        });
      }

      it('clears associations when passing null to the set-method', function() {
        const User = this.sequelize.define('User', { username: DataTypes.STRING }), Task = this.sequelize.define('Task', { title: DataTypes.STRING });

        Task.hasMany(User);

        return this.sequelize.sync({ force: true }).then(() => Sequelize.Promise.all([
          User.create({ username: 'foo' }),
          Task.create({ title: 'task' })
        ])).bind({}).spread(function(user, task) {
          this.task = task;
          return task.setUsers([user]);
        }).then(function() {
          return this.task.getUsers();
        }).then(function(users) {
          expect(users).to.have.length(1);

          return this.task.setUsers(null);
        }).then(function() {
          return this.task.getUsers();
        }).then(users => {
          expect(users).to.have.length(0);
        });
      });

      it('supports passing the primary key instead of an object', function() {
        const Article = this.sequelize.define('Article', { title: DataTypes.STRING }), Label = this.sequelize.define('Label', { text: DataTypes.STRING });

        Article.hasMany(Label);

        return this.sequelize.sync({ force: true }).then(() => Sequelize.Promise.all([
          Article.create({}),
          Label.create({ text: 'label one' }),
          Label.create({ text: 'label two' })
        ])).bind({}).spread(function(article, label1, label2) {
          this.article = article;
          this.label1 = label1;
          this.label2 = label2;
          return article.addLabel(label1.id);
        }).then(function() {
          return this.article.setLabels([this.label2.id]);
        }).then(function() {
          return this.article.getLabels();
        }).then(labels => {
          expect(labels).to.have.length(1);
          expect(labels[0].text).to.equal('label two');
        });
      });
    });

    describe('addAssociations', () => {
      if (current.dialect.supports.transactions) {
        it('supports transactions', function() {
          return Support.prepareTransactionTest(this.sequelize).bind({}).then(function(sequelize) {
            this.Article = sequelize.define('Article', { 'title': DataTypes.STRING });
            this.Label = sequelize.define('Label', { 'text': DataTypes.STRING });
            this.Article.hasMany(this.Label);

            this.sequelize = sequelize;
            return sequelize.sync({ force: true });
          }).then(function() {
            return Sequelize.Promise.all([
              this.Article.create({ title: 'foo' }),
              this.Label.create({ text: 'bar' })
            ]);
          }).spread(function(article, label) {
            this.article = article;
            this.label = label;
            return this.sequelize.transaction();
          }).then(function(t) {
            this.t = t;
            return this.article.addLabel(this.label, { transaction: this.t });
          }).then(function() {
            return this.Label.findAll({ where: { ArticleId: this.article.id }, transaction: undefined });
          }).then(function(labels) {
            expect(labels.length).to.equal(0);

            return this.Label.findAll({ where: { ArticleId: this.article.id }, transaction: this.t });
          }).then(function(labels) {
            expect(labels.length).to.equal(1);
            return this.t.rollback();
          });
        });
      }

      it('supports passing the primary key instead of an object', function() {
        const Article = this.sequelize.define('Article', { 'title': DataTypes.STRING }), Label = this.sequelize.define('Label', { 'text': DataTypes.STRING });

        Article.hasMany(Label);

        return this.sequelize.sync({ force: true }).then(() => Sequelize.Promise.all([
          Article.create({}),
          Label.create({ text: 'label one' })
        ])).bind({}).spread(function(article, label) {
          this.article = article;
          return article.addLabel(label.id);
        }).then(function() {
          return this.article.getLabels();
        }).then(labels => {
          expect(labels[0].text).to.equal('label one'); // Make sure that we didn't modify one of the other attributes while building / saving a new instance
        });
      });
    });

    describe('addMultipleAssociations', () => {
      it('adds associations without removing the current ones', function() {
        const User = this.sequelize.define('User', { username: DataTypes.STRING }), Task = this.sequelize.define('Task', { title: DataTypes.STRING });

        Task.hasMany(User);

        return this.sequelize.sync({ force: true }).then(() => User.bulkCreate([
          { username: 'foo '},
          { username: 'bar '},
          { username: 'baz '}
        ])).bind({}).then(() => Task.create({ title: 'task' })).then(function(task) {
          this.task = task;
          return User.findAll();
        }).then(function(users) {
          this.users = users;
          return this.task.setUsers([users[0]]);
        }).then(function() {
          return this.task.addUsers([this.users[1], this.users[2]]);
        }).then(function() {
          return this.task.getUsers();
        }).then(users => {
          expect(users).to.have.length(3);
        });
      });
    });

    it('clears associations when passing null to the set-method with omitNull set to true', function() {
      this.sequelize.options.omitNull = true;

      const User = this.sequelize.define('User', { username: DataTypes.STRING }), Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      Task.hasMany(User);

      return this.sequelize.sync({ force: true }).then(() => User.create({ username: 'foo' })).bind({}).then(function(user) {
        this.user = user;
        return Task.create({ title: 'task' });
      }).then(function(task) {
        this.task = task;
        return task.setUsers([this.user]);
      }).then(function() {
        return this.task.getUsers();
      }).then(function(_users) {
        expect(_users).to.have.length(1);

        return this.task.setUsers(null);
      }).then(function() {
        return this.task.getUsers();
      }).then(_users => {
        expect(_users).to.have.length(0);
      });
    });

    describe('createAssociations', () => {
      it('creates a new associated object', function() {
        const Article = this.sequelize.define('Article', { 'title': DataTypes.STRING }), Label = this.sequelize.define('Label', { 'text': DataTypes.STRING });

        Article.hasMany(Label);

        return this.sequelize.sync({ force: true }).then(() => Article.create({ title: 'foo' })).then(article => article.createLabel({ text: 'bar' }).return (article)).then(article => Label.findAll({ where: { ArticleId: article.id }})).then(labels => {
          expect(labels.length).to.equal(1);
        });
      });

      it('creates the object with the association directly', function() {
        const spy = sinon.spy();

        const Article = this.sequelize.define('Article', {
                'title': DataTypes.STRING

              }),
              Label = this.sequelize.define('Label', {
                'text': DataTypes.STRING
              });

        Article.hasMany(Label);

        return this.sequelize.sync({ force: true }).then(() => Article.create({ title: 'foo' })).bind({}).then(function(article) {
          this.article = article;
          return article.createLabel({ text: 'bar' }, {logging: spy});
        }).then(function(label) {
          expect(spy.calledOnce).to.be.true;
          expect(label.ArticleId).to.equal(this.article.id);
        });
      });

      if (current.dialect.supports.transactions) {
        it('supports transactions', function() {
          return Support.prepareTransactionTest(this.sequelize).bind({}).then(function(sequelize) {
            this.sequelize = sequelize;
            this.Article = sequelize.define('Article', { 'title': DataTypes.STRING });
            this.Label = sequelize.define('Label', { 'text': DataTypes.STRING });

            this.Article.hasMany(this.Label);

            return sequelize.sync({ force: true});
          }).then(function() {
            return this.Article.create({ title: 'foo' });
          }).then(function(article) {
            this.article = article;
            return this.sequelize.transaction();
          }).then(function(t) {
            this.t = t;
            return this.article.createLabel({ text: 'bar' }, { transaction: this.t });
          }).then(function() {
            return this.Label.findAll();
          }).then(function(labels) {
            expect(labels.length).to.equal(0);
            return this.Label.findAll({ where: { ArticleId: this.article.id }});
          }).then(function(labels) {
            expect(labels.length).to.equal(0);
            return this.Label.findAll({ where: { ArticleId: this.article.id }, transaction: this.t });
          }).then(function(labels) {
            expect(labels.length).to.equal(1);
            return this.t.rollback();
          });
        });
      }

      it('supports passing the field option', function() {
        const Article = this.sequelize.define('Article', {
                    'title': DataTypes.STRING
                  }),
              Label = this.sequelize.define('Label', {
                    'text': DataTypes.STRING
                  });

        Article.hasMany(Label);

        return this.sequelize.sync({force: true}).then(() => Article.create()).then(article => article.createLabel({
          text: 'yolo'
        }, {
          fields: ['text']
        }).return (article)).then(article => article.getLabels()).then(labels => {
          expect(labels.length).to.be.ok;
        });
      });
    });

    describe('getting assocations with options', () => {
      beforeEach(function() {
        const self = this;

        this.User = this.sequelize.define('User', { username: DataTypes.STRING });
        this.Task = this.sequelize.define('Task', { title: DataTypes.STRING, active: DataTypes.BOOLEAN });

        this.User.hasMany(self.Task);

        return this.sequelize.sync({ force: true }).then(() => Sequelize.Promise.all([
          self.User.create({ username: 'John'}),
          self.Task.create({ title: 'Get rich', active: true}),
          self.Task.create({ title: 'Die trying', active: false})
        ])).spread((john, task1, task2) => john.setTasks([task1, task2]));
      });

      it('should treat the where object of associations as a first class citizen', function() {
        const self = this;
        this.Article = this.sequelize.define('Article', {
          'title': DataTypes.STRING
        });
        this.Label = this.sequelize.define('Label', {
          'text': DataTypes.STRING,
          'until': DataTypes.DATE
        });

        this.Article.hasMany(this.Label);

        return this.sequelize.sync({ force: true }).then(() => Sequelize.Promise.all([
          self.Article.create({ title: 'Article' }),
          self.Label.create({ text: 'Awesomeness', until: '2014-01-01 01:00:00' }),
          self.Label.create({ text: 'Epicness', until: '2014-01-03 01:00:00' })
        ])).bind({}).spread(function(article, label1, label2) {
          this.article = article;
          return article.setLabels([label1, label2]);
        }).then(function() {
          return this.article.getLabels({where: ['until > ?', moment('2014-01-02').toDate()]});
        }).then(labels => {
          expect(labels).to.be.instanceof(Array);
          expect(labels).to.have.length(1);
          expect(labels[0].text).to.equal('Epicness');
        });
      });

      it('gets all associated objects when no options are passed', function() {
        return this.User.find({where: {username: 'John'}}).then(john => john.getTasks()).then(tasks => {
          expect(tasks).to.have.length(2);
        });
      });

      it('only get objects that fulfill the options', function() {
        return this.User.find({ where: { username: 'John' } }).then(john => john.getTasks({ where: { active: true }, limit: 10, order: 'id DESC' })).then(tasks => {
          expect(tasks).to.have.length(1);
        });
      });
    });

    describe('countAssociations', () => {
      beforeEach(function() {
        const self = this;

        this.User = this.sequelize.define('User', { username: DataTypes.STRING });
        this.Task = this.sequelize.define('Task', { title: DataTypes.STRING, active: DataTypes.BOOLEAN });

        this.User.hasMany(self.Task, {
          foreignKey: 'userId'
        });

        return this.sequelize.sync({ force: true }).then(() => Sequelize.Promise.all([
          self.User.create({ username: 'John'}),
          self.Task.create({ title: 'Get rich', active: true}),
          self.Task.create({ title: 'Die trying', active: false})
        ])).spread((john, task1, task2) => {
          self.user = john;
          return john.setTasks([task1, task2]);
        });
      });

      it('should count all associations', function () {
        return expect(this.user.countTasks({})).to.eventually.equal(2);
      });

      it('should count filtered associations', function () {
        return expect(this.user.countTasks({
          where: {
            active: true
          }
        })).to.eventually.equal(1);
      });

      it('should count scoped associations', function () {
        this.User.hasMany(this.Task, {
          foreignKey: 'userId',
          as: 'activeTasks',
          scope: {
            active: true
          }
        });

        return expect(this.user.countActiveTasks({})).to.eventually.equal(1);
      });
    });

    describe('selfAssociations', () => {
      it('should work with alias', function() {
        const Person = this.sequelize.define('Group', {});

        Person.hasMany(Person, { as: 'Children'});

        return this.sequelize.sync();
      });
    });
  });

  describe('Foreign key constraints', () => {
    describe('1:m', () => {
      it('sets null by default', function() {
        const Task = this.sequelize.define('Task', { title: DataTypes.STRING }), User = this.sequelize.define('User', { username: DataTypes.STRING });

        User.hasMany(Task);

        return this.sequelize.sync({ force: true }).then(() => Sequelize.Promise.all([
          User.create({ username: 'foo' }),
          Task.create({ title: 'task' })
        ])).spread((user, task) => user.setTasks([task]).then(() => user.destroy().then(() => task.reload()))).then(task => {
          expect(task.UserId).to.equal(null);
        });
      });

      it('sets to CASCADE if allowNull: false', function() {
        const Task = this.sequelize.define('Task', { title: DataTypes.STRING }), User = this.sequelize.define('User', { username: DataTypes.STRING });

        User.hasMany(Task, { foreignKey: { allowNull: false }}); // defaults to CASCADE

        return this.sequelize.sync({ force: true }).then(() => User.create({ username: 'foo' }).then(user => Task.create({ title: 'task', UserId: user.id }).then(() => user.destroy().then(() => Task.findAll()))).then(tasks => {
          expect(tasks).to.be.empty;
        }));
      });

      it('should be possible to remove all constraints', function() {
        const Task = this.sequelize.define('Task', { title: DataTypes.STRING }), User = this.sequelize.define('User', { username: DataTypes.STRING });

        User.hasMany(Task, { constraints: false });

        return this.sequelize.sync({ force: true }).bind({}).then(() => Sequelize.Promise.all([
          User.create({ username: 'foo' }),
          Task.create({ title: 'task' })
        ])).spread(function(user, task) {
          this.user = user;
          this.task = task;
          return user.setTasks([task]);
        }).then(function() {
          return this.user.destroy();
        }).then(function() {
          return this.task.reload();
        }).then(function(task) {
          expect(task.UserId).to.equal(this.user.id);
        });
      });

      it('can cascade deletes', function() {
        const Task = this.sequelize.define('Task', { title: DataTypes.STRING }), User = this.sequelize.define('User', { username: DataTypes.STRING });

        User.hasMany(Task, {onDelete: 'cascade'});

        return this.sequelize.sync({ force: true }).bind({}).then(() => Sequelize.Promise.all([
          User.create({ username: 'foo' }),
          Task.create({ title: 'task' })
        ])).spread(function(user, task) {
          this.user = user;
          this.task = task;
          return user.setTasks([task]);
        }).then(function() {
          return this.user.destroy();
        }).then(() => Task.findAll()).then(tasks => {
          expect(tasks).to.have.length(0);
        });
      });

      // NOTE: mssql does not support changing an autoincrement primary key
      if (dialect !== 'mssql') {
        it('can cascade updates', function() {
          const Task = this.sequelize.define('Task', { title: DataTypes.STRING }), User = this.sequelize.define('User', { username: DataTypes.STRING });

          User.hasMany(Task, {onUpdate: 'cascade'});

          return this.sequelize.sync({ force: true }).then(() => Sequelize.Promise.all([
            User.create({ username: 'foo' }),
            Task.create({ title: 'task' })
          ])).spread((user, task) => user.setTasks([task]).return (user)).then(user => {
            // Changing the id of a DAO requires a little dance since
            // the `UPDATE` query generated by `save()` uses `id` in the
            // `WHERE` clause

            const tableName = user.sequelize.getQueryInterface().QueryGenerator.addSchema(user.constructor);
            return user.sequelize.getQueryInterface().update(user, tableName, {id: 999}, {id: user.id});
          }).then(() => Task.findAll()).then(tasks => {
            expect(tasks).to.have.length(1);
            expect(tasks[0].UserId).to.equal(999);
          });
        });
      }

      if (current.dialect.supports.constraints.restrict) {
        it('can restrict deletes', function() {
          const self = this;
          const Task = this.sequelize.define('Task', { title: DataTypes.STRING }), User = this.sequelize.define('User', { username: DataTypes.STRING });

          User.hasMany(Task, {onDelete: 'restrict'});

          return this.sequelize.sync({ force: true }).bind({}).then(() => Sequelize.Promise.all([
            User.create({ username: 'foo' }),
            Task.create({ title: 'task' })
          ])).spread(function(user, task) {
            this.user = user;
            this.task = task;
            return user.setTasks([task]);
          }).then(function() {
            return this.user.destroy().catch (self.sequelize.ForeignKeyConstraintError, () => Task.findAll());
          }).then(tasks => {
            expect(tasks).to.have.length(1);
          });
        });

        it('can restrict updates', function() {
          const self = this;
          const Task = this.sequelize.define('Task', { title: DataTypes.STRING }), User = this.sequelize.define('User', { username: DataTypes.STRING });

          User.hasMany(Task, {onUpdate: 'restrict'});

          return this.sequelize.sync({ force: true }).then(() => Sequelize.Promise.all([
            User.create({ username: 'foo' }),
            Task.create({ title: 'task' })
          ])).spread((user, task) => user.setTasks([task]).return (user)).then(user => {
            // Changing the id of a DAO requires a little dance since
            // the `UPDATE` query generated by `save()` uses `id` in the
            // `WHERE` clause

            const tableName = user.sequelize.getQueryInterface().QueryGenerator.addSchema(user.constructor);
            return user.sequelize.getQueryInterface().update(user, tableName, {id: 999}, {id: user.id})
            .catch (self.sequelize.ForeignKeyConstraintError, () => Task.findAll());
          }).then(tasks => {
            expect(tasks).to.have.length(1);
          });
        });

      }

    });
  });

  describe('Association options', () => {
    it('can specify data type for autogenerated relational keys', function() {
      const User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING }), dataTypes = [Sequelize.INTEGER, Sequelize.BIGINT, Sequelize.STRING], self = this, Tasks = {};

      return Sequelize.Promise.each(dataTypes, dataType => {
        const tableName = `TaskXYZ_${dataType.key}`;
        Tasks[dataType] = self.sequelize.define(tableName, { title: DataTypes.STRING });

        User.hasMany(Tasks[dataType], { foreignKey: 'userId', keyType: dataType, constraints: false });

        return Tasks[dataType].sync({ force: true }).then(() => {
          expect(Tasks[dataType].rawAttributes.userId.type).to.be.an.instanceof(dataType);
        });
      });
    });

    it('infers the keyType if none provided', function() {
      const User = this.sequelize.define('User', {
              id: { type: DataTypes.STRING, primaryKey: true },
              username: DataTypes.STRING
            }),
            Task = this.sequelize.define('Task', {
              title: DataTypes.STRING
            });

      User.hasMany(Task);

      return this.sequelize.sync({ force: true }).then(() => {
        expect(Task.rawAttributes.UserId.type instanceof DataTypes.STRING).to.be.ok;
      });
    });

    describe('allows the user to provide an attribute definition object as foreignKey', () => {
      it('works with a column that hasnt been defined before', function() {
        const Task = this.sequelize.define('task', {}), User = this.sequelize.define('user', {});

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

        User.hasMany(Project, { foreignKey: Project.rawAttributes.user_id});

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

        User.hasMany(Task, { foreignKey: { allowNull: true }});

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
        .throw ('Naming collision between attribute \'user\' and association \'user\' on model user. To remedy this, change either foreignKey or as in your association definition');
    });
  });
});
