var assert = require("assert")
  , config = require("./../config")
  , Sequelize = require("./../../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false, define: { charset: 'latin1' }})


var initialize = function(options, callback) {
  options = options || {}
  options.taskCount = options.taskCount || 1
  options.userCount = options.userCount || 1

  var num  = config.rand()
    , User = sequelize.define('User' + num, { name: Sequelize.STRING })
    , Task = sequelize.define('Task' + num, { name: Sequelize.STRING })
    , chainer = new Sequelize.Utils.QueryChainer

  User.hasMany(Task, {as:'Tasks'})
  Task.hasMany(User, {as:'Users'})

  sequelize.sync({force: true}).on('success', function() {
    for(var i = 0; i < options.taskCount; i++)
      chainer.add(Task.create({name: 'task'+i}))
    for(var i = 0; i < options.userCount; i++)
      chainer.add(User.create({name: 'user'+i}))

    chainer.run().on('success', function() {
      callback(Task, User)
    })
  })
}


module.exports = {
  'it should correctly add an association to the model': function(exit) {
    initialize({taskCount:5, userCount:2}, function(Task, User) {
      User.all.on('success', function(users) {
        Task.all.on('success', function(tasks) {
          var user = users[0]

          user.getTasks().on('success', function(_tasks) {
            assert.eql(_tasks.length, 0)
            user.addTask(tasks[0]).on('success', function() {
              user.getTasks().on('success', function(_tasks) {
                assert.eql(_tasks.length, 1)
                exit(function(){})
              })
            })
          })

        })
      })
    })
  },
  'it should correctly remove associated objects': function(exit) {
    initialize({taskCount:5, userCount:2}, function(Task, User) {
      User.all.on('success', function(users) {
        Task.all.on('success', function(tasks) {
          var user = users[0]

          user.getTasks().on('success', function(_tasks) {
            assert.eql(_tasks.length, 0)
            user.setTasks(tasks).on('success', function() {
              user.getTasks().on('success', function(_tasks) {
                assert.eql(_tasks.length, tasks.length)

                user.removeTask(tasks[0]).on('success', function() {
                  user.getTasks().on('success', function(_tasks) {
                    assert.eql(_tasks.length, tasks.length - 1)
                    exit(function(){})
                  })
                })

              })
            })
          })

        })
      })
    })
  }
}
