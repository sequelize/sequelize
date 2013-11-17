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
      done()
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
                expect(sql).to.have.string("VALUES (1,1),(2,1)")
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

        this.User.hasMany(this.Task,
          { joinTableName: 'user_has_tasks' }
        )
        this.Task.hasMany(this.User)

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

          var joinTableName = this.User.associations[associationName].options.joinTableName
          if (typeof joinTableName !== 'undefined') {
            expect(joinTableName).to.equal(associationName)
          }
          var tableName = this.User.associations[associationName].options.tableName
          if (typeof tableName !== 'undefined') {
            expect(tableName).to.equal(associationName)
          }
        }
        done()
      })
    })

    describe('join table model', function () {
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
  })
})
