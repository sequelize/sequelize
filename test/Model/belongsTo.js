var assert = require("assert")
  , config = require("./../config")
  , Sequelize = require("./../../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false})

module.exports = {
  'it should correctly add the foreign id': function() {
    var User = sequelize.define('User' + parseInt(Math.random() * 99999999), { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + parseInt(Math.random() * 99999999), { title: Sequelize.STRING })
    
    User.belongsTo('task', Task)
    assert.eql(User.attributes.taskId, "INT")
  },
  'it should correctly add the foreign id with underscore': function() {
    var User = sequelize.define('User' + parseInt(Math.random() * 99999999), { username: Sequelize.STRING }, {underscored: true})
    var Task = sequelize.define('Task' + parseInt(Math.random() * 99999999), { title: Sequelize.STRING })
    
    User.belongsTo('task', Task)
    assert.eql(User.attributes.task_id, "INT")
  },
  'it should define getter and setter': function() {
    var User = sequelize.define('User' + parseInt(Math.random() * 99999999), { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + parseInt(Math.random() * 99999999), { title: Sequelize.STRING })
    
    User.belongsTo('task', Task)
    
    var u = User.build({username: 'asd'})
    assert.isDefined(u.setTask)
    assert.isDefined(u.getTask)
  },
  'it should set and get the correct object': function(exit) {
    var User = sequelize.define('User' + parseInt(Math.random() * 99999999), { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + parseInt(Math.random() * 99999999), { title: Sequelize.STRING })
    
    User.belongsTo('task', Task)
    
    User.sync({force: true}).on('success', function() {
      Task.sync({force: true}).on('success', function() {
        User.create({username: 'asd'}).on('success', function(u) {
          Task.create({title: 'a task'}).on('success', function(t) {
            u.setTask(t).on('success', function() {
              u.getTask().on('success', function(task) {
                assert.eql(task.title, 'a task')
                exit(function(){})
              })
            })
          })
        })
      })
    })
  },
  'it should correctly delete associations': function(exit) {
    var User = sequelize.define('User' + parseInt(Math.random() * 99999999), { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + parseInt(Math.random() * 99999999), { title: Sequelize.STRING })
    
    User.belongsTo('task', Task)
    
    User.sync({force: true}).on('success', function() {
      Task.sync({force: true}).on('success', function() {
        User.create({username: 'asd'}).on('success', function(u) {
          Task.create({title: 'a task'}).on('success', function(t) {
            u.setTask(t).on('success', function() {
              u.getTask().on('success', function(task) {
                assert.eql(task.title, 'a task')
                u.setTask(null).on('success', function() {
                  u.getTask().on('success', function(task) {
                    assert.isNull(task)
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