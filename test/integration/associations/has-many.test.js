'use strict';

var chai = require('chai')
  , expect = chai.expect
  , Support = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , Sequelize = require('../../../index')
  , _ = require('lodash')
  , moment = require('moment')
  , sinon = require('sinon')
  , Promise = Sequelize.Promise
  , current = Support.sequelize
  , dialect = Support.getTestDialect();

chai.config.includeStack = true;

describe(Support.getTestDialectTeaser('HasMany'), function() {
  describe('Model.associations', function() {
    it('should store all assocations when associting to the same table multiple times', function() {
      var User = this.sequelize.define('User', {})
        , Group = this.sequelize.define('Group', {});

      Group.hasMany(User);
      Group.hasMany(User, { foreignKey: 'primaryGroupId', as: 'primaryUsers' });
      Group.hasMany(User, { foreignKey: 'secondaryGroupId', as: 'secondaryUsers' });

      expect(Object.keys(Group.associations)).to.deep.equal(['GroupsUsers', 'primaryUsers', 'secondaryUsers']);
    });
  });

  describe('(1:N)', function() {
    describe('hasSingle', function() {
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
          var Article, Label, sequelize, article, label, t;
          return Support.prepareTransactionTest(this.sequelize).then(function(_sequelize) {
            sequelize = _sequelize;
            Article = sequelize.define('Article', { 'title': DataTypes.STRING });
            Label = sequelize.define('Label', { 'text': DataTypes.STRING });

            Article.hasMany(Label);

            return sequelize.sync({ force: true });
          }).then(function() {
            return Promise.all([
              Article.create({ title: 'foo' }),
              Label.create({ text: 'bar' })
            ]);
          }).spread(function(_article, _label) {
            article = _article;
            label = _label;
            return sequelize.transaction();
          }).then(function(_t) {
            t = _t;
            return article.setLabels([label], { transaction: t });
          }).then(function() {
            return Article.all({ transaction: t });
          }).then(function(articles) {
            return articles[0].hasLabel(label).then(function(hasLabel) {
              expect(hasLabel).to.be.false;
            });
          }).then(function() {
            return Article.all({ transaction: t });
          }).then(function(articles) {
            return articles[0].hasLabel(label, { transaction: t }).then(function(hasLabel) {
              expect(hasLabel).to.be.true;
              return t.rollback();
            });
          });
        });
      }

      it('does not have any labels assigned to it initially', function() {
        return Promise.all([
          this.Article.create({ title: 'Article' }),
          this.Label.create({ text: 'Awesomeness' }),
          this.Label.create({ text: 'Epicness' })
        ]).spread(function(article, label1, label2) {
          return Promise.all([
            article.hasLabel(label1),
            article.hasLabel(label2)
          ]);
        }).spread(function(hasLabel1, hasLabel2) {
          expect(hasLabel1).to.be.false;
          expect(hasLabel2).to.be.false;
        });
      });

      it('answers true if the label has been assigned', function() {
        return Promise.all([
          this.Article.create({ title: 'Article' }),
          this.Label.create({ text: 'Awesomeness' }),
          this.Label.create({ text: 'Epicness' })
        ]).spread(function(article, label1, label2) {
          return article.addLabel(label1).then(function() {
            return Promise.all([
              article.hasLabel(label1),
              article.hasLabel(label2)
            ]);
          });
        }).spread(function(hasLabel1, hasLabel2) {
          expect(hasLabel1).to.be.true;
          expect(hasLabel2).to.be.false;
        });
      });

      it('answers correctly if the label has been assigned when passing a primary key instead of an object', function() {
        return Promise.all([
          this.Article.create({ title: 'Article' }),
          this.Label.create({ text: 'Awesomeness' }),
          this.Label.create({ text: 'Epicness' })
        ]).spread(function(article, label1, label2) {
          return article.addLabel(label1).then(function() {
            return Promise.all([
              article.hasLabel(label1.id),
              article.hasLabel(label2.id)
            ]);
          });
        }).spread(function(hasLabel1, hasLabel2) {
          expect(hasLabel1).to.be.true;
          expect(hasLabel2).to.be.false;
        });
      });
    });

    describe('hasAll', function() {
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
            return Promise.all([
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
            return Promise.all([
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
        return Promise.all([
          this.Article.create({ title: 'Article' }),
          this.Label.create({ text: 'Awesomeness' }),
          this.Label.create({ text: 'Epicness' })
        ]).spread(function(article, label1, label2) {
          return article.addLabel(label1).then(function() {
            return article.hasLabels([label1, label2]);
          });
        }).then(function(result) {
          expect(result).to.be.false;
        });
      });

      it('answers false if only some labels have been assigned when passing a primary key instead of an object', function() {
        return Promise.all([
          this.Article.create({ title: 'Article' }),
          this.Label.create({ text: 'Awesomeness' }),
          this.Label.create({ text: 'Epicness' })
        ]).spread(function(article, label1, label2) {
          return article.addLabel(label1).then(function() {
            return article.hasLabels([label1.id, label2.id]).then(function(result) {
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
        ]).spread(function(article, label1, label2) {
          return article.setLabels([label1, label2]).then(function() {
            return article.hasLabels([label1, label2]).then(function(result) {
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
        ]).spread(function(article, label1, label2) {
          return article.setLabels([label1, label2]).then(function() {
            return article.hasLabels([label1.id, label2.id]).then(function(result) {
              expect(result).to.be.true;
            });
          });
        });
      });
    });

    describe('setAssociations', function() {

      if (current.dialect.supports.transactions) {
        it('supports transactions', function() {
          return Support.prepareTransactionTest(this.sequelize).bind({}).then(function(sequelize) {
            this.Article = sequelize.define('Article', { 'title': DataTypes.STRING });
            this.Label = sequelize.define('Label', { 'text': DataTypes.STRING });

            this.Article.hasMany(this.Label);

            this.sequelize = sequelize;
            return sequelize.sync({ force: true });
          }).then(function() {
            return Promise.all([
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
        var User = this.sequelize.define('User', { username: DataTypes.STRING })
          , Task = this.sequelize.define('Task', { title: DataTypes.STRING });

        Task.hasMany(User);

        return this.sequelize.sync({ force: true }).then(function() {
          return Promise.all([
            User.create({ username: 'foo' }),
            Task.create({ title: 'task' })
          ]);
        }).bind({}).spread(function(user, task) {
          this.task = task;
          return task.setUsers([user]);
        }).then(function() {
          return this.task.getUsers();
        }).then(function(users) {
          expect(users).to.have.length(1);

          return this.task.setUsers(null);
        }).then(function() {
          return this.task.getUsers();
        }).then(function(users) {
          expect(users).to.have.length(0);
        });
      });

      it('supports passing the primary key instead of an object', function() {
        var Article = this.sequelize.define('Article', { title: DataTypes.STRING })
          , Label = this.sequelize.define('Label', { text: DataTypes.STRING });

        Article.hasMany(Label);

        return this.sequelize.sync({ force: true }).then(function() {
          return Promise.all([
            Article.create({}),
            Label.create({ text: 'label one' }),
            Label.create({ text: 'label two' })
          ]);
        }).bind({}).spread(function(article, label1, label2) {
          this.article = article;
          this.label1 = label1;
          this.label2 = label2;
          return article.addLabel(label1.id);
        }).then(function() {
          return this.article.setLabels([this.label2.id]);
        }).then(function() {
          return this.article.getLabels();
        }).then(function(labels) {
          expect(labels).to.have.length(1);
          expect(labels[0].text).to.equal('label two');
        });
      });

      it('allows to update join table attributes with primary keys other than "id"', function() {
        var Article = this.sequelize.define('Article', {aid: {type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true}, title: DataTypes.STRING})
          , Label = this.sequelize.define('Label', {lid: {type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true}, text: DataTypes.STRING})
          , ArticleHasLabel = this.sequelize.define('ArticleHasLabel', {color: DataTypes.ENUM(['red', 'green', 'blue'])});

        Article.hasMany(Label, {through: ArticleHasLabel});
        Label.hasMany(Article, {through: ArticleHasLabel});

        return this.sequelize.sync({ force: true }).then(function() {
          return Promise.all([
            Article.create(),
            Label.create({ text: 'cheap' }),
            Label.create({ text: 'steal' })
          ]);
        }).spread(function(article, label1, label2) {
          label2.ArticleHasLabel = {color: 'green'};
          return article.setLabels([label1, label2]).then(function() {
            label1.ArticleHasLabel = {color: 'red'};
            return article.setLabels([label1, label2]).then(function() {
              return article.getLabels().then(function(labels) {
                expect(labels).to.have.length(2);

                expect(_.find(labels, function(label) { return label.lid === label1.lid; }).ArticleHasLabel.color).to.equal('red');
                expect(_.find(labels, function(label) { return label.lid === label2.lid; }).ArticleHasLabel.color).to.equal('green');
              });
            });
          });
        });
      });
    });

    describe('addAssociations', function() {
      if (current.dialect.supports.transactions) {
        it('supports transactions', function() {
          return Support.prepareTransactionTest(this.sequelize).bind({}).then(function(sequelize) {
            this.Article = sequelize.define('Article', { 'title': DataTypes.STRING });
            this.Label = sequelize.define('Label', { 'text': DataTypes.STRING });
            this.Article.hasMany(this.Label);

            this.sequelize = sequelize;
            return sequelize.sync({ force: true });
          }).then(function() {
            return Promise.all([
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
        var Article = this.sequelize.define('Article', { 'title': DataTypes.STRING })
          , Label = this.sequelize.define('Label', { 'text': DataTypes.STRING });

        Article.hasMany(Label);

        return this.sequelize.sync({ force: true }).then(function() {
          return Promise.all([
            Article.create({}),
            Label.create({ text: 'label one' })
          ]);
        }).bind({}).spread(function(article, label) {
          this.article = article;
          return article.addLabel(label.id);
        }).then(function() {
          return this.article.getLabels();
        }).then(function(labels) {
          expect(labels[0].text).to.equal('label one'); // Make sure that we didn't modify one of the other attributes while building / saving a new instance
        });
      });
    });

    describe('addMultipleAssociations', function() {
      it('adds associations without removing the current ones', function() {
        var User = this.sequelize.define('User', { username: DataTypes.STRING })
          , Task = this.sequelize.define('Task', { title: DataTypes.STRING });

        Task.hasMany(User);

        return this.sequelize.sync({ force: true }).then(function() {
          return User.bulkCreate([
            { username: 'foo '},
            { username: 'bar '},
            { username: 'baz '}
          ]);
        }).bind({}).then(function() {
          return Task.create({ title: 'task' });
        }).then(function(task) {
          this.task = task;
          return User.findAll();
        }).then(function(users) {
          this.users = users;
          return this.task.setUsers([users[0]]);
        }).then(function() {
          return this.task.addUsers([this.users[1], this.users[2]]);
        }).then(function() {
          return this.task.getUsers();
        }).then(function(users) {
          expect(users).to.have.length(3);
        });
      });
    });

    it('clears associations when passing null to the set-method with omitNull set to true', function() {
      this.sequelize.options.omitNull = true;

      var User = this.sequelize.define('User', { username: DataTypes.STRING })
        , Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      Task.hasMany(User);

      return this.sequelize.sync({ force: true }).then(function() {
        return User.create({ username: 'foo' });
      }).bind({}).then(function(user) {
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
      }).then(function(_users) {
        expect(_users).to.have.length(0);
      });
    });

    describe('createAssociations', function() {
      it('creates a new associated object', function() {
        var Article = this.sequelize.define('Article', { 'title': DataTypes.STRING })
          , Label = this.sequelize.define('Label', { 'text': DataTypes.STRING });

        Article.hasMany(Label);

        return this.sequelize.sync({ force: true }).then(function() {
          return Article.create({ title: 'foo' });
        }).then(function(article) {
          return article.createLabel({ text: 'bar' }).return (article);
        }).then(function(article) {
          return Label.findAll({ where: { ArticleId: article.id }});
        }).then(function(labels) {
          expect(labels.length).to.equal(1);
        });
      });

      it('creates the object with the association directly', function() {
        var spy = sinon.spy();

        var Article = this.sequelize.define('Article', {
          'title': DataTypes.STRING

        }), Label = this.sequelize.define('Label', {
          'text': DataTypes.STRING
        });

        Article.hasMany(Label);

        return this.sequelize.sync({ force: true }).then(function() {
          return Article.create({ title: 'foo' });
        }).bind({}).then(function(article) {
          this.article = article;
          return article.createLabel({ text: 'bar' }).on('sql', spy);
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
            return this.Label.findAll({ where: { ArticleId: this.article.id }}, { transaction: this.t });
          }).then(function(labels) {
            expect(labels.length).to.equal(1);
            return this.t.rollback();
          });
        });
      }

      it('supports passing the field option', function() {
        var Article = this.sequelize.define('Article', {
              'title': DataTypes.STRING
            })
          , Label = this.sequelize.define('Label', {
              'text': DataTypes.STRING
            });

        Article.hasMany(Label);

        return this.sequelize.sync({force: true}).then(function() {
          return Article.create();
        }).then(function(article) {
          return article.createLabel({
            text: 'yolo'
          }, {
            fields: ['text']
          }).return (article);
        }).then(function(article) {
          return article.getLabels();
        }).then(function(labels) {
          expect(labels.length).to.be.ok;
        });
      });
    });

    describe('getting assocations with options', function() {
      beforeEach(function() {
        var self = this;

        this.User = this.sequelize.define('User', { username: DataTypes.STRING });
        this.Task = this.sequelize.define('Task', { title: DataTypes.STRING, active: DataTypes.BOOLEAN });

        this.User.hasMany(self.Task);

        return this.sequelize.sync({ force: true }).then(function() {
          return Promise.all([
            self.User.create({ username: 'John'}),
            self.Task.create({ title: 'Get rich', active: true}),
            self.Task.create({ title: 'Die trying', active: false})
          ]);
        }).spread(function(john, task1, task2) {
          return john.setTasks([task1, task2]);
        });
      });

      it('does not modify the passed arguments', function() {
        return this.User.create({}).bind(this).then(function(user) {
          this.options = {};

          return user.getTasks(this.options);
        }).then(function() {
          expect(this.options).to.deep.equal({});
        });
      });

      it('should treat the where object of associations as a first class citizen', function() {
        var self = this;
        this.Article = this.sequelize.define('Article', {
          'title': DataTypes.STRING
        });
        this.Label = this.sequelize.define('Label', {
          'text': DataTypes.STRING,
          'until': DataTypes.DATE
        });

        this.Article.hasMany(this.Label);

        return this.sequelize.sync({ force: true }).then(function() {
          return Promise.all([
            self.Article.create({ title: 'Article' }),
            self.Label.create({ text: 'Awesomeness', until: '2014-01-01 01:00:00' }),
            self.Label.create({ text: 'Epicness', until: '2014-01-03 01:00:00' })
          ]);
        }).bind({}).spread(function(article, label1, label2) {
          this.article = article;
          return article.setLabels([label1, label2]);
        }).then(function() {
          return this.article.getLabels({where: ['until > ?', moment('2014-01-02').toDate()]});
        }).then(function(labels) {
          expect(labels).to.be.instanceof(Array);
          expect(labels).to.have.length(1);
          expect(labels[0].text).to.equal('Epicness');
        });
      });

      it('gets all associated objects when no options are passed', function() {
        return this.User.find({where: {username: 'John'}}).then(function(john) {
          return john.getTasks();
        }).then(function(tasks) {
          expect(tasks).to.have.length(2);
        });
      });

      it('only get objects that fulfill the options', function() {
        return this.User.find({ where: { username: 'John' } }).then(function(john) {
          return john.getTasks({ where: { active: true }, limit: 10, order: 'id DESC' });
        }).then(function(tasks) {
          expect(tasks).to.have.length(1);
        });
      });
    });

    describe('optimizations using bulk create, destroy and update', function() {
      beforeEach(function() {
        var self = this;
        this.User = this.sequelize.define('User', { username: DataTypes.STRING }, {timestamps: false});
        this.Task = this.sequelize.define('Task', { title: DataTypes.STRING }, {timestamps: false});

        this.User.hasMany(this.Task);

        return this.sequelize.sync({ force: true });
      });

      it('uses one UPDATE statement', function() {
        var self = this
          , spy = sinon.spy();

        return this.User.create({ username: 'foo' }).bind({}).then(function(user) {
          this.user = user;
          return self.Task.create({ title: 'task1' });
        }).then(function(task1) {
          this.task1 = task1;
          return self.Task.create({ title: 'task2' });
        }).then(function(task2) {
          this.task2 = task2;
          return this.user.setTasks([this.task1, this.task2]).on('sql', spy).on('sql', _.after(2, function(sql) {
            // We don't care about SELECT, only UPDATE
            expect(sql).to.have.string('UPDATE');
            expect(sql).to.have.string('IN (1, 2)');
          }));
        }).then(function() {
          expect(spy).to.have.been.calledTwice; // Once for SELECT, once for UPDATE
        });
      });

      it('uses one UPDATE statement', function() {
        var self = this
          , spy = sinon.spy();

        return this.User.create({ username: 'foo' }).bind(this).then(function(user) {
          this.user = user;
          return self.Task.create({ title: 'task1' });
        }).then(function(task1) {
          this.task1 = task1;
          return self.Task.create({ title: 'task2' });
        }).then(function(task2) {
          return this.user.setTasks([this.task1, task2]);
        }).then(function() {
          return this.user.setTasks(null).on('sql', spy).on('sql', _.after(2, function(sql) {
            // We don't care about SELECT, only UPDATE
            expect(sql).to.have.string('UPDATE');
            expect(sql).to.have.string('IN (1, 2)');
          }));
        }).then(function() {
          expect(spy).to.have.been.calledTwice; // Once for SELECT, once for UPDATE
        });
      });
    }); // end optimization using bulk create, destroy and update

    describe('selfAssociations', function() {
      it('should work with alias', function() {
        var Person = this.sequelize.define('Group', {});

        Person.hasMany(Person, { as: 'Children'});

        return this.sequelize.sync();
      });

      it('should work with through', function() {
        var Group = this.sequelize.define('Group', {});

        Group.hasMany(Group, { through: 'groups_outsourcing_companies', as: 'OutsourcingCompanies'});

        return this.sequelize.sync();
      });

      it('should generate the correct composite primary key', function() {
        var User = this.sequelize.define('User', {})
          , Following = this.sequelize.define('Following', {});

        User.hasMany(User, { through: Following, as: 'Follower', foreignKey: 'FollowerId' });
        User.hasMany(User, { through: Following, as: 'Followed', foreignKey: 'FollowedId' });

        expect(Object.keys(Following.primaryKeys)).to.deep.equal(['FollowedId', 'FollowerId']);
      });
    });
  });

  describe('(N:M)', function() {
    describe('getAssociations', function() {
      beforeEach(function() {
        var self = this;

        this.User = this.sequelize.define('User', { username: DataTypes.STRING });
        this.Task = this.sequelize.define('Task', { title: DataTypes.STRING, active: DataTypes.BOOLEAN });

        this.User.hasMany(this.Task);
        this.Task.hasMany(this.User);

        return this.sequelize.sync({ force: true }).then(function() {
          return Promise.all([
            self.User.create({ username: 'John'}),
            self.Task.create({ title: 'Get rich', active: true}),
            self.Task.create({ title: 'Die trying', active: false})
          ]);
        }).spread(function(john, task1, task2) {
          self.tasks = [task1, task2];
          return john.setTasks([task1, task2]);
        });
      });

      it('does not modify the passed arguments', function() {
        return this.User.create({}).bind(this).then(function(user) {
          this.options = {};

          return user.getTasks(this.options);
        }).then(function() {
          expect(this.options).to.deep.equal({});
        });
      });

      if (current.dialect.supports.transactions) {
        it('supports transactions', function() {
          return Support.prepareTransactionTest(this.sequelize).bind({}).then(function(sequelize) {
            this.sequelize = sequelize;
            this.Article = sequelize.define('Article', { 'title': DataTypes.STRING });
            this.Label = sequelize.define('Label', { 'text': DataTypes.STRING });

            this.Article.hasMany(this.Label);
            this.Label.hasMany(this.Article);

            return sequelize.sync({ force: true });
          }).then(function() {
            return Promise.all([
              this.Article.create({ title: 'foo' }),
              this.Label.create({ text: 'bar' }),
              this.sequelize.transaction()
            ]);
          }).spread(function(article, label, t) {
            this.t = t;
            return article.setLabels([label], { transaction: t });
          }).then(function() {
            return this.Article.all({ transaction: this.t });
          }).then(function(articles) {
            return articles[0].getLabels();
          }).then(function(labels) {
            expect(labels).to.have.length(0);
            return this.Article.all({ transaction: this.t });
          }).then(function(articles) {
            return articles[0].getLabels({ transaction: this.t });
          }).then(function(labels) {
            expect(labels).to.have.length(1);
            return this.t.rollback();
          });
        });
      }

      it('gets all associated objects with all fields', function() {
        return this.User.find({where: {username: 'John'}}).then(function(john) {
          return john.getTasks();
        }).then(function(tasks) {
          tasks[0].attributes.forEach(function(attr) {
            expect(tasks[0]).to.have.property(attr);
          });
        });
      });

      it('gets all associated objects when no options are passed', function() {
        return this.User.find({where: {username: 'John'}}).then(function(john) {
          return john.getTasks();
        }).then(function(tasks) {
          expect(tasks).to.have.length(2);
        });
      });

      it('only get objects that fulfill the options', function() {
        return this.User.find({where: {username: 'John'}}).then(function(john) {
          return john.getTasks({where: {active: true}});
        }).then(function(tasks) {
          expect(tasks).to.have.length(1);
        });
      });

      it('supports a where not in', function() {
        return this.User.find({
          where: {
            username: 'John'
          }
        }).then(function(john) {
          return john.getTasks({
            where: {
              title: {
                not: ['Get rich']
              }
            }
          });
        }).then(function(tasks) {
          expect(tasks).to.have.length(1);
        });
      });

      it('supports a where not in on the primary key', function() {
        var self = this;

        return this.User.find({
          where: {
            username: 'John'
          }
        }).then(function(john) {
          return john.getTasks({
            where: {
              id: {
                not: [self.tasks[0].get('id')]
              }
            }
          });
        }).then(function(tasks) {
          expect(tasks).to.have.length(1);
        });
      });

      it('only gets objects that fulfill options with a formatted value', function() {
        return this.User.find({where: {username: 'John'}}).then(function(john) {
          return john.getTasks({where: ['active = ?', true]});
        }).then(function(tasks) {
          expect(tasks).to.have.length(1);
        });
      });

      it('get associated objects with an eager load', function() {
        return this.User.find({where: {username: 'John'}, include: [this.Task]}).then(function(john) {
          expect(john.Tasks).to.have.length(2);
        });
      });

      it('get associated objects with an eager load with conditions but not required', function() {
        var Label = this.sequelize.define('Label', { 'title': DataTypes.STRING, 'isActive': DataTypes.BOOLEAN })
          , Task = this.Task
          , User = this.User;

        Task.hasMany(Label);

        return Label.sync({ force: true }).then(function() {
          return User.find({
            where: { username: 'John'},
            include: [
              { model: Task, required: false, include: [
                { model: Label, required: false, where: { isActive: true } }
              ]}
            ]
          });
        }).then(function(john) {
          expect(john.Tasks).to.have.length(2);
        });
      });

      it('should support schemas', function() {
        var self = this
          , AcmeUser = self.sequelize.define('User', {
            username: DataTypes.STRING
          }).schema('acme', '_')
          , AcmeProject = self.sequelize.define('Project', {
            title: DataTypes.STRING,
            active: DataTypes.BOOLEAN
          }).schema('acme', '_')
          , AcmeProjectUsers = self.sequelize.define('ProjectUsers', {
            status: DataTypes.STRING,
            data: DataTypes.INTEGER
          }).schema('acme', '_');

        AcmeUser.hasMany(AcmeProject, {through: AcmeProjectUsers});
        AcmeProject.hasMany(AcmeUser, {through: AcmeProjectUsers});

        return self.sequelize.dropAllSchemas().then(function() {
          return self.sequelize.createSchema('acme');
        }).then(function() {
          return self.sequelize.sync({force: true});
        }).bind({}).then(function() {
          return AcmeUser.create();
        }).then(function(u) {
          this.u = u;
          return AcmeProject.create();
        }).then(function(p) {
          return this.u.addProject(p, { status: 'active', data: 42 });
        }).then(function() {
          return this.u.getProjects();
        }).then(function(projects) {
          expect(projects).to.have.length(1);
          var project = projects[0];
          expect(project.ProjectUsers).to.be.defined;
          expect(project.status).not.to.exist;
          expect(project.ProjectUsers.status).to.equal('active');
        });
      });
    });

    it('removes the reference id, which was added in the first place', function() {
      var User = this.sequelize.define('User', { username: DataTypes.STRING })
        , Task = this.sequelize.define('Task', { title: DataTypes.STRING });

      User.hasMany(Task);
      expect(Task.attributes.UserId).to.exist;

      Task.hasMany(User);
      expect(Task.attributes.UserId).not.to.exist;
    });

    describe('setAssociations', function() {
      it('clears associations when passing null to the set-method', function() {
        var User = this.sequelize.define('User', { username: DataTypes.STRING })
          , Task = this.sequelize.define('Task', { title: DataTypes.STRING });

        User.hasMany(Task);
        Task.hasMany(User);

        return this.sequelize.sync({ force: true }).then(function() {
          return Promise.all([
            User.create({ username: 'foo' }),
            Task.create({ title: 'task' })
          ]);
        }).bind({}).spread(function(user, task) {
          this.task = task;
          return task.setUsers([user]);
        }).then(function() {
          return this.task.getUsers();
        }).then(function(_users) {
          expect(_users).to.have.length(1);

          return this.task.setUsers(null);
        }).then(function() {
          return this.task.getUsers();
        }).then(function(_users) {
          expect(_users).to.have.length(0);
        });
      });

      it('should be able to set twice with custom primary keys', function() {
        var User = this.sequelize.define('User', { uid: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true }, username: DataTypes.STRING })
          , Task = this.sequelize.define('Task', { tid: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true }, title: DataTypes.STRING });

        User.hasMany(Task);
        Task.hasMany(User);

        return this.sequelize.sync({ force: true }).then(function() {
          return Promise.all([
            User.create({ username: 'foo' }),
            User.create({ username: 'bar' }),
            Task.create({ title: 'task' })
          ]);
        }).bind({}).spread(function(user1, user2, task) {
          this.task = task;
          this.user1 = user1;
          this.user2 = user2;
          return task.setUsers([user1]);
        }).then(function() {
          this.user2.user_has_task = {usertitle: 'Something'};
          return this.task.setUsers([this.user1, this.user2]);
        }).then(function() {
          return this.task.getUsers();
        }).then(function(_users) {
          expect(_users).to.have.length(2);
        });
      });

      it('joins an association with custom primary keys', function() {
        var Group = this.sequelize.define('group', {
            group_id: {type: DataTypes.INTEGER, primaryKey: true},
            name: DataTypes.STRING(64)
          })
          , Member = this.sequelize.define('member', {
            member_id: {type: DataTypes.INTEGER, primaryKey: true},
            email: DataTypes.STRING(64)
          });

        Group.hasMany(Member, {joinTableName: 'group_members', foreignKey: 'group_id'});
        Member.hasMany(Group, {joinTableName: 'group_members', foreignKey: 'member_id'});

        return this.sequelize.sync({ force: true }).then(function() {
          return Promise.all([
            Group.create({group_id: 1, name: 'Group1'}),
            Member.create({member_id: 10, email: 'team@sequelizejs.com'})
          ]);
        }).spread(function(group, member) {
          return group.addMember(member).return (group);
        }).then(function(group) {
          return group.getMembers();
        }).then(function(members) {
          expect(members).to.be.instanceof(Array);
          expect(members).to.have.length(1);
          expect(members[0].member_id).to.equal(10);
          expect(members[0].email).to.equal('team@sequelizejs.com');
        });
      });

      it('supports passing the primary key instead of an object', function() {
        var User = this.sequelize.define('User', { username: DataTypes.STRING })
          , Task = this.sequelize.define('Task', { title: DataTypes.STRING });

        User.hasMany(Task);
        Task.hasMany(User);

        return this.sequelize.sync({ force: true }).then(function() {
          return Promise.all([
            User.create({ id: 12 }),
            Task.create({ id: 50, title: 'get started' }),
            Task.create({ id: 5, title: 'wat' })
          ]);
        }).bind({}).spread(function(user, task1, task2) {
          this.user = user;
          this.task2 = task2;
          return user.addTask(task1.id);
        }).then(function() {
          return this.user.setTasks([this.task2.id]);
        }).then(function() {
          return this.user.getTasks();
        }).then(function(tasks) {
          expect(tasks).to.have.length(1);
          expect(tasks[0].title).to.equal('wat');
        });
      });
    });

    describe('createAssociations', function() {
      it('creates a new associated object', function() {
        var User = this.sequelize.define('User', { username: DataTypes.STRING })
          , Task = this.sequelize.define('Task', { title: DataTypes.STRING });

        User.hasMany(Task);
        Task.hasMany(User);

        return this.sequelize.sync({ force: true }).then(function() {
          return Task.create({ title: 'task' });
        }).bind({}).then(function(task) {
          this.task = task;
          return task.createUser({ username: 'foo' });
        }).then(function(createdUser) {
          expect(createdUser.Model).to.equal(User);
          expect(createdUser.username).to.equal('foo');
          return this.task.getUsers();
        }).then(function(_users) {
          expect(_users).to.have.length(1);
        });
      });

      if (current.dialect.supports.transactions) {
        it('supports transactions', function() {
          return Support.prepareTransactionTest(this.sequelize).bind({}).then(function(sequelize) {
            this.User = sequelize.define('User', { username: DataTypes.STRING });
            this.Task = sequelize.define('Task', { title: DataTypes.STRING });

            this.User.hasMany(this.Task);
            this.Task.hasMany(this.User);

            this.sequelize = sequelize;
            return sequelize.sync({ force: true });
          }).then(function() {
            return Promise.all([
              this.Task.create({ title: 'task' }),
              this.sequelize.transaction()
            ]);
          }).spread(function(task, t) {
            this.task = task;
            this.t = t;
            return task.createUser({ username: 'foo' }, { transaction: t });
          }).then(function() {
            return this.task.getUsers();
          }).then(function(users) {
            expect(users).to.have.length(0);

            return this.task.getUsers({ transaction: this.t });
          }).then(function(users) {
            expect(users).to.have.length(1);
            return this.t.rollback();
          });
        });
      }

      it('supports setting through table attributes', function() {
        var User = this.sequelize.define('user', {})
          , Group = this.sequelize.define('group', {})
          , UserGroups = this.sequelize.define('user_groups', {
            isAdmin: Sequelize.BOOLEAN
          });

        User.hasMany(Group, { through: UserGroups });
        Group.hasMany(User, { through: UserGroups });

        return this.sequelize.sync({ force: true }).then(function() {
          return Group.create({});
        }).then(function(group) {
          return Promise.join(
            group.createUser({ id: 1 }, { isAdmin: true }),
            group.createUser({ id: 2 }, { isAdmin: false }),
            function() {
              return UserGroups.findAll();
            }
          );
        }).then(function(userGroups) {
          userGroups.sort(function(a, b) {
            return a.userId < b.userId ? - 1 : 1;
          });
          expect(userGroups[0].userId).to.equal(1);
          expect(userGroups[0].isAdmin).to.be.ok;
          expect(userGroups[1].userId).to.equal(2);
          expect(userGroups[1].isAdmin).not.to.be.ok;
        });
      });

      it('supports using the field parameter', function() {
        var User = this.sequelize.define('User', { username: DataTypes.STRING })
          , Task = this.sequelize.define('Task', { title: DataTypes.STRING });

        User.hasMany(Task);
        Task.hasMany(User);

        return this.sequelize.sync({ force: true }).then(function() {
          return Task.create({ title: 'task' });
        }).bind({}).then(function(task) {
          this.task = task;
          return task.createUser({ username: 'foo' }, {fields: ['username']});
        }).then(function(createdUser) {
          expect(createdUser.Model).to.equal(User);
          expect(createdUser.username).to.equal('foo');
          return this.task.getUsers();
        }).then(function(_users) {
          expect(_users).to.have.length(1);
        });
      });
    });

    describe('addAssociations', function() {
      it('supports both single instance and array', function() {
        var User = this.sequelize.define('User', { username: DataTypes.STRING })
          , Task = this.sequelize.define('Task', { title: DataTypes.STRING });

        User.hasMany(Task);
        Task.hasMany(User);

        return this.sequelize.sync({ force: true }).then(function() {
          return Promise.all([
            User.create({ id: 12 }),
            Task.create({ id: 50, title: 'get started' }),
            Task.create({ id: 52, title: 'get done' })
          ]);
        }).spread(function(user, task1, task2) {
          return Promise.all([
            user.addTask(task1),
            user.addTask([task2])
          ]).return (user);
        }).then(function(user) {
          return user.getTasks();
        }).then(function(tasks) {
          expect(tasks).to.have.length(2);
          expect(_.find(tasks, function(item) { return item.title === 'get started'; })).to.be.ok;
          expect(_.find(tasks, function(item) { return item.title === 'get done'; })).to.be.ok;
        });
      });

      if (current.dialect.supports.transactions) {
        it('supports transactions', function() {
          return Support.prepareTransactionTest(this.sequelize).bind({}).then(function(sequelize) {
            this.User = sequelize.define('User', { username: DataTypes.STRING });
            this.Task = sequelize.define('Task', { title: DataTypes.STRING });

            this.User.hasMany(this.Task);
            this.Task.hasMany(this.User);

            this.sequelize = sequelize;
            return sequelize.sync({ force: true });
          }).then(function() {
            return Promise.all([
              this.User.create({ username: 'foo' }),
              this.Task.create({ title: 'task' }),
              this.sequelize.transaction()
            ]);
          }).spread(function(user, task, t) {
            this.task = task;
            this.user = user;
            this.t = t;
            return task.addUser(user, { transaction: t });
          }).then(function() {
            return this.task.hasUser(this.user);
          }).then(function(hasUser) {
            expect(hasUser).to.be.false;
            return this.task.hasUser(this.user, { transaction: this.t });
          }).then(function(hasUser) {
            expect(hasUser).to.be.true;
            return this.t.rollback();
          });
        });

        it('supports transactions when updating a through model', function() {
          return Support.prepareTransactionTest(this.sequelize).bind({}).then(function(sequelize) {
            this.User = sequelize.define('User', { username: DataTypes.STRING });
            this.Task = sequelize.define('Task', { title: DataTypes.STRING });

            this.UserTask = sequelize.define('UserTask', {
              status: Sequelize.STRING
            });

            this.User.hasMany(this.Task, { through: this.UserTask });
            this.Task.hasMany(this.User, { through: this.UserTask });
            this.sequelize = sequelize;
            return sequelize.sync({ force: true });
          }).then(function() {
            return Promise.all([
              this.User.create({ username: 'foo' }),
              this.Task.create({ title: 'task' }),
              this.sequelize.transaction({ isolationLevel: Sequelize.Transaction.ISOLATION_LEVELS.READ_COMMITTED })
            ]);
          }).spread(function(user, task, t) {
            this.task = task;
            this.user = user;
            this.t = t;
            return task.addUser(user, { status: 'pending' }); // Create without transaction, so the old value is accesible from outside the transaction
          }).then(function() {
            return this.task.addUser(this.user, { transaction: this.t, status: 'completed' }); // Add an already exisiting user in a transaction, updating a value in the join table
          }).then(function(hasUser) {
            return Promise.all([
              this.user.getTasks(),
              this.user.getTasks({ transaction: this.t })
            ]);
          }).spread(function(tasks, transactionTasks) {
            expect(tasks[0].UserTask.status).to.equal('pending');
            expect(transactionTasks[0].UserTask.status).to.equal('completed');

            return this.t.rollback();
          });
        });
      }

      it('supports passing the primary key instead of an object', function() {
        var User = this.sequelize.define('User', { username: DataTypes.STRING })
          , Task = this.sequelize.define('Task', { title: DataTypes.STRING });

        User.hasMany(Task);
        Task.hasMany(User);

        return this.sequelize.sync({ force: true }).then(function() {
          return Promise.all([
            User.create({ id: 12 }),
            Task.create({ id: 50, title: 'get started' })
          ]);
        }).spread(function(user, task) {
          return user.addTask(task.id).return (user);
        }).then(function(user) {
          return user.getTasks();
        }).then(function(tasks) {
          expect(tasks[0].title).to.equal('get started');
        });
      });


      it('should not pass indexes to the join table', function() {
        var User = this.sequelize.define(
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
        var Task = this.sequelize.define(
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
        User.hasMany(Task);
        Task.hasMany(User);
        return this.sequelize.sync({ force: true });
      });
    });

    describe('addMultipleAssociations', function() {
      it('supports both single instance and array', function() {
        var User = this.sequelize.define('User', { username: DataTypes.STRING })
          , Task = this.sequelize.define('Task', { title: DataTypes.STRING });

        User.hasMany(Task);
        Task.hasMany(User);

        return this.sequelize.sync({ force: true }).then(function() {
          return Promise.all([
            User.create({ id: 12 }),
            Task.create({ id: 50, title: 'get started' }),
            Task.create({ id: 52, title: 'get done' })
          ]);
        }).spread(function(user, task1, task2) {
          return Promise.all([
            user.addTasks(task1),
            user.addTasks([task2])
          ]).return (user);
        }).then(function(user) {
          return user.getTasks();
        }).then(function(tasks) {
          expect(tasks).to.have.length(2);
          expect(_.find(tasks, function(item) { return item.title === 'get started'; })).to.be.ok;
          expect(_.find(tasks, function(item) { return item.title === 'get done'; })).to.be.ok;
        });
      });

      it('adds associations without removing the current ones', function() {
        var User = this.sequelize.define('User', { username: DataTypes.STRING })
          , Task = this.sequelize.define('Task', { title: DataTypes.STRING });

        User.hasMany(Task);
        Task.hasMany(User);

        return this.sequelize.sync({ force: true }).then(function() {
          return User.bulkCreate([
            { username: 'foo '},
            { username: 'bar '},
            { username: 'baz '}
          ]).bind({}).then(function() {
            return Promise.all([
              Task.create({ title: 'task' }),
              User.findAll()
            ]);
          }).spread(function(task, users) {
            this.task = task;
            this.users = users;
            return task.setUsers([users[0]]);
          }).then(function() {
            return this.task.addUsers([this.users[1], this.users[2]]);
          }).then(function() {
            return this.task.getUsers();
          }).then(function(users) {
            expect(users).to.have.length(3);
          });
        });
      });
    });

    describe('optimizations using bulk create, destroy and update', function() {
      beforeEach(function() {
        this.User = this.sequelize.define('User', { username: DataTypes.STRING }, {timestamps: false});
        this.Task = this.sequelize.define('Task', { title: DataTypes.STRING }, {timestamps: false});

        this.User.hasMany(this.Task);
        this.Task.hasMany(this.User);

        return this.sequelize.sync({force: true});
      });

      it('uses one insert into statement', function() {
        var self = this
          , spy = sinon.spy();

        return Promise.all([
          this.User.create({ username: 'foo' }),
          this.Task.create({ id: 12, title: 'task1' }),
          this.Task.create({ id: 15, title: 'task2' })
        ]).spread(function(user, task1, task2) {
          return user.setTasks([task1, task2]).on('sql', spy).on('sql', _.after(2, function(sql) {
            if (dialect === 'mssql') {
              expect(sql).to.have.string('INSERT INTO [TasksUsers] ([TaskId],[UserId]) VALUES (12,1),(15,1)');
            } else {
              var tickChar = (Support.getTestDialect() === 'postgres') ? '"' : '`';
              expect(sql).to.have.string('INSERT INTO %TasksUsers% (%TaskId%,%UserId%) VALUES (12,1),(15,1)'.replace(/%/g, tickChar));
            }
          }));
        }).then(function() {
          expect(spy.calledTwice).to.be.ok; // Once for SELECT, once for INSERT
        });
      });

      it('uses one delete from statement', function() {
        var self = this
          , spy = sinon.spy();

        return Promise.all([
          this.User.create({ username: 'foo' }),
          this.Task.create({ title: 'task1' }),
          this.Task.create({ title: 'task2' })
        ]).spread(function(user, task1, task2) {
          return user.setTasks([task1, task2]).return (user);
        }).then(function(user) {
          return user.setTasks(null).on('sql', spy).on('sql', _.after(2, function(sql) {
            expect(sql).to.have.string('DELETE FROM');
            expect(sql).to.match(/IN \(1, 2\)|IN \(2, 1\)/);
          }));
        }).then(function() {
          expect(spy.calledTwice).to.be.ok; // Once for SELECT, once for DELETE
        });
      });
    }); // end optimization using bulk create, destroy and update

    describe('join table creation', function() {
      beforeEach(function() {
        this.User = this.sequelize.define('User',
          { username: DataTypes.STRING },
          { tableName: 'users'}
        );
        this.Task = this.sequelize.define('Task',
          { title: DataTypes.STRING },
          { tableName: 'tasks' }
        );

        this.User.hasMany(this.Task, { joinTableName: 'user_has_tasks' });
        this.Task.hasMany(this.User, { joinTableName: 'user_has_tasks' });

        return this.sequelize.sync({ force: true });
      });

      it('should work with non integer primary keys', function() {
        var Beacons = this.sequelize.define('Beacon', {
          id: {
            primaryKey: true,
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4
          },
          name: {
            type: DataTypes.STRING
          }
        });

        // Usar not to clash with the beforEach definition
        var Users = this.sequelize.define('Usar', {
          name: {
            type: DataTypes.STRING
          }
        });

        Beacons.hasMany(Users);
        Users.hasMany(Beacons);

        return this.sequelize.sync({force: true});
      });

      it('uses the specified joinTableName or a reasonable default', function() {
        for (var associationName in this.User.associations) {
          expect(associationName).not.to.equal(this.User.tableName);
          expect(associationName).not.to.equal(this.Task.tableName);

          var through = this.User.associations[associationName].through.model;
          if (typeof through !== 'undefined') {
            expect(through.tableName).to.equal(associationName);
          }
          var tableName = this.User.associations[associationName].options.tableName;
          if (typeof tableName !== 'undefined') {
            expect(tableName).to.equal(associationName);
          }
        }
      });

      it('makes join table non-paranoid by default', function() {
        var paranoidSequelize = Support.createSequelizeInstance({
            define: {
              paranoid: true
            }
          })
          , ParanoidUser = paranoidSequelize.define('ParanoidUser', {})
          , ParanoidTask = paranoidSequelize.define('ParanoidTask', {});

        ParanoidUser.hasMany(ParanoidTask);
        ParanoidTask.hasMany(ParanoidUser);

        expect(ParanoidUser.options.paranoid).to.be.ok;
        expect(ParanoidTask.options.paranoid).to.be.ok;

        _.forEach(ParanoidUser.associations, function(association) {
          expect(association.through.model.options.paranoid).not.to.be.ok;
        });
      });
    });

    describe('foreign keys', function() {
      it('should correctly generate underscored keys', function() {
        var User = this.sequelize.define('User', {

        }, {
          tableName: 'users',
          underscored: true,
          timestamps: false
        });

        var Place = this.sequelize.define('Place', {
          //fields
        },{
          tableName: 'places',
          underscored: true,
          timestamps: false
        });

        User.hasMany(Place, { joinTableName: 'user_places' });
        Place.hasMany(User, { joinTableName: 'user_places' });

        var attributes = this.sequelize.model('user_places').rawAttributes;

        expect(attributes.place_id).to.be.ok;
        expect(attributes.user_id).to.be.ok;
      });
    });

    describe('foreign key with fields specified', function() {
      beforeEach(function() {
        this.User = this.sequelize.define('User', { name: DataTypes.STRING });
        this.Project = this.sequelize.define('Project', { name: DataTypes.STRING });
        this.Puppy = this.sequelize.define('Puppy', { breed: DataTypes.STRING });

        // doubly linked has many
        this.User.hasMany(this.Project, {
          through: 'user_projects',
          as: 'Projects',
          foreignKey: {
            field: 'user_id',
            name: 'userId'
          }
        });
        this.Project.hasMany(this.User, {
          through: 'user_projects',
          as: 'Users',
          foreignKey: {
            field: 'project_id',
            name: 'projectId'
          }
        });

        // singly linked has many
        this.User.hasMany(this.Puppy, {
          as: 'Puppies',
          foreignKey: {
            field: 'user_id',
            name: 'userId'
          }
        });
        this.Puppy.belongsTo(this.User, {
          foreignKey: {
            field: 'user_id',
            name: 'userId'
          }
        });
      });

      it('should correctly get associations even after a child instance is deleted', function() {
        var self = this
          , user
          , projects;

        return this.sequelize.sync({force: true}).then(function() {
          return Promise.join(
            self.User.create({name: 'Matt'}),
            self.Project.create({name: 'Good Will Hunting'}),
            self.Project.create({name: 'The Departed'})
          );
        }).spread(function(user, project1, project2) {
          return user.addProjects([project1, project2]).return (user);
        }).then(function(user) {
          return Promise.join(
            user,
            user.getProjects()
          );
        }).spread(function(user, projects) {
          var project = projects[0];
          expect(project).to.be.defined;
          return project.destroy().return (user);
        }).then(function(user) {
          return self.User.find({
            where: { id: user.id},
            include: [{model: self.Project, as: 'Projects'}]
          });
        }).then(function(user) {
          var projects = user.Projects
            , project = projects[0];

          expect(project).to.be.defined;
        });
      });

      it('should correctly get associations when doubly linked', function() {
        var self = this;
        return this.sequelize.sync({force: true}).then(function() {
          return Promise.all([
            self.User.create({name: 'Matt'}),
            self.Project.create({name: 'Good Will Hunting'})
          ]);
        }).spread(function(user, project) {
          self.user = user;
          self.project = project;
          return user.addProject(project).return (user);
        }).then(function(user) {
          return user.getProjects();
        }).then(function(projects) {
          var project = projects[0];

          expect(project).to.be.defined;
          return self.user.removeProject(project).on('sql', function(sql) {
          }).return (project);
        }).then(function(project) {
          return self.user.setProjects([project]);
        });
      });

      it('should correctly get associations when singly linked', function() {
        var self = this;
        return this.sequelize.sync({force: true}).then(function() {
          return Promise.all([
            self.User.create({name: 'Matt'}),
            self.Puppy.create({breed: 'Terrier'})
          ]);
        }).spread(function(user, puppy) {
          return user.addPuppy(puppy).return (user);
        }).then(function(user) {
          return user.getPuppies().then(function(puppies) {
            var puppy = puppies[0];

            expect(puppy).to.be.defined;
            expect(puppy.rawAttributes.userId).to.be.ok;
            expect(puppy.userId).to.equal(user.id);
          });
        });
      });

      it('should be able to handle nested includes properly', function() {
        var self = this;
        this.Group = this.sequelize.define('Group', { groupName: DataTypes.STRING});

        this.Group.hasMany(this.User, {
          through: 'group_users',
          as: 'Users',
          foreignKey: {
            field: 'group_id',
            name: 'groupId'
          }
        });
        this.User.hasMany(this.Group, {
          through: 'group_users',
          as: 'Groups',
          foreignKey: {
            field: 'user_id',
            name: 'userId'
          }
        });

        return this.sequelize.sync({force: true}).then(function() {
          return Promise.join(
            self.Group.create({groupName: 'The Illuminati'}),
            self.User.create({name: 'Matt'}),
            self.Project.create({name: 'Good Will Hunting'})
          );
        }).spread(function(group, user, project) {
          return user.addProject(project).then(function() {
            return group.addUser(user).return (group);
          });
        }).then(function(group) {
          // get the group and include both the users in the group and their project's
          return self.Group.findAll({
            where: {id: group.id},
            include: [
              {
                model: self.User,
                as: 'Users',
                include: [
                  { model: self.Project, as: 'Projects' }
                ]
              }
            ]
          });
        }).then(function(groups) {
          var group = groups[0];
          expect(group).to.be.defined;

          var user = group.Users[0];
          expect(user).to.be.defined;

          var project = user.Projects[0];
          expect(project).to.be.defined;
          expect(project.name).to.equal('Good Will Hunting');
        });
      });
    });


    describe('primary key handling for join table', function() {
      beforeEach(function() {
        this.User = this.sequelize.define('User',
          { username: DataTypes.STRING },
          { tableName: 'users'}
        );
        this.Task = this.sequelize.define('Task',
          { title: DataTypes.STRING },
          { tableName: 'tasks' }
        );
      });

      it('removes the primary key if it was added by sequelize', function() {
        this.UserTasks = this.sequelize.define('usertasks', {});

        this.User.hasMany(this.Task, { through: this.UserTasks });
        this.Task.hasMany(this.User, { through: this.UserTasks });

        expect(Object.keys(this.UserTasks.primaryKeys)).to.deep.equal(['TaskId', 'UserId']);
      });

      it('keeps the primary key if it was added by the user', function() {
        var fk;

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

        this.User.hasMany(this.Task, { through: this.UserTasks });
        this.Task.hasMany(this.User, { through: this.UserTasks });

        this.User.hasMany(this.Task, { through: this.UserTasks2 });
        this.Task.hasMany(this.User, { through: this.UserTasks2 });

        expect(Object.keys(this.UserTasks.primaryKeys)).to.deep.equal(['id']);
        expect(Object.keys(this.UserTasks2.primaryKeys)).to.deep.equal(['userTasksId']);

        _.each([this.UserTasks, this.UserTasks2], function(model) {
          fk = Object.keys(model.options.uniqueKeys)[0];
          expect(model.options.uniqueKeys[fk].fields.sort()).to.deep.equal(['TaskId', 'UserId']);
        });
      });

      describe('without sync', function() {
        beforeEach(function() {
          var self = this;

          return self.sequelize.queryInterface.createTable('users', { id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true } , username: DataTypes.STRING, createdAt: DataTypes.DATE, updatedAt: DataTypes.DATE }).then(function() {
            return self.sequelize.queryInterface.createTable('tasks', { id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true }, title: DataTypes.STRING, createdAt: DataTypes.DATE, updatedAt: DataTypes.DATE });
          }).then(function() {
            return self.sequelize.queryInterface.createTable('users_tasks', { TaskId: DataTypes.INTEGER, UserId: DataTypes.INTEGER, createdAt: DataTypes.DATE, updatedAt: DataTypes.DATE });
          });
        });

        it('removes all associations', function() {
          this.UsersTasks = this.sequelize.define('UsersTasks', {}, { tableName: 'users_tasks' });

          this.User.hasMany(this.Task, { through: this.UsersTasks });
          this.Task.hasMany(this.User, { through: this.UsersTasks });

          expect(Object.keys(this.UsersTasks.primaryKeys)).to.deep.equal(['TaskId', 'UserId']);

          return Promise.all([
            this.User.create({username: 'foo'}),
            this.Task.create({title: 'foo'})
          ]).spread(function(user, task) {
            return user.addTask(task).return (user);
          }).then(function(user) {
            return user.setTasks(null);
          }).then(function(result) {
            expect(result).to.be.ok;
          });
        });
      });
    });

    describe('through', function() {
      beforeEach(function() {
        this.User = this.sequelize.define('User', {});
        this.Project = this.sequelize.define('Project', {});
        this.UserProjects = this.sequelize.define('UserProjects', {
          status: DataTypes.STRING,
          data: DataTypes.INTEGER
        });

        this.User.hasMany(this.Project, { joinTableModel: this.UserProjects });
        this.Project.hasMany(this.User, { joinTableModel: this.UserProjects });

        return this.sequelize.sync();
      });

      describe('fetching from join table', function() {
        it('should contain the data from the join table on .UserProjects a DAO', function() {
          return Promise.all([
            this.User.create(),
            this.Project.create()
          ]).spread(function(user, project) {
            return user.addProject(project, { status: 'active', data: 42 }).return (user);
          }).then(function(user) {
            return user.getProjects();
          }).then(function(projects) {
            var project = projects[0];

            expect(project.UserProjects).to.be.defined;
            expect(project.status).not.to.exist;
            expect(project.UserProjects.status).to.equal('active');
            expect(project.UserProjects.data).to.equal(42);
          });
        });

        it('should be able to limit the join table attributes returned', function() {
          return Promise.all([
            this.User.create(),
            this.Project.create()
          ]).spread(function(user, project) {
            return user.addProject(project, { status: 'active', data: 42 }).return (user);
          }).then(function(user) {
            return user.getProjects({ joinTableAttributes: ['status']});
          }).then(function(projects) {
            var project = projects[0];

            expect(project.UserProjects).to.be.defined;
            expect(project.status).not.to.exist;
            expect(project.UserProjects.status).to.equal('active');
            expect(project.UserProjects.data).not.to.exist;
          });
        });
      });

      describe('inserting in join table', function() {
        describe('add', function() {
          it('should insert data provided on the object into the join table', function() {
            return Promise.all([
              this.User.create(),
              this.Project.create()
            ]).bind({ UserProjects: this.UserProjects }).spread(function(u, p) {
              this.u = u;
              this.p = p;
              p.UserProjects = { status: 'active' };

              return u.addProject(p);
            }).then(function() {
              return this.UserProjects.find({ where: { UserId: this.u.id, ProjectId: this.p.id }});
            }).then(function(up) {
              expect(up.status).to.equal('active');
            });
          });

          it('should insert data provided as a second argument into the join table', function() {
            return Promise.all([
              this.User.create(),
              this.Project.create()
            ]).bind({ UserProjects: this.UserProjects }).spread(function(u, p) {
              this.u = u;
              this.p = p;

              return u.addProject(p, { status: 'active' });
            }).then(function() {
              return this.UserProjects.find({ where: { UserId: this.u.id, ProjectId: this.p.id }});
            }).then(function(up) {
              expect(up.status).to.equal('active');
            });
          });

          it('should be able to add twice (second call result in UPDATE call) without any attributes (and timestamps off) on the through model', function() {
            var Worker = this.sequelize.define('Worker', {}, {timestamps: false})
              , Task = this.sequelize.define('Task', {}, {timestamps: false})
              , WorkerTasks = this.sequelize.define('WorkerTasks', {}, {timestamps: false});

            Worker.hasMany(Task, { through: WorkerTasks });
            Task.hasMany(Worker, { through: WorkerTasks });

            return this.sequelize.sync().bind({}).then(function() {
              return Worker.create({id: 1337});
            }).then(function(worker) {
              this.worker = worker;
              return Task.create({id: 7331});
            }).then(function(task) {
              return this.worker.addTask(this.task);
            }).then(function() {
              return this.worker.addTask(this.task);
            });
          });

          it('should be able to add twice (second call result in UPDATE call) with custom primary keys and without any attributes (and timestamps off) on the through model', function() {
            var Worker = this.sequelize.define('Worker', {
                id: {
                  type: DataTypes.INTEGER,
                  allowNull: false,
                  primaryKey: true,
                  autoIncrement: true
                }
              }, {timestamps: false})
              , Task = this.sequelize.define('Task', {
                id: {
                  type: DataTypes.INTEGER,
                  allowNull: false,
                  primaryKey: true,
                  autoIncrement: true
                }
              }, {timestamps: false})
              , WorkerTasks = this.sequelize.define('WorkerTasks', {
                id: {
                  type: DataTypes.INTEGER,
                  allowNull: false,
                  primaryKey: true,
                  autoIncrement: true
                }
              }, {timestamps: false});

            Worker.hasMany(Task, { through: WorkerTasks });
            Task.hasMany(Worker, { through: WorkerTasks });

            return this.sequelize.sync().bind({}).then(function() {
              return Worker.create({id: 1337});
            }).then(function(worker) {
              this.worker = worker;
              return Task.create({id: 7331});
            }).then(function(task) {
              this.task = task;
              return this.worker.addTask(this.task);
            }).then(function() {
              return this.worker.addTask(this.task);
            });
          });
        });

        describe('set', function() {
          it('should be able to combine properties on the associated objects, and default values', function() {
            var self = this;

            return Promise.all([
              this.User.create(),
              this.Project.bulkCreate([{}, {}]).then(function() {
                return self.Project.findAll();
              })
            ]).bind({}).spread(function(user, projects) {
              this.user = user;
              this.p1 = projects[0];
              this.p2 = projects[1];

              this.p1.UserProjects = { status: 'inactive' };

              return user.setProjects([this.p1, this.p2], { status: 'active' });
            }).then(function() {
              return Promise.all([
                self.UserProjects.find({ where: { UserId: this.user.id, ProjectId: this.p1.id }}),
                self.UserProjects.find({ where: { UserId: this.user.id, ProjectId: this.p2.id }})
              ]);
            }).spread(function(up1, up2) {
              expect(up1.status).to.equal('inactive');
              expect(up2.status).to.equal('active');
            });
          });

          it('should be able to set twice (second call result in UPDATE calls) without any attributes (and timestamps off) on the through model', function() {
            var Worker = this.sequelize.define('Worker', {}, {timestamps: false})
              , Task = this.sequelize.define('Task', {}, {timestamps: false})
              , WorkerTasks = this.sequelize.define('WorkerTasks', {}, {timestamps: false});

            Worker.hasMany(Task, { through: WorkerTasks });
            Task.hasMany(Worker, { through: WorkerTasks });

            return this.sequelize.sync().then(function() {
              return Promise.all([
                Worker.create(),
                Task.bulkCreate([{}, {}]).then(function() {
                  return Task.findAll();
                })
              ]);
            }).spread(function(worker, tasks) {
              return worker.setTasks(tasks).return ([worker, tasks]);
            }).spread(function(worker, tasks) {
              return worker.setTasks(tasks);
            });
          });
        });
      });

      describe('removing from the join table', function() {
        it('should remove a single entry without any attributes (and timestamps off) on the through model', function() {
          var Worker = this.sequelize.define('Worker', {}, {timestamps: false})
            , Task = this.sequelize.define('Task', {}, {timestamps: false})
            , WorkerTasks = this.sequelize.define('WorkerTasks', {}, {timestamps: false});

          Worker.hasMany(Task, { through: WorkerTasks });
          Task.hasMany(Worker, { through: WorkerTasks });

          // Test setup
          return this.sequelize.sync().then(function() {
            return Sequelize.Promise.all([
              Worker.create({}),
              Task.bulkCreate([{}, {}, {}]).then(function() {
                return Task.findAll();
              })
            ]);
          }).spread(function(worker, tasks) {
            // Set all tasks, then remove one task by instance, then remove one task by id, then return all tasks
            return worker.setTasks(tasks).then(function() {
              return worker.removeTask(tasks[0]);
            }).then(function() {
              return worker.removeTask(tasks[1].id);
            }).then(function() {
              return worker.getTasks();
            });
          }).then(function(tasks) {
            expect(tasks.length).to.equal(1);
          });
        });

        it('should remove multiple entries without any attributes (and timestamps off) on the through model', function() {
          var Worker = this.sequelize.define('Worker', {}, {timestamps: false})
            , Task = this.sequelize.define('Task', {}, {timestamps: false})
            , WorkerTasks = this.sequelize.define('WorkerTasks', {}, {timestamps: false});

          Worker.hasMany(Task, { through: WorkerTasks });
          Task.hasMany(Worker, { through: WorkerTasks });

          // Test setup
          return this.sequelize.sync().then(function() {
            return Sequelize.Promise.all([
              Worker.create({}),
              Task.bulkCreate([{}, {}, {}, {}, {}]).then(function() {
                return Task.findAll();
              })
            ]);
          }).spread(function(worker, tasks) {
            // Set all tasks, then remove two tasks by instance, then remove two tasks by id, then return all tasks
            return worker.setTasks(tasks).then(function() {
              return worker.removeTasks([tasks[0], tasks[1]]);
            }).then(function() {
              return worker.removeTasks([tasks[2].id, tasks[3].id]);
            }).then(function() {
              return worker.getTasks();
            });
          }).then(function(tasks) {
            expect(tasks.length).to.equal(1);
          });
        });
      });
    });

    describe('belongsTo and hasMany at once', function() {
      beforeEach(function() {
        this.A = this.sequelize.define('a', { name: Sequelize.STRING });
        this.B = this.sequelize.define('b', { name: Sequelize.STRING });
      });

      describe('source belongs to target', function() {
        beforeEach(function() {
          this.A.belongsTo(this.B, { as: 'relation1' });
          this.A.hasMany(this.B, { as: 'relation2' });
          this.B.hasMany(this.A, { as: 'relation2' });

          return this.sequelize.sync({ force: true });
        });

        it('correctly uses bId in A', function() {
          var self = this;

          var a1 = this.A.build({ name: 'a1' })
            , b1 = this.B.build({ name: 'b1' });

          return a1
            .save()
            .then(function() { return b1.save(); })
            .then(function() { return a1.setRelation1(b1); })
            .then(function() { return self.A.find({ where: { name: 'a1' } }); })
            .then(function(a) {
              expect(a.relation1Id).to.be.eq(b1.id);
            });
        });
      });

      describe('target belongs to source', function() {
        beforeEach(function() {
          this.B.belongsTo(this.A, { as: 'relation1' });
          this.A.hasMany(this.B, { as: 'relation2' });
          this.B.hasMany(this.A, { as: 'relation2' });

          return this.sequelize.sync({ force: true });
        });

        it('correctly uses bId in A', function() {
          var self = this;

          var a1 = this.A.build({ name: 'a1' })
            , b1 = this.B.build({ name: 'b1' });

          return a1
            .save()
            .then(function() { return b1.save(); })
            .then(function() { return b1.setRelation1(a1); })
            .then(function() { return self.B.find({ where: { name: 'b1' } }); })
            .then(function(b) {
              expect(b.relation1Id).to.be.eq(a1.id);
            });
        });
      });
    });

    describe('alias', function() {
      it('creates the join table when through is a string', function() {
        var self = this
          , User = this.sequelize.define('User', {})
          , Group = this.sequelize.define('Group', {});

        User.hasMany(Group, { as: 'MyGroups', through: 'group_user'});
        Group.hasMany(User, { as: 'MyUsers', through: 'group_user'});

        return this.sequelize.sync({force: true}).then(function() {
          return self.sequelize.getQueryInterface().showAllTables();
        }).then(function(result) {
          if (dialect === 'mssql' /* current.dialect.supports.schemas */) {
            result = _.pluck(result, 'tableName');
          }

          expect(result.indexOf('group_user')).not.to.equal(-1);
        });
      });

      it('creates the join table when through is a model', function() {
        var self = this
          , User = this.sequelize.define('User', {})
          , Group = this.sequelize.define('Group', {})
          , UserGroup = this.sequelize.define('GroupUser', {}, {tableName: 'user_groups'});

        User.hasMany(Group, { as: 'MyGroups', through: UserGroup});
        Group.hasMany(User, { as: 'MyUsers', through: UserGroup});

        return this.sequelize.sync({force: true}).then(function() {
          return self.sequelize.getQueryInterface().showAllTables();
        }).then(function(result) {
          if (dialect === 'mssql' /* current.dialect.supports.schemas */) {
            result = _.pluck(result, 'tableName');
          }

          expect(result.indexOf('user_groups')).not.to.equal(-1);
        });
      });

      it('correctly identifies its counterpart when through is a string', function() {
        var User = this.sequelize.define('User', {})
          , Group = this.sequelize.define('Group', {});

        User.hasMany(Group, { as: 'MyGroups', through: 'group_user'});
        Group.hasMany(User, { as: 'MyUsers', through: 'group_user'});

        expect(Group.associations.MyUsers.through.model === User.associations.MyGroups.through.model);
        expect(Group.associations.MyUsers.through.model.rawAttributes.UserId).to.exist;
        expect(Group.associations.MyUsers.through.model.rawAttributes.GroupId).to.exist;
      });

      it('correctly identifies its counterpart when through is a model', function() {
        var User = this.sequelize.define('User', {})
          , Group = this.sequelize.define('Group', {})
          , UserGroup = this.sequelize.define('GroupUser', {}, {tableName: 'user_groups'});

        User.hasMany(Group, { as: 'MyGroups', through: UserGroup});
        Group.hasMany(User, { as: 'MyUsers', through: UserGroup});

        expect(Group.associations.MyUsers.through.model === User.associations.MyGroups.through.model);

        expect(Group.associations.MyUsers.through.model.rawAttributes.UserId).to.exist;
        expect(Group.associations.MyUsers.through.model.rawAttributes.GroupId).to.exist;
      });
    });

    describe('multiple hasMany', function() {
      beforeEach(function() {
        this.User = this.sequelize.define('user', { name: Sequelize.STRING });
        this.Project = this.sequelize.define('project', { projectName: Sequelize.STRING });
      });

      describe('project has owners and users and owners and users have projects', function() {
        beforeEach(function() {
          this.Project.hasMany(this.User, { as: 'owners', through: 'projectOwners'});
          this.Project.hasMany(this.User, { as: 'users', through: 'projectUsers'});

          this.User.hasMany(this.Project, { as: 'ownedProjects', through: 'projectOwners'});
          this.User.hasMany(this.Project, { as: 'memberProjects', through: 'projectUsers'});

          return this.sequelize.sync({ force: true });
        });

        it('correctly pairs associations', function() {
          expect(this.Project.associations.owners.targetAssociation).to.equal(this.User.associations.ownedProjects);
          expect(this.Project.associations.users.targetAssociation).to.equal(this.User.associations.memberProjects);
        });

        it('correctly sets user and owner', function() {
          var self = this;

          var p1 = this.Project.build({ projectName: 'p1' })
            , u1 = this.User.build({ name: 'u1' })
            , u2 = this.User.build({ name: 'u2' });

          return p1
            .save()
            .then(function() { return u1.save(); })
            .then(function() { return u2.save(); })
            .then(function() { return p1.setUsers([u1]); })
            .then(function() { return p1.setOwners([u2]); });
        });
      });
    });

  });

  describe('Foreign key constraints', function() {
    describe('1:m', function() {
      it('sets null by default', function() {
        var Task = this.sequelize.define('Task', { title: DataTypes.STRING })
          , User = this.sequelize.define('User', { username: DataTypes.STRING });

        User.hasMany(Task);

        return this.sequelize.sync({ force: true }).then(function() {
          return Promise.all([
            User.create({ username: 'foo' }),
            Task.create({ title: 'task' })
          ]);
        }).spread(function(user, task) {
          return user.setTasks([task]).then(function() {
            return user.destroy().then(function() {
              return task.reload();
            });
          });
        }).then(function(task) {
          expect(task.UserId).to.equal(null);
        });
      });

      it('should be possible to remove all constraints', function() {
        var Task = this.sequelize.define('Task', { title: DataTypes.STRING })
          , User = this.sequelize.define('User', { username: DataTypes.STRING });

        User.hasMany(Task, { constraints: false });

        return this.sequelize.sync({ force: true }).bind({}).then(function() {
          return Promise.all([
            User.create({ username: 'foo' }),
            Task.create({ title: 'task' })
          ]);
        }).spread(function(user, task) {
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
        var Task = this.sequelize.define('Task', { title: DataTypes.STRING })
          , User = this.sequelize.define('User', { username: DataTypes.STRING });

        User.hasMany(Task, {onDelete: 'cascade'});

        return this.sequelize.sync({ force: true }).bind({}).then(function() {
          return Promise.all([
            User.create({ username: 'foo' }),
            Task.create({ title: 'task' })
          ]);
        }).spread(function(user, task) {
          this.user = user;
          this.task = task;
          return user.setTasks([task]);
        }).then(function() {
          return this.user.destroy();
        }).then(function() {
          return Task.findAll();
        }).then(function(tasks) {
          expect(tasks).to.have.length(0);
        });
      });

      // NOTE: mssql does not support changing an autoincrement primary key
      if (dialect !== 'mssql') {
        it('can cascade updates', function() {
          var Task = this.sequelize.define('Task', { title: DataTypes.STRING })
            , User = this.sequelize.define('User', { username: DataTypes.STRING });

          User.hasMany(Task, {onUpdate: 'cascade'});

          return this.sequelize.sync({ force: true }).then(function() {
            return Promise.all([
              User.create({ username: 'foo' }),
              Task.create({ title: 'task' })
            ]);
          }).spread(function(user, task) {
            return user.setTasks([task]).return (user);
          }).then(function(user) {
            // Changing the id of a DAO requires a little dance since
            // the `UPDATE` query generated by `save()` uses `id` in the
            // `WHERE` clause

            var tableName = user.QueryInterface.QueryGenerator.addSchema(user.Model);
            return user.QueryInterface.update(user, tableName, {id: 999}, user.id);
          }).then(function() {
            return Task.findAll();
          }).then(function(tasks) {
            expect(tasks).to.have.length(1);
            expect(tasks[0].UserId).to.equal(999);
          });
        });
      }

      if (current.dialect.supports.constraints.restrict) {
        it('can restrict deletes', function() {
          var self = this;
          var Task = this.sequelize.define('Task', { title: DataTypes.STRING })
            , User = this.sequelize.define('User', { username: DataTypes.STRING });

          User.hasMany(Task, {onDelete: 'restrict'});

          return this.sequelize.sync({ force: true }).bind({}).then(function() {
            return Promise.all([
              User.create({ username: 'foo' }),
              Task.create({ title: 'task' })
            ]);
          }).spread(function(user, task) {
            this.user = user;
            this.task = task;
            return user.setTasks([task]);
          }).then(function() {
            return this.user.destroy().catch (self.sequelize.ForeignKeyConstraintError, function() {
              // Should fail due to FK violation
              return Task.findAll();
            });
          }).then(function(tasks) {
            expect(tasks).to.have.length(1);
          });
        });

        it('can restrict updates', function() {
          var self = this;
          var Task = this.sequelize.define('Task', { title: DataTypes.STRING })
            , User = this.sequelize.define('User', { username: DataTypes.STRING });

          User.hasMany(Task, {onUpdate: 'restrict'});

          return this.sequelize.sync({ force: true }).then(function() {
            return Promise.all([
              User.create({ username: 'foo' }),
              Task.create({ title: 'task' })
            ]);
          }).spread(function(user, task) {
            return user.setTasks([task]).return (user);
          }).then(function(user) {
            // Changing the id of a DAO requires a little dance since
            // the `UPDATE` query generated by `save()` uses `id` in the
            // `WHERE` clause

            var tableName = user.QueryInterface.QueryGenerator.addSchema(user.Model);
            return user.QueryInterface.update(user, tableName, {id: 999}, user.id)
            .catch (self.sequelize.ForeignKeyConstraintError, function() {
              // Should fail due to FK violation
              return Task.findAll();
            });
          }).then(function(tasks) {
            expect(tasks).to.have.length(1);
          });
        });

      }

    });

    describe('n:m', function() {
      beforeEach(function() {
        this.Task = this.sequelize.define('task', { title: DataTypes.STRING });
        this.User = this.sequelize.define('user', { username: DataTypes.STRING });
        this.UserTasks = this.sequelize.define('tasksusers', { userId: DataTypes.INTEGER, taskId: DataTypes.INTEGER });
      });

      it('can cascade deletes both ways by default', function() {
        var self = this;

        this.User.hasMany(this.Task);
        this.Task.hasMany(this.User);

        return this.sequelize.sync({ force: true }).bind({}).then(function() {
          return Promise.all([
            self.User.create({ id: 67, username: 'foo' }),
            self.Task.create({ id: 52, title: 'task' }),
            self.User.create({ id: 89, username: 'bar' }),
            self.Task.create({ id: 42, title: 'kast' })
          ]);
        }).spread(function(user1, task1, user2, task2) {
          this.user1 = user1;
          this.task1 = task1;
          this.user2 = user2;
          this.task2 = task2;
          return Promise.all([
            user1.setTasks([task1]),
            task2.setUsers([user2])
          ]);
        }).then(function() {
          return Promise.all([
            this.user1.destroy(),
            this.task2.destroy()
          ]);
        }).then(function() {
          return Promise.all([
            self.sequelize.model('tasksusers').findAll({ where: { userId: this.user1.id }}),
            self.sequelize.model('tasksusers').findAll({ where: { taskId: this.task2.id }})
          ]);
        }).spread(function(tu1, tu2) {
          expect(tu1).to.have.length(0);
          expect(tu2).to.have.length(0);
        });
      });

      if (current.dialect.supports.constraints.restrict) {

        it('can restrict deletes both ways', function() {
          var self = this
            , spy = sinon.spy();

          this.User.hasMany(this.Task, { onDelete: 'RESTRICT'});
          this.Task.hasMany(this.User, { onDelete: 'RESTRICT'});

          return this.sequelize.sync({ force: true }).bind({}).then(function() {
            return Promise.all([
              self.User.create({ id: 67, username: 'foo' }),
              self.Task.create({ id: 52, title: 'task' }),
              self.User.create({ id: 89, username: 'bar' }),
              self.Task.create({ id: 42, title: 'kast' })
            ]);
          }).spread(function(user1, task1, user2, task2) {
            this.user1 = user1;
            this.task1 = task1;
            this.user2 = user2;
            this.task2 = task2;
            return Promise.all([
              user1.setTasks([task1]),
              task2.setUsers([user2])
            ]);
          }).then(function() {
            return Promise.all([
              this.user1.destroy().catch (self.sequelize.ForeignKeyConstraintError, spy), // Fails because of RESTRICT constraint
              this.task2.destroy().catch (self.sequelize.ForeignKeyConstraintError, spy)
            ]);
          }).then(function() {
            expect(spy).to.have.been.calledTwice;
          });
        });

        it('can cascade and restrict deletes', function() {
          var spy = sinon.spy()
            , self = this;

          self.User.hasMany(self.Task, { onDelete: 'RESTRICT'});
          self.Task.hasMany(self.User); // Implicit CASCADE

          return this.sequelize.sync({ force: true }).bind({}).then(function() {
            return Promise.all([
              self.User.create({ id: 67, username: 'foo' }),
              self.Task.create({ id: 52, title: 'task' }),
              self.User.create({ id: 89, username: 'bar' }),
              self.Task.create({ id: 42, title: 'kast' })
            ]);
          }).spread(function(user1, task1, user2, task2) {
            this.user1 = user1;
            this.task1 = task1;
            this.user2 = user2;
            this.task2 = task2;
            return Promise.all([
              user1.setTasks([task1]),
              task2.setUsers([user2])
            ]);
          }).then(function() {
            return Promise.all([
              this.user1.destroy().catch (self.sequelize.ForeignKeyConstraintError, spy), // Fails because of RESTRICT constraint
              this.task2.destroy()
            ]);
          }).then(function() {
            expect(spy).to.have.been.calledOnce;
            return self.sequelize.model('tasksusers').findAll({ where: { taskId: this.task2.id }});
          }).then(function(usertasks) {
            // This should not exist because deletes cascade
            expect(usertasks).to.have.length(0);
          });
        });

      }

      it('should be possible to remove all constraints', function() {
        var self = this;

        this.User.hasMany(this.Task, { constraints: false });
        this.Task.hasMany(this.User, { constraints: false });

        return this.sequelize.sync({ force: true }).bind({}).then(function() {
          return Promise.all([
            self.User.create({ id: 67, username: 'foo' }),
            self.Task.create({ id: 52, title: 'task' }),
            self.User.create({ id: 89, username: 'bar' }),
            self.Task.create({ id: 42, title: 'kast' })
          ]);
        }).spread(function(user1, task1, user2, task2) {
          this.user1 = user1;
          this.task1 = task1;
          this.user2 = user2;
          this.task2 = task2;
          return Promise.all([
            user1.setTasks([task1]),
            task2.setUsers([user2])
          ]);
        }).then(function() {
          return Promise.all([
            this.user1.destroy(),
            this.task2.destroy()
          ]);
        }).then(function() {
          return Promise.all([
            self.sequelize.model('tasksusers').findAll({ where: { userId: this.user1.id }}),
            self.sequelize.model('tasksusers').findAll({ where: { taskId: this.task2.id }})
          ]);
        }).spread(function(ut1, ut2) {
          expect(ut1).to.have.length(1);
          expect(ut2).to.have.length(1);
        });
      });
    });
  });

  describe('Association options', function() {
    it('can specify data type for autogenerated relational keys', function() {
      var User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING })
        , dataTypes = [Sequelize.INTEGER, Sequelize.BIGINT, Sequelize.STRING]
        , self = this
        , Tasks = {};

      return Promise.each(dataTypes, function(dataType) {
        var tableName = 'TaskXYZ_' + dataType.toString();
        Tasks[dataType] = self.sequelize.define(tableName, { title: DataTypes.STRING });

        User.hasMany(Tasks[dataType], { foreignKey: 'userId', keyType: dataType, constraints: false });

        return Tasks[dataType].sync({ force: true }).then(function() {
          expect(Tasks[dataType].rawAttributes.userId.type instanceof dataType).to.be.ok;
        });
      });
    });

    it('infers the keyType if none provided', function() {
      var User = this.sequelize.define('User', {
        id: { type: DataTypes.STRING, primaryKey: true },
        username: DataTypes.STRING
      })
      , Task = this.sequelize.define('Task', {
        title: DataTypes.STRING
      });

      User.hasMany(Task);

      return this.sequelize.sync({ force: true }).then(function() {
        expect(Task.rawAttributes.UserId.type instanceof DataTypes.STRING).to.be.ok;
      });
    });

    describe('allows the user to provide an attribute definition object as foreignKey', function() {
      it('works with a column that hasnt been defined before', function() {
        var Task = this.sequelize.define('task', {})
        , User = this.sequelize.define('user', {});

        User.hasMany(Task, {
          foreignKey: {
            name: 'uid',
            allowNull: false
          }
        });

        expect(Task.rawAttributes.uid).to.be.defined;
        expect(Task.rawAttributes.uid.allowNull).to.be.false;
        expect(Task.rawAttributes.uid.references).to.equal(User.getTableName());
        expect(Task.rawAttributes.uid.referencesKey).to.equal('id');

        Task.hasMany(User, {
          foreignKey: {
            allowNull: false
          }
        });

        expect(Task.rawAttributes.uid).not.to.be.defined;

        expect(Task.associations.tasksusers.through.model.rawAttributes.taskId).to.be.defined;
        expect(Task.associations.tasksusers.through.model.rawAttributes.taskId.allowNull).to.be.false;
        expect(Task.associations.tasksusers.through.model.rawAttributes.taskId.references).to.equal(Task.getTableName());
        expect(Task.associations.tasksusers.through.model.rawAttributes.taskId.referencesKey).to.equal('id');

        expect(Task.associations.tasksusers.through.model.rawAttributes.uid).to.be.defined;
        expect(Task.associations.tasksusers.through.model.rawAttributes.uid.allowNull).to.be.false;
        expect(Task.associations.tasksusers.through.model.rawAttributes.uid.references).to.equal(User.getTableName());
        expect(Task.associations.tasksusers.through.model.rawAttributes.uid.referencesKey).to.equal('id');
      });

      it('works when taking a column directly from the object', function() {
        var Project = this.sequelize.define('project', {
            user_id: {
              type: Sequelize.INTEGER,
              defaultValue: 42
            }
          })
        , User = this.sequelize.define('user', {
            uid: {
              type: Sequelize.INTEGER,
              primaryKey: true
            }
          });

        User.hasMany(Project, { foreignKey: Project.rawAttributes.user_id});

        expect(Project.rawAttributes.user_id).to.be.defined;
        expect(Project.rawAttributes.user_id.references).to.equal(User.getTableName());
        expect(Project.rawAttributes.user_id.referencesKey).to.equal('uid');
        expect(Project.rawAttributes.user_id.defaultValue).to.equal(42);
      });

      it('works when merging with an existing definition', function() {
        var Task = this.sequelize.define('task', {
            userId: {
              defaultValue: 42,
              type: Sequelize.INTEGER
            }
          })
        , User = this.sequelize.define('user', {});

        User.hasMany(Task, { foreignKey: { allowNull: true }});

        expect(Task.rawAttributes.userId).to.be.defined;
        expect(Task.rawAttributes.userId.defaultValue).to.equal(42);
        expect(Task.rawAttributes.userId.allowNull).to.be.ok;
      });
    });

    it('should throw an error if foreignKey and as result in a name clash', function() {
      var User = this.sequelize.define('user', {
            user: Sequelize.INTEGER
          });

      expect(User.hasMany.bind(User, User, { as: 'user' })).to
        .throw ("Naming collision between attribute 'user' and association 'user' on model user. To remedy this, change either foreignKey or as in your association definition");
    });
  });
});
