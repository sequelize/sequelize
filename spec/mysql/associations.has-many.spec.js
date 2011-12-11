var config    = require("../config/config")
  , Sequelize = require("../../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, { logging: false })
  , Helpers   = new (require("../config/helpers"))(sequelize)

describe('HasMany', function() {
  beforeEach(function() { Helpers.sync() })
  afterEach(function() { Helpers.drop() })

  var User  = sequelize.define('User' + Math.random(), { name: Sequelize.STRING })
    , Task  = sequelize.define('Task' + Math.random(), { name: Sequelize.STRING })
    , users = null
    , tasks = null

  User.hasMany(Task, {as:'Tasks'})
  Task.hasMany(User, {as:'Users'})

  beforeEach(function() {
    Helpers.async(function(_done) {
      Helpers.Factories.Model(User.name, {name: 'User' + Math.random()}, function(_users) {
        users = _users; _done()
      }, 5)
    })
    Helpers.async(function(_done) {
      Helpers.Factories.Model(Task.name, {name: 'Task' + Math.random()}, function(_tasks) {
        tasks = _tasks; _done()
      }, 2)
    })
  })

  describe('addModel / getModel', function() {
    var user = null
      , task = null

    beforeEach(function() {
      Helpers.async(function(done) {
        User.all().on('success', function(_users) {
          Task.all().on('success', function(_tasks) {
            user = _users[0]
            task = _tasks[0]

            done()
          })
        })
      })
    })

    it('should correctly add an association to the model', function() {
      Helpers.async(function(done) {
        user.getTasks().on('success', function(_tasks) {
          expect(_tasks.length).toEqual(0)
          user.addTask(task).on('success', function() {
            user.getTasks().on('success', function(_tasks) {
              expect(_tasks.length).toEqual(1)
              done()
            })
          })
        })
      })
    })
  })

  describe('removeModel', function() {
    var user  = null
      , tasks = null

    beforeEach(function() {
      Helpers.async(function(done) {
        User.all().on('success', function(users) {
          Task.all().on('success', function(_tasks) {
            user = users[0]
            tasks = _tasks

            done()
          })
        })
      })
    })

    it("should correctly remove associated objects", function() {
      Helpers.async(function(done) {
        user.getTasks().on('success', function(__tasks) {
          expect(__tasks.length).toEqual(0)
          user.setTasks(tasks).on('success', function() {
            user.getTasks().on('success', function(_tasks) {
              expect(_tasks.length).toEqual(tasks.length)
              user.removeTask(tasks[0]).on('success', function() {
                user.getTasks().on('success', function(_tasks) {
                  expect(_tasks.length).toEqual(tasks.length - 1)
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
