/* jshint camelcase: false, expr: true */
var chai      = require('chai')
  , expect    = chai.expect
  , Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + "/../../lib/data-types")
  , Sequelize = require('../../index')
  , _         = require('lodash')
  , moment    = require('moment')
  , sinon     = require('sinon')

chai.Assertion.includeStack = true

describe(Support.getTestDialectTeaser("HasMany"), function() {
  describe("Model.associations", function () {
    it("should store all assocations when associting to the same table multiple times", function () {
      var User = this.sequelize.define('User', {})
        , Group = this.sequelize.define('Group', {})

      Group.hasMany(User)
      Group.hasMany(User, { foreignKey: 'primaryGroupId', as: 'primaryUsers' })
      Group.hasMany(User, { foreignKey: 'secondaryGroupId', as: 'secondaryUsers' })

      expect(Object.keys(Group.associations)).to.deep.equal(['GroupsUsers', 'primaryUsers', 'secondaryUsers'])
    })
  })

  describe('(1:N)', function() {
    describe('hasSingle', function() {
      beforeEach(function(done) {
        var self = this

        this.Article = this.sequelize.define('Article', { 'title': DataTypes.STRING })
        this.Label   = this.sequelize.define('Label', { 'text': DataTypes.STRING })

        this.Article.hasMany(this.Label)

        this.Label.sync({ force: true }).success(function() {
          self.Article.sync({ force: true }).success(function() {
            done()
          })
        })
      })

      it('supports transactions', function(done) {
        Support.prepareTransactionTest(this.sequelize, function(sequelize) {
          var Article = sequelize.define('Article', { 'title': DataTypes.STRING })
            , Label   = sequelize.define('Label', { 'text': DataTypes.STRING })

          Article.hasMany(Label)

          sequelize.sync({ force: true }).success(function() {
            Article.create({ title: 'foo' }).success(function(article) {
              Label.create({ text: 'bar' }).success(function(label) {
                sequelize.transaction(function(t) {
                  article.setLabels([ label ], { transaction: t }).success(function() {
                    Article.all({ transaction: t }).success(function(articles) {
                      articles[0].hasLabel(label).success(function(hasLabel) {
                        expect(hasLabel).to.be.false
                        Article.all({ transaction: t }).success(function(articles) {
                          articles[0].hasLabel(label, { transaction: t }).success(function(hasLabel) {
                            expect(hasLabel).to.be.true
                            t.rollback().success(function() { done() })
                          })
                        })
                      })
                    })
                  })
                })
              })
            })
          })
        })
      })

      it('does not have any labels assigned to it initially', function(done) {
        var chainer = new Sequelize.Utils.QueryChainer([
          this.Article.create({ title: 'Articl2e' }),
          this.Article.create({ title: 'Article' }),
          this.Label.create({ text: 'Awesomeness' }),
          this.Label.create({ text: 'Epicness' })
        ])

        chainer.run().success(function(results, article, label1, label2) {
          var chainer = new Sequelize.Utils.QueryChainer([
            article.hasLabel(label1),
            article.hasLabel(label2)
          ])

          chainer.run().success(function(_, hasLabel1, hasLabel2) {
            expect(hasLabel1).to.be.false
            expect(hasLabel2).to.be.false
            done()
          })
        })
      })

      it('answers true if the label has been assigned', function(done) {
        var chainer = new Sequelize.Utils.QueryChainer([
          this.Article.create({ title: 'Article' }),
          this.Label.create({ text: 'Awesomeness' }),
          this.Label.create({ text: 'Epicness' })
        ])

        chainer.run().success(function(results, article, label1, label2) {
          var chainer = new Sequelize.Utils.QueryChainer([
            [ article, 'addLabel', [ label1 ]],
            [ article, 'hasLabel', [ label1 ]],
            [ article, 'hasLabel', [ label2 ]]
          ])

          chainer.runSerially()
          .success(function(_, label1, hasLabel1, hasLabel2) {
            expect(hasLabel1).to.be.true
            expect(hasLabel2).to.be.false
            done()
          })
        })
      })
    })

    describe('hasAll', function() {
      beforeEach(function(done) {
        var self = this
        this.Article = this.sequelize.define('Article', {
          'title': DataTypes.STRING
        })
        this.Label = this.sequelize.define('Label', {
          'text': DataTypes.STRING
        })

        this.Article.hasMany(this.Label)

        this.Label.sync({ force: true }).success(function() {
          self.Article.sync({ force: true }).success(function() {
            done()
          })
        })
      })

      it('supports transactions', function(done) {
        Support.prepareTransactionTest(this.sequelize, function(sequelize) {
          var Article = sequelize.define('Article', { 'title': DataTypes.STRING })
            , Label   = sequelize.define('Label', { 'text': DataTypes.STRING })

          Article.hasMany(Label)

          sequelize.sync({ force: true }).success(function() {
            Article.create({ title: 'foo' }).success(function(article) {
              Label.create({ text: 'bar' }).success(function(label) {
                sequelize.transaction(function(t) {
                  article.setLabels([ label ], { transaction: t }).success(function() {
                    Article.all({ transaction: t }).success(function(articles) {
                      articles[0].hasLabels([ label ]).success(function(hasLabel) {
                        expect(hasLabel).to.be.false
                        Article.all({ transaction: t }).success(function(articles) {
                          articles[0].hasLabels([ label ], { transaction: t }).success(function(hasLabel) {
                            expect(hasLabel).to.be.true
                            t.rollback().success(function() { done() })
                          })
                        })
                      })
                    })
                  })
                })
              })
            })
          })
        })
      })

      it('answers false if only some labels have been assigned', function(done) {
        var chainer = new Sequelize.Utils.QueryChainer([
          this.Article.create({ title: 'Article' }),
          this.Label.create({ text: 'Awesomeness' }),
          this.Label.create({ text: 'Epicness' })
        ])

        chainer.run().success(function(results, article, label1, label2) {
          article.addLabel(label1).success(function() {
            article.hasLabels([label1, label2]).success(function(result) {
              expect(result).to.be.false
              done()
            })
          })
        })
      })

      it('answers true if all label have been assigned', function(done) {
        var chainer = new Sequelize.Utils.QueryChainer([
          this.Article.create({ title: 'Article' }),
          this.Label.create({ text: 'Awesomeness' }),
          this.Label.create({ text: 'Epicness' })
        ])

        chainer.run().success(function(results, article, label1, label2) {
          article.setLabels([label1, label2]).success(function() {
            article.hasLabels([label1, label2]).success(function(result) {
              expect(result).to.be.true
              done()
            })
          })
        })
      })
    })

    describe('setAssociations', function() {
      it('supports transactions', function(done) {
        Support.prepareTransactionTest(this.sequelize, function(sequelize) {
          var Article = sequelize.define('Article', { 'title': DataTypes.STRING })
            , Label   = sequelize.define('Label', { 'text': DataTypes.STRING })

          Article.hasMany(Label)

          sequelize.sync({ force: true }).success(function() {
            Article.create({ title: 'foo' }).success(function(article) {
              Label.create({ text: 'bar' }).success(function(label) {
                sequelize.transaction(function(t) {
                  article.setLabels([ label ], { transaction: t }).success(function() {
                    Label
                      .findAll({ where: { ArticleId: article.id }, transaction: undefined })
                      .success(function(labels) {
                        expect(labels.length).to.equal(0)

                        Label
                          .findAll({ where: { ArticleId: article.id }, transaction: t })
                          .success(function(labels) {
                            expect(labels.length).to.equal(1)
                            t.rollback().success(function() { done() })
                          })
                      })
                  })
                })
              })
            })
          })
        })
      })

      it("clears associations when passing null to the set-method", function(done) {
        var User = this.sequelize.define('User', { username: DataTypes.STRING })
          , Task = this.sequelize.define('Task', { title: DataTypes.STRING })

        Task.hasMany(User)

        User.sync({ force: true }).success(function() {
          Task.sync({ force: true }).success(function() {
            User.create({ username: 'foo' }).success(function(user) {
              Task.create({ title: 'task' }).success(function(task) {
                task.setUsers([ user ]).success(function() {
                  task.getUsers().success(function(_users) {
                    expect(_users).to.have.length(1)

                    task.setUsers(null).success(function() {
                      task.getUsers().success(function(_users) {
                        expect(_users).to.have.length(0)
                        done()
                      })
                    })
                  })
                })
              })
            })
          })
        })
      })
    })

    describe('addAssociations', function() {
      it('supports transactions', function(done) {
        Support.prepareTransactionTest(this.sequelize, function(sequelize) {
          var Article = sequelize.define('Article', { 'title': DataTypes.STRING })
            , Label   = sequelize.define('Label', { 'text': DataTypes.STRING })

          Article.hasMany(Label)

          sequelize.sync({ force: true }).success(function() {
            Article.create({ title: 'foo' }).success(function(article) {
              Label.create({ text: 'bar' }).success(function(label) {
                sequelize.transaction(function(t) {
                  article.addLabel(label, { transaction: t }).success(function() {
                    Label
                      .findAll({ where: { ArticleId: article.id }, transaction: undefined })
                      .success(function(labels) {
                        expect(labels.length).to.equal(0)

                        Label
                          .findAll({ where: { ArticleId: article.id }, transaction: t })
                          .success(function(labels) {
                            expect(labels.length).to.equal(1)
                            t.rollback().success(function() { done() })
                          })
                      })
                  })
                })
              })
            })
          })
        })
      })
    })

    it("clears associations when passing null to the set-method with omitNull set to true", function(done) {
      this.sequelize.options.omitNull = true

      var User = this.sequelize.define('User', { username: DataTypes.STRING })
        , Task = this.sequelize.define('Task', { title: DataTypes.STRING })

      Task.hasMany(User)

      User.sync({ force: true }).success(function() {
        Task.sync({ force: true }).success(function() {
          User.create({ username: 'foo' }).success(function(user) {
            Task.create({ title: 'task' }).success(function(task) {
              task.setUsers([ user ]).success(function() {
                task.getUsers().success(function(_users) {
                  expect(_users).to.have.length(1)

                  task.setUsers(null).success(function() {
                    task.getUsers().success(function(_users) {
                      expect(_users).to.have.length(0)
                      done()
                    })
                  })
                })
              })
            })
          })
        })
      })
    })

    describe('createAssociations', function() {
      it('creates a new associated object', function(done) {
        var Article = this.sequelize.define('Article', { 'title': DataTypes.STRING })
          , Label   = this.sequelize.define('Label', { 'text': DataTypes.STRING })

        Article.hasMany(Label)

        Article.sync({ force: true }).success(function() {
          Label.sync({ force: true }).success(function() {
            Article.create({ title: 'foo' }).success(function(article) {
              article.createLabel({ text: 'bar' }).success(function(label) {

                Label
                  .findAll({ where: { ArticleId: article.id }})
                  .success(function(labels) {
                    expect(labels.length).to.equal(1)
                    done()
                  })
              })
            })
          })
        })
      })

      it('supports transactions', function(done) {
        var self = this
        Support.prepareTransactionTest(this.sequelize, function(sequelize) {
          var Article = sequelize.define('Article', { 'title': DataTypes.STRING })
            , Label   = sequelize.define('Label', { 'text': DataTypes.STRING })

          Article.hasMany(Label)

          Article.sync({ force: true }).success(function() {
            Label.sync({ force: true }).success(function() {
              Article.create({ title: 'foo' }).success(function(article) {
                sequelize.transaction(function (t) {
                  article.createLabel({ text: 'bar' }, { transaction: t }).success(function(label) {
                    Label.findAll({ where: { ArticleId: article.id }}).success(function(labels) {
                      expect(labels.length).to.equal(0)
                      Label.findAll({ where: { ArticleId: article.id }}, { transaction: t }).success(function(labels) {
                        expect(labels.length).to.equal(1)
                        t.rollback().success(function() { done() })
                      })
                    })
                  })
                })
              })
            })
          })
        })
      })
    })

    describe("getting assocations with options", function() {
      beforeEach(function(done) {
        var self = this

        this.User = this.sequelize.define('User', { username: DataTypes.STRING })
        this.Task = this.sequelize.define('Task', { title: DataTypes.STRING, active: DataTypes.BOOLEAN })

        this.User.hasMany(self.Task)

        this.User.sync({ force: true }).success(function() {
          self.Task.sync({ force: true }).success(function() {
            var chainer = new Sequelize.Utils.QueryChainer([
              self.User.create({ username: 'John'}),
              self.Task.create({ title: 'Get rich', active: true}),
              self.Task.create({ title: 'Die trying', active: false})
            ])

            chainer.run().success(function (results, john, task1, task2) {
              john.setTasks([task1, task2]).success(function() {
                done()
              })
            })
          })
        })
      })

      it('should treat the where object of associations as a first class citizen', function(done) {
        var self = this
        this.Article = this.sequelize.define('Article', {
          'title': DataTypes.STRING
        })
        this.Label = this.sequelize.define('Label', {
          'text': DataTypes.STRING,
          'until': DataTypes.DATE
        })

        this.Article.hasMany(this.Label)

        this.Label.sync({ force: true }).success(function() {
          self.Article.sync({ force: true }).success(function() {
            var chainer = new Sequelize.Utils.QueryChainer([
              self.Article.create({ title: 'Article' }),
              self.Label.create({ text: 'Awesomeness', until: '2014-01-01 01:00:00' }),
              self.Label.create({ text: 'Epicness', until: '2014-01-03 01:00:00' })
            ])

            chainer.run().success(function(results, article, label1, label2) {
              article.setLabels([label1, label2]).success(function() {
                article.getLabels({where: ['until > ?', moment('2014-01-02').toDate()]}).success(function(labels) {
                  expect(labels).to.be.instanceof(Array)
                  expect(labels).to.have.length(1)
                  expect(labels[0].text).to.equal('Epicness')
                  done()
                })
              })
            })
          })
        })
      })

      it("gets all associated objects when no options are passed", function(done) {
        this.User.find({where: {username: 'John'}}).success(function (john) {
          john.getTasks().success(function (tasks) {
            expect(tasks).to.have.length(2)
            done()
          })
        })
      })

      it("only get objects that fulfill the options", function(done) {
        this.User.find({ where: { username: 'John' } }).success(function (john) {
          john.getTasks({ where: { active: true }, limit: 10, order: 'id DESC' }).success(function (tasks) {
            expect(tasks).to.have.length(1)
            done()
          })
        })
      })
    })

    describe('optimizations using bulk create, destroy and update', function () {
      beforeEach(function (done) {
        var self = this
        this.User = this.sequelize.define('User', { username: DataTypes.STRING }, {timestamps: false})
        this.Task = this.sequelize.define('Task', { title: DataTypes.STRING }, {timestamps: false})

        this.User.hasMany(this.Task)

        this.User.sync({ force: true }).success(function() {
          self.Task.sync({ force: true }).success(function() {
            done()
          })
        })
      })

      it('uses one UPDATE statement', function (done) {
        var self = this
          , spy = sinon.spy()

        this.User.create({ username: 'foo' }).success(function(user) {
          self.Task.create({ title: 'task1' }).success(function(task1) {
            self.Task.create({ title: 'task2' }).success(function(task2) {
              user.setTasks([task1, task2]).on('sql', spy).on('sql', _.after(2, function (sql) { // We don't care about SELECt, only UPDAET
                expect(sql).to.have.string("UPDATE")
                expect(sql).to.have.string("IN (1,2)")
              })).success(function () {
                expect(spy.calledTwice).to.be.ok // Once for SELECT, once for UPDATE
                done()
              })
            })
          })
        })
      })

      it('uses one UPDATE statement', function (done) {
        var self = this
          , spy = sinon.spy()

        this.User.create({ username: 'foo' }).success(function (user) {
          self.Task.create({ title: 'task1' }).success(function (task1) {
            self.Task.create({ title: 'task2' }).success(function (task2) {
              user.setTasks([task1, task2]).success(function () {
                user.setTasks(null).on('sql', spy).on('sql', _.after(2, function (sql) { // We don't care about SELECT, only UPDATE
                  expect(sql).to.have.string("UPDATE")
                  expect(sql).to.have.string("IN (1,2)")
                })).success(function () {
                  expect(spy.calledTwice).to.be.ok // Once for SELECT, once for UPDATE
                  done()
                })
              })
            })
          })
        })
      })
    }) // end optimization using bulk create, destroy and update

    describe('selfAssociations', function () {
      it('should work with alias', function (done) {
        var Person = this.sequelize.define('Group', {})

        Person.hasMany(Person, { as: 'Children'});

        this.sequelize.sync().done(function (err) {
          expect(err).not.to.be.ok
          done()
        })
      })
      it('should work with through', function (done) {
        var Group = this.sequelize.define('Group', {})

        Group.hasMany(Group, { through: 'groups_outsourcing_companies', as: 'OutsourcingCompanies'});

        this.sequelize.sync().done(function (err) {
          expect(err).not.to.be.ok
          done()
        })
      })
    })
  })

  describe('(N:M)', function() {
    describe("getting assocations with options", function() {
      beforeEach(function(done) {
        var self = this

        this.User = this.sequelize.define('User', { username: DataTypes.STRING })
        this.Task = this.sequelize.define('Task', { title: DataTypes.STRING, active: DataTypes.BOOLEAN })

        self.User.hasMany(self.Task)
        self.Task.hasMany(self.User)

        this.User.sync({ force: true }).success(function() {
          self.Task.sync({ force: true }).success(function() {
            var chainer = new Sequelize.Utils.QueryChainer([
              self.User.create({ username: 'John'}),
              self.Task.create({ title: 'Get rich', active: true}),
              self.Task.create({ title: 'Die trying', active: false})
            ])

            chainer.run().success(function (results, john, task1, task2) {
              john.setTasks([task1, task2]).success(function() {
                done()
              })
            })
          })
        })
      })

      it('supports transactions', function(done) {
        Support.prepareTransactionTest(this.sequelize, function(sequelize) {
          var Article = sequelize.define('Article', { 'title': DataTypes.STRING })
            , Label   = sequelize.define('Label', { 'text': DataTypes.STRING })

          Article.hasMany(Label)
          Label.hasMany(Article)

          sequelize.sync({ force: true }).success(function() {
            Article.create({ title: 'foo' }).success(function(article) {
              Label.create({ text: 'bar' }).success(function(label) {
                sequelize.transaction(function(t) {
                  article.setLabels([ label ], { transaction: t }).success(function() {
                    Article.all({ transaction: t }).success(function(articles) {
                      articles[0].getLabels().success(function(labels) {
                        expect(labels).to.have.length(0)
                        Article.all({ transaction: t }).success(function(articles) {
                          articles[0].getLabels({ transaction: t }).success(function(labels) {
                            expect(labels).to.have.length(1)
                            t.rollback().success(function() { done() })
                          })
                        })
                      })
                    })
                  })
                })
              })
            })
          })
        })
      })

      it("gets all associated objects when no options are passed", function(done) {
        this.User.find({where: {username: 'John'}}).success(function (john) {
          john.getTasks().success(function (tasks) {
            expect(tasks).to.have.length(2)
            done()
          })
        })
      })

      it("only get objects that fulfill the options", function(done) {
        this.User.find({where: {username: 'John'}}).success(function (john) {
          john.getTasks({where: {active: true}}).success(function (tasks) {
            expect(tasks).to.have.length(1)
            done()
          })
        })
      })

      it("only gets objects that fulfill options with a formatted value", function(done) {
        this.User.find({where: {username: 'John'}}).success(function (john) {
          john.getTasks({where: ['active = ?', true]}).success(function (tasks) {
            expect(tasks).to.have.length(1)
            done()
          })
        })
      })

      it("get associated objects with an eager load", function(done) {
        this.User.find({where: {username: 'John'}, include: [ this.Task ]}).success(function (john) {
          expect(john.tasks).to.have.length(2);
          done();
        })
      })
    })

    it("removes the reference id, which was added in the first place", function(done) {
      var User = this.sequelize.define('User', { username: DataTypes.STRING })
        , Task = this.sequelize.define('Task', { title: DataTypes.STRING })

      User.hasMany(Task)
      expect(Task.attributes.UserId).to.exist

      Task.hasMany(User)
      expect(Task.attributes.UserId).not.to.exist
      setTimeout(function () {
        done()
      }, 50)
    })

    describe('setAssociations', function() {
      it("clears associations when passing null to the set-method", function(done) {
        var User = this.sequelize.define('User', { username: DataTypes.STRING })
          , Task = this.sequelize.define('Task', { title: DataTypes.STRING })

        User.hasMany(Task)
        Task.hasMany(User)

        User.sync({ force: true }).success(function() {
          Task.sync({ force: true }).success(function() {
            User.create({ username: 'foo' }).success(function(user) {
              Task.create({ title: 'task' }).success(function(task) {
                task.setUsers([ user ]).success(function() {
                  task.getUsers().success(function(_users) {
                    expect(_users).to.have.length(1)

                    task.setUsers(null).success(function() {
                      task.getUsers().success(function(_users) {
                        expect(_users).to.have.length(0)
                        done()
                      })
                    })
                  })
                })
              })
            })
          })
        })
      })

      it("sets new associations with custom primary keys", function (done) {
        var User = this.sequelize.define('User', { uid: { type:DataTypes.INTEGER, primaryKey:true, autoIncrement: true }, username: DataTypes.STRING })
          , Task = this.sequelize.define('Task', { tid: { type:DataTypes.INTEGER, primaryKey:true, autoIncrement: true }, title: DataTypes.STRING })
          
        User.hasMany(Task)
        Task.hasMany(User)

        User.sync({ force: true }).success(function () {
          Task.sync({ force: true }).success(function () {
            User.create({ username: 'foo' }).success(function (user) {
              Task.create({ title: 'task' }).success(function (task) {
                task.setUsers([ user ]).success(function () {
                  User.create({ username: 'bar' }).success(function (user2) {
                    user2.user_has_task = {usertitle: "Something"};
                    task.setUsers([ user, user2 ]).success(function () {
                      task.getUsers().success(function (_users) {
                        expect(_users).to.have.length(2)
                        done()
                      })
                    })
                  })
                })
              })
            })
          })
        })
      })

      it("joins an association with custom primary keys", function(done) {
        var Group = this.sequelize.define('group', {
            group_id: {type: DataTypes.INTEGER, primaryKey: true},
            name: DataTypes.STRING(64)
          })
          , Member = this.sequelize.define('member', {
            member_id: {type: DataTypes.INTEGER, primaryKey: true},
            email: DataTypes.STRING(64)
          })

        Group.hasMany(Member, {joinTableName: 'group_members', foreignKey: 'group_id'})
        Member.hasMany(Group, {joinTableName: 'group_members', foreignKey: 'member_id'})

        Group.sync({ force: true }).success(function() {
          Member.sync({ force: true }).success(function() {
            Group.create({group_id: 1, name: 'Group1'}).success(function(){
              Member.create({member_id: 10, email: 'team@sequelizejs.com'}).success(function() {
                Group.find(1).success(function(group) {
                  Member.find(10).success(function(member) {
                    group.addMember(member).success(function() {
                      group.getMembers().success(function(members) {
                        expect(members).to.be.instanceof(Array)
                        expect(members).to.have.length(1)
                        expect(members[0].member_id).to.equal(10)
                        expect(members[0].email).to.equal('team@sequelizejs.com')
                        done()
                      })
                    })
                  })
                })
              })
            })
          })
        })
      })
    })

    describe('createAssociations', function() {
      it('creates a new associated object', function(done) {
        var User = this.sequelize.define('User', { username: DataTypes.STRING })
          , Task = this.sequelize.define('Task', { title: DataTypes.STRING })

        User.hasMany(Task)
        Task.hasMany(User)

        User.sync({ force: true }).success(function() {
          Task.sync({ force: true }).success(function() {
            Task.create({ title: 'task' }).success(function(task) {
              task.createUser({ username: 'foo' }).success(function() {
                task.getUsers().success(function(_users) {
                  expect(_users).to.have.length(1)

                  done()
                })
              })
            })
          })
        })
      })

      it('supports transactions', function(done) {
        var self = this
        Support.prepareTransactionTest(this.sequelize, function(sequelize) {
          var User = sequelize.define('User', { username: DataTypes.STRING })
            , Task = sequelize.define('Task', { title: DataTypes.STRING })

          User.hasMany(Task)
          Task.hasMany(User)

          User.sync({ force: true }).success(function() {
            Task.sync({ force: true }).success(function() {
              Task.create({ title: 'task' }).success(function(task) {
                sequelize.transaction(function (t) {
                  task.createUser({ username: 'foo' }, { transaction: t }).success(function() {
                    task.getUsers().success(function(users) {
                      expect(users).to.have.length(0)

                      task.getUsers({ transaction: t }).success(function(users) {
                        expect(users).to.have.length(1)
                        t.rollback().success(function() { done() })
                      })
                    })
                  })
                })
              })
            })
          })
        })
      })
    })

    describe('addAssociations', function() {
      it('supports transactions', function(done) {
        Support.prepareTransactionTest(this.sequelize, function(sequelize) {
          var User = sequelize.define('User', { username: DataTypes.STRING })
            , Task = sequelize.define('Task', { title: DataTypes.STRING })

          User.hasMany(Task)
          Task.hasMany(User)

          sequelize.sync({ force: true }).success(function() {
            User.create({ username: 'foo' }).success(function(user) {
              Task.create({ title: 'task' }).success(function(task) {
                sequelize.transaction(function(t){
                  task.addUser(user, { transaction: t }).success(function() {
                    task.hasUser(user).success(function(hasUser) {
                      expect(hasUser).to.be.false
                      task.hasUser(user, { transaction: t }).success(function(hasUser) {
                        expect(hasUser).to.be.true
                        t.rollback().success(function() { done() })
                      })
                    })
                  })
                })
              })
            })
          })
        })
      })
    })

    describe('optimizations using bulk create, destroy and update', function () {
      beforeEach(function (done) {
        var self = this
        this.User = this.sequelize.define('User', { username: DataTypes.STRING }, {timestamps: false})
        this.Task = this.sequelize.define('Task', { title: DataTypes.STRING }, {timestamps: false})

        this.User.hasMany(this.Task)
        this.Task.hasMany(this.User)

        this.User.sync({ force: true }).success(function() {
          self.Task.sync({force: true}).success(function() {
            done()
          })
        })
      })

      it('uses one insert into statement', function (done) {
        var self = this
          , spy = sinon.spy()

        this.User.create({ username: 'foo' }).success(function(user) {
          self.Task.create({ title: 'task1' }).success(function(task1) {
            self.Task.create({ title: 'task2' }).success(function(task2) {
              user.setTasks([task1, task2]).on('sql', spy).on('sql', _.after(2, function (sql) {
                expect(sql).to.have.string("INSERT INTO")
                expect(sql).to.have.string("VALUES (1,1),(1,2)")
              })).success(function () {
                expect(spy.calledTwice).to.be.ok
                done()
              })
            })
          })
        })
      })

      it('uses one delete from statement', function (done) {
        var self = this
          , spy = sinon.spy()

        this.User.create({ username: 'foo' }).success(function (user) {
          self.Task.create({ title: 'task1' }).success(function (task1) {
            self.Task.create({ title: 'task2' }).success(function (task2) {
              user.setTasks([task1, task2]).success(function () {
                user.setTasks(null).on('sql', spy).on('sql', _.after(2, function (sql) {
                  expect(sql).to.have.string("DELETE FROM")
                  expect(sql).to.have.string("IN (1,2)")
                })).success(function () {
                  expect(spy.calledTwice).to.be.ok // Once for SELECT, once for DELETE
                  done()
                })
              })
            })
          })
        })
      })
    }) // end optimization using bulk create, destroy and update

    describe('join table creation', function () {
      beforeEach(function (done) {
        var self = this
        this.User = this.sequelize.define('User',
          { username: DataTypes.STRING },
          { tableName: 'users'}
        )
        this.Task = this.sequelize.define('Task',
          { title: DataTypes.STRING },
          { tableName: 'tasks' }
        )

        this.User.hasMany(this.Task, { joinTableName: 'user_has_tasks' })
        this.Task.hasMany(this.User, { joinTableName: 'user_has_tasks' })

        this.User.sync({ force: true }).success(function() {
          self.Task.sync({force: true}).success(function() {
            done()
          })
        })
      })

      it('uses the specified joinTableName or a reasonable default', function(done) {
        for (var associationName in this.User.associations) {
          expect(associationName).not.to.equal(this.User.tableName)
          expect(associationName).not.to.equal(this.Task.tableName)

          var through = this.User.associations[associationName].through
          if (typeof through !== 'undefined') {
            expect(through.tableName).to.equal(associationName)
          }
          var tableName = this.User.associations[associationName].options.tableName
          if (typeof tableName !== 'undefined') {
            expect(tableName).to.equal(associationName)
          }
        }
        setTimeout(function () {
          done()
        }, 50)
      })
    })
    
    describe('primary key handling for join table', function () {
      it('removes the primary key if it was added by sequelize', function () {
        var self = this
        this.UserTasks = this.sequelize.define('usertasks', {});

        this.User.hasMany(this.Task, { through: this.UserTasks })
        this.Task.hasMany(this.User, { through: this.UserTasks })

        expect(Object.keys(self.UserTasks.primaryKeys)).to.deep.equal(['taskId', 'userId'])
      })

      it('keeps the primary key if it was added by the user', function () {
        var self = this
          , fk
         
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

        this.User.hasMany(this.Task, { through: this.UserTasks })
        this.Task.hasMany(this.User, { through: this.UserTasks })
 
        this.User.hasMany(this.Task, { through: this.UserTasks2 })
        this.Task.hasMany(this.User, { through: this.UserTasks2 })
 
        expect(Object.keys(self.UserTasks.primaryKeys)).to.deep.equal(['id'])
        expect(Object.keys(self.UserTasks2.primaryKeys)).to.deep.equal(['userTasksId'])

        _.each([self.UserTasks, self.UserTasks2], function (model) {
          fk = Object.keys(model.options.uniqueKeys)[0]
          expect(model.options.uniqueKeys[fk].fields).to.deep.equal([ 'taskId', 'userId' ])
        })
      })
    })
    
    describe('through', function () {
      beforeEach(function (done) {
        this.User = this.sequelize.define('User', {})
        this.Project = this.sequelize.define('Project', {})
        this.UserProjects = this.sequelize.define('UserProjects', {
          status: DataTypes.STRING,
          data: DataTypes.INTEGER
        })

        this.User.hasMany(this.Project, { joinTableModel: this.UserProjects })
        this.Project.hasMany(this.User, { joinTableModel: this.UserProjects })

        this.sequelize.sync().success(function() { done() })
      })

      describe('fetching from join table', function () {
        it('should contain the data from the join table on .UserProjects a DAO', function (done) {
          var self = this

          self.User.create().success(function (u) {
            self.Project.create().success(function (p) {
              u.addProject(p, { status: 'active', data: 42 }).success(function() {
                u.getProjects().success(function(projects) {
                  var project = projects[0]

                  expect(project.UserProjects).to.be.defined
                  expect(project.status).not.to.exist
                  expect(project.UserProjects.status).to.equal('active')
                  expect(project.UserProjects.data).to.equal(42)

                  done()
                })
              })
            })
          })
        })

        it('should be able to limit the join table attributes returned', function (done) {
          var self = this

          self.User.create().success(function (u) {
            self.Project.create().success(function (p) {
              u.addProject(p, { status: 'active', data: 42 }).success(function() {
                u.getProjects({ joinTableAttributes: ['status']}).success(function(projects) {
                  var project = projects[0]

                  expect(project.UserProjects).to.be.defined
                  expect(project.status).not.to.exist
                  expect(project.UserProjects.status).to.equal('active')
                  expect(project.UserProjects.data).not.to.exist

                  done()
                })
              })
            })
          })
        })
      })

      describe('inserting in join table', function () {
        describe('add', function () {
          it('should insert data provided on the object into the join table', function (done) {
            var self = this
            self.User.create().success(function (u) {
              self.Project.create().success(function (p) {
                p.UserProjects = {
                  status: 'active'
                }

                u.addProject(p).success(function() {
                  self.UserProjects.find({ where: { UserId: u.id, ProjectId: p.id }}).success(function (up) {
                    expect(up.status).to.equal('active')
                    done()
                  })
                })
              })
            })
          })

          it('should insert data provided as a second argument into the join table', function (done) {
            var self = this
            self.User.create().success(function (u) {
              self.Project.create().success(function (p) {
                u.addProject(p, { status: 'active' }).success(function() {
                  self.UserProjects.find({ where: { UserId: u.id, ProjectId: p.id }}).success(function (up) {
                    expect(up.status).to.equal('active')
                    done()
                  })
                })
              })
            })
          })

          it('should be able to add twice (second call result in UPDATE call) without any attributes (and timestamps off) on the through model', function (done) {
            var Worker = this.sequelize.define('Worker', {}, {timestamps: false})
              , Task = this.sequelize.define('Task', {}, {timestamps: false})
              , WorkerTasks = this.sequelize.define('WorkerTasks', {}, {timestamps: false})

            Worker.hasMany(Task, { through: WorkerTasks })
            Task.hasMany(Worker, { through: WorkerTasks })

            this.sequelize.sync().done(function(err) {
              expect(err).not.to.be.ok
              Worker.create({id: 1337}).done(function (err, worker) {
                expect(err).not.to.be.ok
                Task.create({id: 7331}).done(function (err, task) {
                  expect(err).not.to.be.ok
                  worker.addTask(task).done(function (err) {
                    expect(err).not.to.be.ok
                    worker.addTask(task).done(function (err) {
                      expect(err).not.to.be.ok
                      done()
                    })
                  })
                })
              })
            })
          })

          it('should be able to add twice (second call result in UPDATE call) with custom primary keys and without any attributes (and timestamps off) on the through model', function (done) {
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
              }, {timestamps: false})

            Worker.hasMany(Task, { through: WorkerTasks })
            Task.hasMany(Worker, { through: WorkerTasks })

            this.sequelize.sync().done(function(err) {
              expect(err).not.to.be.ok
              Worker.create({id: 1337}).done(function (err, worker) {
                expect(err).not.to.be.ok
                Task.create({id: 7331}).done(function (err, task) {
                  expect(err).not.to.be.ok
                  worker.addTask(task).done(function (err) {
                    expect(err).not.to.be.ok
                    worker.addTask(task).done(function (err) {
                      expect(err).not.to.be.ok
                      done()
                    })
                  })
                })
              })
            })
          })
        })

        describe('set', function () {
          it('should be able to combine properties on the associated objects, and default values', function (done) {
            var self = this
              , _done = _.after(2, done)

            self.User.create().success(function (u) {
              self.Project.bulkCreate([{}, {}]).success(function () {
                self.Project.findAll().success(function (projects) {
                  var p1 = projects[0]
                    , p2 = projects[1]

                  p1.UserProjects = {
                    status: 'inactive'
                  }

                  u.setProjects([p1, p2], { status: 'active' }).success(function() {
                    self.UserProjects.find({ where: { UserId: u.id, ProjectId: p1.id }}).success(function (up) {
                      expect(up.status).to.equal('inactive')
                      _done()
                    })

                    self.UserProjects.find({ where: { UserId: u.id, ProjectId: p2.id }}).success(function (up) {
                      expect(up.status).to.equal('active')
                      _done()
                    })
                  })
                })
              })
            })
          })

          it('should be able to set twice (second call result in UPDATE calls) without any attributes (and timestamps off) on the through model', function (done) {
            var Worker = this.sequelize.define('Worker', {}, {timestamps: false})
              , Task = this.sequelize.define('Task', {}, {timestamps: false})
              , WorkerTasks = this.sequelize.define('WorkerTasks', {}, {timestamps: false})

            Worker.hasMany(Task, { through: WorkerTasks })
            Task.hasMany(Worker, { through: WorkerTasks })

            this.sequelize.sync().done(function(err) {
              expect(err).not.to.be.ok
              Worker.create().done(function (err, worker) {
                expect(err).not.to.be.ok
                Task.bulkCreate([{}, {}]).done(function (err) {
                  expect(err).not.to.be.ok
                  Task.findAll().done(function (err, tasks) {
                    expect(err).not.to.be.ok
                    worker.setTasks(tasks).done(function (err) {
                      worker.setTasks(tasks).done(function (err) {
                        expect(err).not.to.be.ok
                        done()
                      })
                    })
                  })
                })
              })
            })
          })
        })
      })

      describe('removing from the join table', function () {
        it('should remove a single entry without any attributes (and timestamps off) on the through model', function (done) {
          var Worker = this.sequelize.define('Worker', {}, {timestamps: false})
            , Task = this.sequelize.define('Task', {}, {timestamps: false})
            , WorkerTasks = this.sequelize.define('WorkerTasks', {}, {timestamps: false})

          Worker.hasMany(Task, { through: WorkerTasks })
          Task.hasMany(Worker, { through: WorkerTasks })

          this.sequelize.sync().done(function(err) {
            expect(err).not.to.be.ok
            Worker.create({}).done(function (err, worker) {
              expect(err).not.to.be.ok
              Task.bulkCreate([{}, {}]).done(function (err) {
                expect(err).not.to.be.ok
                Task.findAll().done(function (err, tasks) {
                  expect(err).not.to.be.ok
                  worker.setTasks(tasks).done(function (err) {
                    worker.removeTask(tasks[0]).done(function (err) {
                      expect(err).not.to.be.ok

                      worker.getTasks().done(function (err, tasks) {
                        expect(tasks.length).to.equal(1)
                        done()
                      })
                    })
                  })
                })
              })
            })
          })
        })
      })
    })

    describe('belongsTo and hasMany at once', function() {
      beforeEach(function() {
        this.A = this.sequelize.define('a', { name: Sequelize.STRING })
        this.B = this.sequelize.define('b', { name: Sequelize.STRING })
      })

      describe('source belongs to target', function() {
        beforeEach(function(done) {
          this.A.belongsTo(this.B, { as: 'relation1' })
          this.A.hasMany(this.B, { as: 'relation2' })
          this.B.hasMany(this.A, { as: 'relation2' })

          this.sequelize.sync({ force: true }).success(function() {
            done()
          })
        })

        it('correctly uses bId in A', function(done) {
          var self = this

          var a1 = this.A.build({ name: 'a1' })
            , b1 = this.B.build({ name: 'b1' })

          a1
            .save()
            .then(function() { return b1.save() })
            .then(function() { return a1.setRelation1(b1) })
            .then(function() { return self.A.find({ where: { name: 'a1' } }) })
            .done(function(a) {
              expect(a.bId).to.be.eq(b1.id)
              done()
            })
        })
      })

      describe('target belongs to source', function() {
        beforeEach(function(done) {
          this.B.belongsTo(this.A, { as: 'relation1' })
          this.A.hasMany(this.B, { as: 'relation2' })
          this.B.hasMany(this.A, { as: 'relation2' })

          this.sequelize.sync({ force: true }).success(function() {
            done()
          })
        })

        it('correctly uses bId in A', function(done) {
          var self = this

          var a1 = this.A.build({ name: 'a1' })
            , b1 = this.B.build({ name: 'b1' })

          a1
            .save()
            .then(function() { return b1.save() })
            .then(function() { return b1.setRelation1(a1) })
            .then(function() { return self.B.find({ where: { name: 'b1' } }) })
            .done(function(b) {
              expect(b.aId).to.be.eq(a1.id)
              done()
            })
        })
      })
    })

    describe('alias', function () {
      it("creates the join table when through is a string", function (done) {
        var self = this
          , User = this.sequelize.define('User', {})
          , Group = this.sequelize.define('Group', {})

        User.hasMany(Group, { as: 'MyGroups', through: 'group_user'})
        Group.hasMany(User, { as: 'MyUsers', through: 'group_user'})

        this.sequelize.sync({force:true}).success(function () {
          self.sequelize.getQueryInterface().showAllTables().success(function (result) {
             expect(result.indexOf('group_user')).not.to.equal(-1)
             done()
          })
        })
      })

      it("creates the join table when through is a model", function (done) {
        var self = this
          , User = this.sequelize.define('User', {})
          , Group = this.sequelize.define('Group', {})
          , UserGroup = this.sequelize.define('GroupUser', {}, {tableName: 'user_groups'})

        User.hasMany(Group, { as: 'MyGroups', through: UserGroup})
        Group.hasMany(User, { as: 'MyUsers', through: UserGroup})

        this.sequelize.sync({force:true}).success(function () {
           self.sequelize.getQueryInterface().showAllTables().success(function (result) {
             expect(result.indexOf('user_groups')).not.to.equal(-1)
             done()
          })
        })
      })

      it("correctly identifies its counterpart when through is a string", function (done) {
        var self = this
          , User = this.sequelize.define('User', {})
          , Group = this.sequelize.define('Group', {})

        User.hasMany(Group, { as: 'MyGroups', through: 'group_user'})
        Group.hasMany(User, { as: 'MyUsers', through: 'group_user'})

        expect(Group.associations.MyUsers.through === User.associations.MyGroups.through);
        expect(Group.associations.MyUsers.through.rawAttributes.UserId).to.exist;
        expect(Group.associations.MyUsers.through.rawAttributes.GroupId).to.exist;

        setTimeout(function () {
          done()
        }, 50)
      })

      it("correctly identifies its counterpart when through is a model", function (done) {
        var self = this
          , User = this.sequelize.define('User', {})
          , Group = this.sequelize.define('Group', {})
          , UserGroup = this.sequelize.define('GroupUser', {}, {tableName: 'user_groups'})

        User.hasMany(Group, { as: 'MyGroups', through: UserGroup})
        Group.hasMany(User, { as: 'MyUsers', through: UserGroup})

        expect(Group.associations.MyUsers.through === User.associations.MyGroups.through);

        expect(Group.associations.MyUsers.through.rawAttributes.UserId).to.exist;
        expect(Group.associations.MyUsers.through.rawAttributes.GroupId).to.exist;

        setTimeout(function () {
          done()
        }, 50)
      })
    })
  })

  describe("Foreign key constraints", function() {
    it("are not enabled by default", function(done) {
      var Task = this.sequelize.define('Task', { title: DataTypes.STRING })
        , User = this.sequelize.define('User', { username: DataTypes.STRING })

      User.hasMany(Task)

      User.sync({ force: true }).success(function() {
        Task.sync({ force: true }).success(function() {
          User.create({ username: 'foo' }).success(function(user) {
            Task.create({ title: 'task' }).success(function(task) {
              user.setTasks([task]).success(function() {
                user.destroy().success(function() {
                  Task.findAll().success(function(tasks) {
                    expect(tasks).to.have.length(1)
                    done()
                  })
                })
              })
            })
          })
        })
      })
    })

    it("can cascade deletes", function(done) {
      var Task = this.sequelize.define('Task', { title: DataTypes.STRING })
        , User = this.sequelize.define('User', { username: DataTypes.STRING })

      User.hasMany(Task, {onDelete: 'cascade'})

      User.sync({ force: true }).success(function() {
        Task.sync({ force: true }).success(function() {
          User.create({ username: 'foo' }).success(function(user) {
            Task.create({ title: 'task' }).success(function(task) {
              user.setTasks([task]).success(function() {
                user.destroy().success(function() {
                  Task.findAll().success(function(tasks) {
                    expect(tasks).to.have.length(0)
                    done()
                  })
                })
              })
            })
          })
        })
      })
    })

    it("can restrict deletes", function(done) {
      var Task = this.sequelize.define('Task', { title: DataTypes.STRING })
        , User = this.sequelize.define('User', { username: DataTypes.STRING })

      User.hasMany(Task, {onDelete: 'restrict'})

      User.sync({ force: true }).success(function() {
        Task.sync({ force: true }).success(function() {
          User.create({ username: 'foo' }).success(function(user) {
            Task.create({ title: 'task' }).success(function(task) {
              user.setTasks([task]).success(function() {
                user.destroy().error(function() {
                  // Should fail due to FK restriction
                  Task.findAll().success(function(tasks) {
                    expect(tasks).to.have.length(1)
                    done()
                  })
                })
              })
            })
          })
        })
      })
    })

    it("can cascade updates", function(done) {
      var Task = this.sequelize.define('Task', { title: DataTypes.STRING })
        , User = this.sequelize.define('User', { username: DataTypes.STRING })

      User.hasMany(Task, {onUpdate: 'cascade'})

      User.sync({ force: true }).success(function() {
        Task.sync({ force: true }).success(function() {
          User.create({ username: 'foo' }).success(function(user) {
            Task.create({ title: 'task' }).success(function(task) {
              user.setTasks([task]).success(function() {

                // Changing the id of a DAO requires a little dance since
                // the `UPDATE` query generated by `save()` uses `id` in the
                // `WHERE` clause

                var tableName = user.QueryInterface.QueryGenerator.addSchema(user.__factory)
                user.QueryInterface.update(user, tableName, {id: 999}, user.id)
                .success(function() {
                  Task.findAll().success(function(tasks) {
                    expect(tasks).to.have.length(1)
                    expect(tasks[0].UserId).to.equal(999)
                    done()
                  })
                })
              })
            })
          })
        })
      })
    })

    it("can restrict updates", function(done) {
      var Task = this.sequelize.define('Task', { title: DataTypes.STRING })
        , User = this.sequelize.define('User', { username: DataTypes.STRING })

      User.hasMany(Task, {onUpdate: 'restrict'})

      User.sync({ force: true }).success(function() {
        Task.sync({ force: true }).success(function() {
          User.create({ username: 'foo' }).success(function(user) {
            Task.create({ title: 'task' }).success(function(task) {
              user.setTasks([task]).success(function() {

                // Changing the id of a DAO requires a little dance since
                // the `UPDATE` query generated by `save()` uses `id` in the
                // `WHERE` clause

                var tableName = user.QueryInterface.QueryGenerator.addSchema(user.__factory)
                user.QueryInterface.update(user, tableName, {id: 999}, user.id)
                .error(function() {
                  // Should fail due to FK restriction
                  Task.findAll().success(function(tasks) {
                    expect(tasks).to.have.length(1)
                    done()
                  })
                })
              })
            })
          })
        })
      })
    })
  })

  describe("Association options", function() {
    it('can specify data type for autogenerated relational keys', function(done) {
      var User = this.sequelize.define('UserXYZ', { username: DataTypes.STRING })
        , dataTypes = [Sequelize.INTEGER, Sequelize.BIGINT, Sequelize.STRING]
        , self = this
        , Tasks = {}

      dataTypes.forEach(function(dataType) {
        var tableName = 'TaskXYZ_' + dataType.toString()
        Tasks[dataType] = self.sequelize.define(tableName, { title: DataTypes.STRING })

        User.hasMany(Tasks[dataType], { foreignKey: 'userId', keyType: dataType })

        Tasks[dataType].sync({ force: true }).success(function() {
          expect(Tasks[dataType].rawAttributes.userId.type.toString())
            .to.equal(dataType.toString())

          dataTypes.splice(dataTypes.indexOf(dataType), 1)
          if (!dataTypes.length) {
            done()
          }
        })
      })
    })

    it('infers the keyType if none provided', function(done) {
      var User = this.sequelize.define('User', {
        id: { type: DataTypes.STRING, primaryKey: true },
        username: DataTypes.STRING
      })
      , Task = this.sequelize.define('Task', {
        title: DataTypes.STRING
      })

      User.hasMany(Task)

      this.sequelize.sync({ force: true }).success(function() {
        expect(Task.rawAttributes.UserId.type.toString())
          .to.equal(DataTypes.STRING.toString())

        done()
      })
    })
  })
})
