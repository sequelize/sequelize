/* jshint camelcase: false */
var buster    = require("buster")
  , Helpers   = require('../buster-helpers')
  , Sequelize = require('../../index')
  , dialect   = Helpers.getTestDialect()
  , _         = require('lodash')
  , moment    = require('moment')

buster.spec.expose()
buster.testRunner.timeout = 1000

describe(Helpers.getTestDialectTeaser("HasMany"), function() {
  var sequelize = Helpers.createSequelizeInstance({dialect: dialect})

  before(function(done) {
    var self = this
    self.sequelize = Object.create(sequelize)
    Helpers.clearDatabase(this.sequelize, done)
  })

  afterAll(function(done) {
    Helpers.clearDatabase(sequelize, done)
  })

  describe('general usage', function() {
    before(function(done) {
      var self = this
      self.User = self.sequelize.define('User', { username: Helpers.Sequelize.STRING })
      self.Task = self.sequelize.define('Task', { title: Helpers.Sequelize.STRING })
      self.User.sync({ force: true }).success(function() {
        self.Task.sync({ force: true }).success(done)
      })
    })

    describe('mono-directional', function() {
      it("adds the foreign key", function(done) {
        var self = this
        self.User.hasMany(self.Task)
        expect(self.Task.attributes.UserId).toEqual("INTEGER")
        done()
      })

      it('adds the foreign key with underscore', function(done) {
        var self = Object.create(this.sequelize)
          , User = self.define('User', { username: Helpers.Sequelize.STRING })
          , Task = self.define('Task', { title: Helpers.Sequelize.STRING }, { underscored: true })

        Task.hasMany(User)

        expect(User.attributes.task_id).toBeDefined()
        done()
      })

      it('uses the passed foreign key', function(done) {
        var self = this
        self.User.hasMany(self.Task, { foreignKey: 'person_id' })
        expect(self.Task.attributes.person_id).toEqual("INTEGER")
        done()
      })

      it('defines getters and setters', function(done) {
        var self = this
        self.User.hasMany(self.Task)

        var u = self.User.build({username: 'asd'})
        expect(u.setTasks).toBeDefined()
        expect(u.getTasks).toBeDefined()
        done()
      })

      it("defines getters and setters according to the 'as' option", function(done) {
        var self = this
        self.User.hasMany(self.Task, {as: 'Tasks'})
        var u = self.User.build({username: 'asd'})

        expect(u.setTasks).toBeDefined()
        expect(u.getTasks).toBeDefined()
        done()
      })

      it("sets and gets associated objects", function(done) {
        var self = this

        self.User.hasMany(self.Task, { as: 'Tasks' })
        self.User.sync({ force: true }).success(function() {
          self.Task.sync({ force: true }).success(function() {
            self.User.create({username: 'name'}).success(function(user) {
              self.Task.create({title: 'task1'}).success(function(task1) {
                self.Task.create({title: 'task2'}).success(function(task2) {
                  user.setTasks([task1, task2]).success(function() {
                    user.getTasks().success(function(tasks) {
                      expect(tasks.length).toEqual(2)
                      user.getTasks({attributes: ['title']}).success(function(tasks) {
                        expect(tasks[0].selectedValues.title).toEqual('task1')
                        expect(tasks[0].selectedValues.id).not.toBeDefined()
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

    it("should allow selfAssociation to be single linked (only one DAO is created)", function(done) {
      var self = Object.create(this.sequelize)
        , oldLength = self.daoFactoryManager.daos.length
        , Comment = self.define('Comment', { content: Helpers.Sequelize.STRING })

      Comment.belongsTo(Comment, {as: "Parent"});
      Comment.hasMany(Comment, {as: 'Children', foreignKey: "ParentId", useJunctionTable: false})

      expect(self.daoFactoryManager.daos.length).toEqual(oldLength + 1)

      Comment.sync({ force: true }).success(function() {
        Comment.create({ content: 'parentComment' }).success(function(parent) {
          Comment.create({ content: 'child1' }).success(function(child1) {
            child1.setParent(parent).success(function() {
              Comment.create({ content: 'child2' }).success(function(child2) {
                child2.setParent(parent).success(function() {
                  Comment.find({where: { content: 'parentComment' }}).success(function(parent) {
                    parent.getChildren().success(function(children) {
                      expect(children.length).toEqual(2)
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

    it("should still use many to many for selfAssociation by default (two DAOs are created)", function() {
      var self = this
        , oldLength = self.sequelize.daoFactoryManager.daos.length
        , Comment   = self.sequelize.define('Comment', { content: Sequelize.STRING })

      Comment.belongsTo(Comment, {as: "Parent"})
      Comment.hasMany(Comment, {as: 'Children'})

      expect(self.sequelize.daoFactoryManager.daos.length).toEqual(oldLength + 2)
    })

    describe('bi-directional', function() {
      it('adds the foreign key', function(done) {
        var self = Object.create(this.sequelize)
          , selfx = this

        selfx.Task.hasMany(selfx.User)
        selfx.User.hasMany(selfx.Task)

        expect(selfx.Task.attributes.UserId).not.toBeDefined()
        expect(selfx.User.attributes.UserId).not.toBeDefined()

        var daos = self.daoFactoryManager.daos.filter(function(dao) {
          return (dao.tableName == (selfx.Task.tableName + selfx.User.tableName))
        })

        daos.forEach(function(dao) {
          expect(dao.attributes.UserId).toBeDefined()
          expect(dao.attributes.TaskId).toBeDefined()
        })
        done()
      })

      it("adds the foreign key with underscores", function(done) {
        var self = Object.create(this.sequelize)
          , User = self.define('User', { username: Helpers.Sequelize.STRING }, { underscored: true })
          , Task = self.define('Task', { title: Helpers.Sequelize.STRING })

        Task.hasMany(User)
        User.hasMany(Task)

        expect(Task.attributes.user_id).not.toBeDefined()
        expect(User.attributes.user_id).not.toBeDefined()

        var daos = self.daoFactoryManager.daos.filter(function(dao) {
          return (dao.tableName == (Task.tableName + User.tableName))
        })

        daos.forEach(function(dao) {
          expect(dao.attributes.user_id).toBeDefined()
          expect(dao.attributes.TaskId).toBeDefined()
        })
        done()
      })

      it("uses the passed foreign keys", function(done) {
        var self = Object.create(this.sequelize)
          , selfx = this

        this.User.hasMany(this.Task, { foreignKey: 'person_id' })
        this.Task.hasMany(this.User, { foreignKey: 'work_item_id' })

        var daos = self.daoFactoryManager.daos.filter(function(dao) {
          return (dao.tableName == (selfx.Task.tableName + selfx.User.tableName))
        })

        daos.forEach(function(dao) {
          expect(dao.attributes.person_id).toBeDefined()
          expect(dao.attributes.work_item_id).toBeDefined()
        })
        done()
      })

      it("defines getters and setters", function(done) {
        this.User.hasMany(this.Task)
        this.Task.hasMany(this.User)

        var u = this.User.build({ username: 'asd' })
        expect(u.setTasks).toBeDefined()
        expect(u.getTasks).toBeDefined()

        var t = this.Task.build({ title: 'foobar' })
        expect(t.setUsers).toBeDefined()
        expect(t.getUsers).toBeDefined()
        done()
      })

      it("defines getters and setters according to the 'as' option", function(done) {
        this.User.hasMany(this.Task, { as: 'Tasks' })
        this.Task.hasMany(this.User, { as: 'Users' })

        var u = this.User.build({ username: 'asd' })
        expect(u.setTasks).toBeDefined()
        expect(u.getTasks).toBeDefined()

        var t = this.Task.build({ title: 'asd' })
        expect(t.setUsers).toBeDefined()
        expect(t.getUsers).toBeDefined()
        done()
      })

      it("sets and gets the corrected associated objects", function(done) {
        var self = this
        var users = []
          , tasks = []

        this.User.hasMany(this.Task, {as: 'Tasks'})
        this.Task.hasMany(this.User, {as: 'Users'})

        self.User.sync({ force: true }).success(function() {
          self.Task.sync({ force: true }).success(function() {
            self.User.create({username: 'name'}).success(function(user1) {
              self.User.create({username: 'name2'}).success(function(user2) {
                self.Task.create({title: 'task1'}).success(function(task1) {
                  self.Task.create({title: 'task2'}).success(function(task2) {
                    users.push(user1)
                    users.push(user2)
                    tasks.push(task1)
                    tasks.push(task2)

                    users[0].setTasks(tasks).success(function() {
                      users[0].getTasks().success(function(_tasks) {
                        expect(_tasks.length).toEqual(2)

                        tasks[1].setUsers(users).success(function() {
                          tasks[1].getUsers().success(function(_users) {
                            expect(users.length).toEqual(2)
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
      })
    })

    it("build the connector daos name", function(done) {
      var self = Object.create(this.sequelize)
        , Person = self.define('Person', { name: Helpers.Sequelize.STRING })

      Person.hasMany(Person, {as: 'Children'})
      Person.hasMany(Person, {as: 'Friends'})
      Person.hasMany(Person, {as: 'CoWorkers'})

      Person.sync({ force: true }).success(function() {
        var daoNames  = self.daoFactoryManager.daos.map(function(dao) { return dao.tableName })
          , expectation = ["Persons", "ChildrenPersons", "CoWorkersPersons", "FriendsPersons"]

        expectation.forEach(function(ex) {
          expect(daoNames.indexOf(ex) > -1).toBeTruthy()
        })

        done()
      })
    })

    it("allows join table to be specified", function(done) {
      var Child = this.sequelize.define('Child', { name: Helpers.Sequelize.STRING }, {underscore: true, freezeTableName: true})
        , Parent = this.sequelize.define('Parent', { name: Helpers.Sequelize.STRING }, {underscore: true, freezeTableName: true})
        , ParentJoin = this.sequelize.define('ParentRelationship', { parent_id: Helpers.Sequelize.INTEGER, child_id: Helpers.Sequelize.INTEGER }, {underscore: true, freezeTableName: true})
        , parents = []

      Parent.hasMany(Child, {as: 'Children', foreignKey: 'child_id', joinTableName: 'ParentRelationship'})
      Child.hasMany(Parent, {as: 'Parents', foreignKey: 'parent_id', joinTableName: 'ParentRelationship'})

      ParentJoin.sync({ force: true }).success(function() {
        Parent.sync({ force: true }).success(function() {
          Child.sync({ force: true }).success(function() {
            Parent.create({name: 'mom'}).success(function(mom) {
              parents.push(mom)
              Parent.create({name: 'dad'}).success(function(dad) {
                parents.push(dad)
                Child.create({name: 'baby'}).success(function(baby) {
                  baby.setParents(parents).success(function(){
                    parents[0].getChildren().success(function(children){
                      expect(children).not.toBe(null)
                      expect(children.length).toBeDefined()
                      expect(children.length).toEqual(1)
                      expect(children[0]).toBeDefined()
                      expect(children[0].name).toEqual('baby')
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

    it("allows join table to be mapped and specified", function(done) {
      var User = this.sequelize.define('User', { name: Helpers.Sequelize.STRING }, {underscore: true, freezeTableName: true})
        , Company = this.sequelize.define('Company', { name: Helpers.Sequelize.STRING }, {underscore: true, freezeTableName: true})
        , CompanyAccess = this.sequelize.define('CompanyAccess', { company_id: Helpers.Sequelize.INTEGER, user_id: Helpers.Sequelize.INTEGER, permission: Helpers.Sequelize.STRING }, {underscore: true, freezeTableName: true})
        , companies = []

      CompanyAccess.belongsTo(User, {as: 'User', foreignKey: 'user_id'})
      CompanyAccess.belongsTo(Company, {as: 'Company', foreignKey: 'company_id'})
      User.hasMany(Company, {as: 'Companies', foreignKey: 'user_id', joinTableName: 'CompanyAccess'})
      Company.hasMany(User, {as: 'Users', foreignKey: 'company_id', joinTableName: 'CompanyAccess'})

      User.sync({ force: true }).success(function() {
        Company.sync({ force: true }).success(function() {
          CompanyAccess.sync({ force: true }).success(function() {
            Company.create({name: 'IBM'}).success(function(ibm) {
              companies.push(ibm)
              Company.create({name: 'EA'}).success(function(ea) {
                companies.push(ea)
                User.create({name: 'joe@ibm.com'}).success(function(joe) {
                  joe.setCompanies(companies).success(function(){
                    User.find({where: {name: 'joe@ibm.com'}}).success(function(joe) {
                      expect(joe).not.toEqual(null)
                      joe.getCompanies().success(function(comps) {
                        expect(comps).not.toEqual(null)
                        expect(comps.length).toEqual(2)
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

    it("gets and sets the connector daos", function(done) {
      var self = this
        , Person = self.sequelize.define('Person', { name: Helpers.Sequelize.STRING })

      Person.hasMany(Person, {as: 'Children'})
      Person.hasMany(Person, {as: 'Friends'})
      Person.hasMany(Person, {as: 'CoWorkers'})

      Person.sync({ force: true }).success(function() {
        Person.create({name: 'foobar'}).success(function(person) {
          Person.create({name: 'friend'}).success(function(friend) {
            person.setFriends([friend]).success(function() {
              person.getFriends().success(function(friends) {
                expect(friends.length).toEqual(1)
                expect(friends[0].name).toEqual('friend')
                done()
              })
            })
          })
        })
      })
    })
  })

  describe('(1:N)', function() {
    describe('hasSingle', function() {
      before(function(done) {
        var self = this
        this.Article = this.sequelize.define('Article', {
          'title': Sequelize.STRING
        })
        this.Label   = this.sequelize.define('Label', {
          'text': Sequelize.STRING
        })

        this.Article.hasMany(this.Label)

        self.Article.sync({ force: true }).success(function() {
          self.Label.sync({ force: true }).success(done)
        })
      })

      it('does not have any labels assigned to it initially', function(done) {
        var chainer = new Sequelize.Utils.QueryChainer([
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
            expect(hasLabel1).toBeFalse()
            expect(hasLabel2).toBeFalse()
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
            expect(hasLabel1).toBeTrue()
            expect(hasLabel2).toBeFalse()
            done()
          })
        })
      })
    })

    describe('hasAll', function() {
      before(function(done) {
        var self = this
        this.Article = this.sequelize.define('Article', {
          'title': Sequelize.STRING
        })
        this.Label = this.sequelize.define('Label', {
          'text': Sequelize.STRING
        })

        this.Article.hasMany(this.Label)

        self.Article.sync({ force: true }).success(function() {
          self.Label.sync({ force: true }).success(done)
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
              expect(result).toBeFalse()
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
              expect(result).toBeTrue()
              done()
            })
          })
        })
      })
    })

    describe('setAssociations', function() {
      it("clears associations when passing null to the set-method", function(done) {
        var self = Object.create(this.sequelize)
          , User = self.define('User', { username: Sequelize.STRING })
          , Task = self.define('Task', { title: Sequelize.STRING })

        Task.hasMany(User)

        User.sync({ force: true }).success(function() {
          Task.sync({ force: true }).success(function() {
            User.create({ username: 'foo' }).success(function(user) {
              Task.create({ title: 'task' }).success(function(task) {
                task.setUsers([ user ]).success(function() {
                  task.getUsers().success(function(_users) {
                    expect(_users.length).toEqual(1)
                    task.setUsers(null).success(function() {
                      task.getUsers().success(function(_users) {
                        expect(_users.length).toEqual(0)
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
      var self = Object.create(this.sequelize)
      self.options.omitNull = true

      var User = self.define('User', { username: Sequelize.STRING })
        , Task = self.define('Task', { title: Sequelize.STRING })

      Task.hasMany(User)

      User.sync({ force: true }).success(function() {
        Task.sync({ force: true }).success(function() {
          User.create({ username: 'foo' }).success(function(user) {
            Task.create({ title: 'task' }).success(function(task) {
              task.setUsers([ user ]).success(function() {
                task.getUsers().success(function(_users) {
                  expect(_users.length).toEqual(1)
                  task.setUsers(null).success(function() {
                    task.getUsers().success(function(_users) {
                      expect(_users.length).toEqual(0)
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
      before(function(done) {
        var self = this

        self.User = self.sequelize.define('User', { username: Sequelize.STRING })
        self.Task = self.sequelize.define('Task', { title: Sequelize.STRING, active: Sequelize.BOOLEAN })

        self.User.hasMany(self.Task)

        self.User.sync({ force: true }).done(function() {
          self.Task.sync({ force: true }).success(function() {
            var chainer = new Sequelize.Utils.QueryChainer([
              self.User.create({ username: 'John'}),
              self.Task.create({ title: 'Get rich', active: true}),
              self.Task.create({ title: 'Die trying', active: false})
            ])

            chainer.run().success(function (results, john, task1, task2) {
              john.setTasks([task1, task2]).success(done)
            })
          })
        })
      })

      it('should treat the where object of associations as a first class citizen', function(done) {
        var self = this
        this.Article = this.sequelize.define('Article', {
          'title': Sequelize.STRING
        })
        this.Label = this.sequelize.define('Label', {
          'text': Sequelize.STRING,
          'until': Sequelize.DATE
        })

        this.Article.hasMany(this.Label)

        self.Article.sync({ force: true }).success(function() {
          self.Label.sync({ force: true }).success(function() {
            var chainer = new Sequelize.Utils.QueryChainer([
              self.Article.create({ title: 'Article' }),
              self.Label.create({ text: 'Awesomeness', until: '2014-01-01 01:00:00' }),
              self.Label.create({ text: 'Epicness', until: '2014-01-03 01:00:00' })
            ])

            chainer.run().success(function(results, article, label1, label2) {
              article.setLabels([label1, label2]).success(function() {
                article.getLabels({where: ['until > ?', moment('2014-01-02').toDate()]}).success(function(labels) {
                  expect(labels).toBeArray()
                  expect(labels.length).toEqual(1)
                  expect(labels[0].text).toEqual('Epicness')
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
            expect(tasks.length).toEqual(2)
            done()
          })
        })
      })

      it("only get objects that fulfill the options", function(done) {
        this.User.find({ where: { username: 'John' } }).success(function (john) {
          john.getTasks({ where: { active: true }, limit: 10, order: 'id DESC' }).success(function (tasks) {
            expect(tasks.length).toEqual(1)
            done()
          })
        })
      })
    })

    describe('optimizations using bulk create, destroy and update', function () {
      before(function(done) {
        var self = Object.create(this.sequelize)
          , selfx = this
        this.User = self.define('User', { username: Sequelize.STRING }, {timestamps: false})
        this.Task = self.define('Task', { title: Sequelize.STRING }, {timestamps: false})

        this.User.hasMany(this.Task)

        selfx.User.sync({ force: true }).success(function() {
          selfx.Task.sync({force: true}).success(done)
        })
      })

      it('uses one UPDATE statement', function(done) {
        var spy = this.spy()
          , self = this

        this.User.create({ username: 'foo' }).success(function(user) {
          self.Task.create({ title: 'task1' }).success(function(task1) {
            self.Task.create({ title: 'task2' }).success(function(task2) {
              user.setTasks([task1, task2]).on('sql', spy).on('sql', _.after(2, function (sql) { // We don't care about SELECT, only UPDAET
                expect(sql).toMatch("UPDATE")
                expect(sql).toMatch("IN (1,2)")
              })).success(function () {
                expect(spy).toHaveBeenCalledTwice() // Once for SELECT, once for UPDATE
                done()
              })
            })
          })
        })
      })

      it('uses one UPDATE statement', function(done) {
        var spy = this.spy()
          , self = this

        this.User.create({ username: 'foo' }).success(function (user) {
          self.Task.create({ title: 'task1' }).success(function (task1) {
            self.Task.create({ title: 'task2' }).success(function (task2) {
              user.setTasks([task1, task2]).success(function () {
                user.setTasks(null).on('sql', spy).on('sql', _.after(2, function (sql) { // We don't care about SELECT, only UPDATE
                  expect(sql).toMatch("UPDATE")
                  expect(sql).toMatch("IN (1,2)")
                })).success(function () {
                  expect(spy).toHaveBeenCalledTwice() // Once for SELECT, once for UPDATE
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
      before(function(done) {
        var self = Object.create(this.sequelize)
          , selfx = this

        selfx.User = self.define('User', { username: Sequelize.STRING })
        selfx.Task = self.define('Task', { title: Sequelize.STRING, active: Sequelize.BOOLEAN })

        selfx.User.hasMany(selfx.Task)
        selfx.Task.hasMany(selfx.User)

        selfx.User.sync({ force: true }).done(function() {
          selfx.Task.sync({ force: true }).success(function() {
            var chainer = new Sequelize.Utils.QueryChainer([
              selfx.User.create({ username: 'John'}),
              selfx.Task.create({ title: 'Get rich', active: true}),
              selfx.Task.create({ title: 'Die trying', active: false})
            ])

            chainer.run().success(function (results, john, task1, task2) {
              john.setTasks([task1, task2]).success(done)
            })
          })
        })
      })

      it("gets all associated objects when no options are passed", function(done) {
        this.User.find({where: {username: 'John'}}).success(function(john) {
          john.getTasks().success(function(tasks) {
            expect(tasks.length).toEqual(2)
            done()
          })
        })
      })

      it("only get objects that fulfill the options", function(done) {
        this.User.find({where: {username: 'John'}}).success(function(john) {
          john.getTasks({where: {active: true}}).success(function(tasks) {
            expect(tasks.length).toEqual(1)
            done()
          })
        })
      })

      it("only gets objects that fulfill options with a formatted value", function(done) {
        this.User.find({where: {username: 'John'}}).success(function(john) {
          john.getTasks({where: ['active = ?', true]}).success(function(tasks) {
            expect(tasks.length).toEqual(1)
            done()
          })
        })
      })
    })

    it("removes the reference id, which was added in the first place", function(done) {
      var self = Object.create(this.sequelize)
        , User = self.define('User', { username: Sequelize.STRING })
        , Task = self.define('Task', { title: Sequelize.STRING })

      User.hasMany(Task)
      expect(Task.attributes.UserId).toBeDefined()

      Task.hasMany(User)
      expect(Task.attributes.UserId).not.toBeDefined()
      done()
    })

    it("adds three items to the query chainer when calling sync", function(done) {
      var self = Object.create(this.sequelize)
        , User = self.define('User', { username: Sequelize.STRING })
        , Task = self.define('Task', { title: Sequelize.STRING })

      User.hasMany(Task)
      Task.hasMany(User)

      var add = this.spy()

      this.stub(Sequelize.Utils, 'QueryChainer').returns({ add: add, runSerially: function(){} })

      self.sync({ force: true })
      expect(add).toHaveBeenCalledThrice()
      done()
    })

    describe('setAssociations', function() {
      it("clears associations when passing null to the set-method", function(done) {
        var self = Object.create(this.sequelize)
          , User = self.define('User', { username: Sequelize.STRING })
          , Task = self.define('Task', { title: Sequelize.STRING })

        User.hasMany(Task)
        Task.hasMany(User)

        User.sync({ force: true }).success(function() {
          Task.sync({ force: true }).success(function() {
            User.create({ username: 'foo' }).success(function(user) {
              Task.create({ title: 'task' }).success(function(task) {
                task.setUsers([ user ]).success(function() {
                  task.getUsers().success(function(_users) {
                    expect(_users.length).toEqual(1)

                    task.setUsers(null).success(function() {
                      task.getUsers().success(function(_users) {
                        expect(_users.length).toEqual(0)
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
      it('uses one insert into statement', function(done) {
        var spy = this.spy()
          , selfx = Object.create(this.sequelize)
          , User = selfx.define('User', { username: Sequelize.STRING }, {timestamps: false})
          , Task = selfx.define('Task', { title: Sequelize.STRING }, {timestamps: false})

        User.hasMany(Task)
        Task.hasMany(User)

        User.sync({ force: true }).success(function() {
          Task.sync({ force: true }).success(function() {
            User.create({ username: 'foo' }).success(function(user) {
              Task.create({ title: 'task1' }).success(function(task1) {
                Task.create({ title: 'task2' }).success(function(task2) {
                  user.setTasks([task1, task2]).on('sql', spy).on('sql', _.after(2, function (sql) {
                    expect(sql).toMatch("INSERT INTO")
                    expect(sql).toMatch("VALUES (1,1),(2,1)")
                  })).success(function () {
                    expect(spy).toHaveBeenCalledTwice() // Once for SELECT, once for INSERT into
                    done()
                  })
                })
              })
            })
          })
        })
      })

      it('uses one delete from statement', function(done) {
        var spy = this.spy()
          , selfx = Object.create(this.sequelize)
          , User = selfx.define('User', { username: Sequelize.STRING }, {timestamps: false})
          , Task = selfx.define('Task', { title: Sequelize.STRING }, {timestamps: false})

        User.hasMany(Task)
        Task.hasMany(User)

        User.sync({ force: true }).success(function() {
          Task.sync({ force: true }).success(function() {
            User.create({ username: 'foo' }).success(function (user) {
              Task.create({ title: 'task1' }).success(function (task1) {
                Task.create({ title: 'task2' }).success(function (task2) {
                  user.setTasks([task1, task2]).success(function () {
                    user.setTasks(null).on('sql', spy).on('sql', _.after(2, function (sql) {
                      expect(sql).toMatch("DELETE FROM")
                      expect(sql).toMatch("IN (1,2)")
                    })).success(function () {
                      expect(spy).toHaveBeenCalledTwice() // Once for SELECT, once for DELETE
                      done()
                    })
                  })
                })
              })
            })
          })
        })
      })
    }) // end optimization using bulk create, destroy and update

    describe('join table creation', function () {
      before(function(done) {
        var self = this
        this.User = this.sequelize.define('User',
          { username: Sequelize.STRING },
          { tableName: 'users'}
        )
        this.Task = this.sequelize.define('Task',
          { title: Sequelize.STRING },
          { tableName: 'tasks' }
        )

        this.User.hasMany(this.Task,
          { joinTableName: 'user_has_tasks' }
        )
        this.Task.hasMany(this.User)

        self.User.sync({ force: true }).success(function() {
          self.Task.sync({force: true}).success(done)
        })
      })

      it('uses the specified joinTableName or a reasonable default', function(done) {
        var self = this
        for (var associationName in self.User.associations) {
          expect(associationName).not.toEqual(self.User.tableName)
          expect(associationName).not.toEqual(self.Task.tableName)

          var joinTableName = self.User.associations[associationName].options.joinTableName
          if (typeof joinTableName !== 'undefined') {
            expect(joinTableName).toEqual(associationName)
          }
          var tableName = self.User.associations[associationName].options.tableName
          if (typeof tableName !== 'undefined') {
            expect(tableName).toEqual(associationName)
          }
        }
        done()
      })
    })
  })

  describe("Association options", function() {
    it('can specify data type for autogenerated relational keys', function(done) {
      var self = Object.create(this.sequelize)
        , User = self.define('UserXYZ', { username: Sequelize.STRING })
        , dataTypes = [Sequelize.INTEGER, Sequelize.BIGINT, Sequelize.STRING]

      dataTypes.forEach(function(dataType) {
        var tableName = 'TaskXYZ_' + dataType.toString()
          , Task = self.define(tableName, { title: Sequelize.STRING })

        User.hasMany(Task, { foreignKey: 'userId', keyType: dataType })

        User.sync({ force: true }).success(function() {
          expect(Task.rawAttributes.userId.type.toString())
            .toEqual(dataType.toString())

          dataTypes.splice(dataTypes.indexOf(dataType), 1)
          if (!dataTypes.length) {
            done()
          }
        })
      })
    })
  })
})
