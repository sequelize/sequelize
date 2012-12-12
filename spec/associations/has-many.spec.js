if (typeof require === 'function') {
  const buster    = require("buster")
      , Helpers   = require('../buster-helpers')
      , Sequelize = require('../../index')
      , dialect   = Helpers.getTestDialect()
}

buster.spec.expose()
buster.testRunner.timeout = 500

describe(Helpers.getTestDialectTeaser("HasMany"), function() {
  before(function(done) {
    var self = this

    Helpers.initTests({
      dialect: dialect,
      beforeComplete: function(sequelize) { self.sequelize = sequelize },
      onComplete: done
    })
  })

  describe('(1:N)', function() {
    describe('hasSingle', function() {
      before(function(done) {
        this.Article = this.sequelize.define('Article', { 'title': Sequelize.STRING })
        this.Label   = this.sequelize.define('Label', { 'text': Sequelize.STRING })

        this.Article.hasMany(this.Label)

        this.sequelize.sync({ force: true }).success(done)
      })

      it('does not have any labels assigned to it initially', function(done) {
        var self = this

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
        var self = this

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

          chainer.runSerially().success(function(_, label1, hasLabel1, hasLabel2) {
            expect(hasLabel1).toBeTrue()
            expect(hasLabel2).toBeFalse()
            done()
          })
        })
      })
    })

    describe('hasAll', function() {
      before(function(done) {
        this.Article = this.sequelize.define('Article', { 'title': Sequelize.STRING })
        this.Label = this.sequelize.define('Label', { 'text': Sequelize.STRING })

        this.Article.hasMany(this.Label)

        this.sequelize.sync({ force: true }).success(done)
      })

      it('answers false if only some labels have been assigned', function(done) {
        var self = this

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
        var self = this

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
        var User = this.sequelize.define('User', { username: Sequelize.STRING })
          , Task = this.sequelize.define('Task', { title: Sequelize.STRING })

        Task.hasMany(User)

        this.sequelize.sync({ force: true }).success(function() {
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

    it("clears associations when passing null to the set-method with omitNull set to true", function(done) {
      this.sequelize.options.omitNull = true

      var User = this.sequelize.define('User', { username: Sequelize.STRING })
        , Task = this.sequelize.define('Task', { title: Sequelize.STRING })

      Task.hasMany(User)

      this.sequelize.sync({ force: true }).success(function() {
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

    describe("getting assocations with options", function() {
      before(function(done) {
        var self = this;

        this.User = this.sequelize.define('User', { username: Sequelize.STRING })
        this.Task = this.sequelize.define('Task', { title: Sequelize.STRING, active: Sequelize.BOOLEAN })

        this.User.hasMany(self.Task)

        this.sequelize.sync({ force: true }).done(function() {
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

      it("gets all associated objects when no options are passed", function(done) {
        this.User.find({where: {username: 'John'}}).success(function (john) {
          john.getTasks().success(function (tasks) {
            expect(tasks.length).toEqual(2)
            done();
          })
        })
      })

      it("only get objects that fulfill the options", function(done) {
        this.User.find({ where: { username: 'John' } }).success(function (john) {
          john.getTasks({ where: { active: true }, limit: 10, order: 'id DESC' }).success(function (tasks) {
            expect(tasks.length).toEqual(1)
            done();
          })
        })
      })
    })
  })

  describe('(N:M)', function() {
    describe("getting assocations with options", function() {
      before(function(done) {
        var self = this;

        this.User = this.sequelize.define('User', { username: Sequelize.STRING })
        this.Task = this.sequelize.define('Task', { title: Sequelize.STRING, active: Sequelize.BOOLEAN })

        self.User.hasMany(self.Task)
        self.Task.hasMany(self.User)

        this.sequelize.sync({ force: true }).done(function() {
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

      it("gets all associated objects when no options are passed", function(done) {
        this.User.find({where: {username: 'John'}}).success(function (john) {
          john.getTasks().success(function (tasks) {
            expect(tasks.length).toEqual(2)
            done();
          })
        })
      })

      it("only get objects that fulfill the options", function(done) {
        this.User.find({where: {username: 'John'}}).success(function (john) {
          john.getTasks({where: {active: true}}).success(function (tasks) {
            expect(tasks.length).toEqual(1)
            done();
          })
        })
      })
    })

    it("removes the reference id, which was added in the first place", function() {
      var User = this.sequelize.define('User', { username: Sequelize.STRING })
        , Task = this.sequelize.define('Task', { title: Sequelize.STRING })

      User.hasMany(Task)
      expect(Task.attributes.UserId).toBeDefined()

      Task.hasMany(User)
      expect(Task.attributes.UserId).not.toBeDefined()
    })

    it("adds three items to the query chainer when calling sync", function() {
      var User = this.sequelize.define('User', { username: Sequelize.STRING })
        , Task = this.sequelize.define('Task', { title: Sequelize.STRING })

      User.hasMany(Task)
      Task.hasMany(User)

      var add = this.spy()

      this.stub(Sequelize.Utils, 'QueryChainer').returns({ add: add, run: function(){} })

      this.sequelize.sync({ force: true })
      expect(add).toHaveBeenCalledThrice()
    })

    describe('setAssociations', function() {
      it("clears associations when passing null to the set-method", function(done) {
        var User = this.sequelize.define('User', { username: Sequelize.STRING })
          , Task = this.sequelize.define('Task', { title: Sequelize.STRING })

        User.hasMany(Task)
        Task.hasMany(User)

        this.sequelize.sync({ force: true }).success(function() {
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
})
