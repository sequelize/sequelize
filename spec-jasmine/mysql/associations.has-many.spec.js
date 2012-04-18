var config    = require("../config/config")
  , Sequelize = require("../../index")
  , sequelize = new Sequelize(config.mysql.database, config.mysql.username, config.mysql.password, { pool: config.mysql.pool, logging: false })
  , Helpers   = new (require("../config/helpers"))(sequelize)

describe('HasMany', function() {
  beforeEach(function() { Helpers.sync() })
  afterEach(function() { Helpers.drop() })

  //prevent periods from occurring in the table name since they are used to delimit (table.column)
  var User  = sequelize.define('User' + Math.ceil(Math.random()*10000000), { name: Sequelize.STRING })
    , Task  = sequelize.define('Task' + Math.ceil(Math.random()*10000000), { name: Sequelize.STRING })
    , users = null
    , tasks = null

  User.hasMany(Task, {as:'Tasks'})
  Task.hasMany(User, {as:'Users'})

  beforeEach(function() {
    Helpers.async(function(_done) {
      Helpers.Factories.DAO(User.name, {name: 'User' + Math.random()}, function(_users) {
        users = _users; _done()
      }, 5)
    })
    Helpers.async(function(_done) {
      Helpers.Factories.DAO(Task.name, {name: 'Task' + Math.random()}, function(_tasks) {
        tasks = _tasks; _done()
      }, 2)
    })
  })

  describe('addDAO / getDAO', function() {
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

    it('should correctly add an association to the dao', function() {
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

  describe('removeDAO', function() {
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
