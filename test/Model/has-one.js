var assert = require("assert")
  , config = require("./../config")
  , Sequelize = require("./../../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false})

module.exports = {
  'it should correctly add the foreign id': function() {
    var num = parseInt(Math.random() * 99999999)
    var User = sequelize.define('User' + num, { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + parseInt(Math.random() * 99999999), { title: Sequelize.STRING })
    
    User.hasOne(Task)
    assert.eql(Task.attributes['User'+num+'Id'], "INT")
  },
  'it should correctly add the foreign id with underscore': function() {
    var num = parseInt(Math.random() * 99999999)
    var User = sequelize.define('User' + num, { username: Sequelize.STRING }, {underscored: true})
    var Task = sequelize.define('Task' + parseInt(Math.random() * 99999999), { title: Sequelize.STRING })
    
    User.hasOne(Task)
    assert.eql(Task.attributes['user'+num+'_id'], "INT")
  },
  'it should correctly add the foreign id when defining the foreignkey as option': function() {
    var num = parseInt(Math.random() * 99999999)
    var User = sequelize.define('User' + num, { username: Sequelize.STRING }, {underscored: true})
    var Task = sequelize.define('Task' + num, { title: Sequelize.STRING })
    
    User.hasOne(Task, {foreignKey: 'person_id'})
    assert.eql(Task.attributes.person_id, "INT")
  },
  'it should define getter and setter': function() {
    var num  = parseInt(Math.random() * 99999999)
    var User = sequelize.define('User' + num, { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + num, { title: Sequelize.STRING })
    
    User.hasOne(Task)
    
    var u = User.build({username: 'asd'})
    assert.isDefined(u['setTask'+num])
    assert.isDefined(u['getTask'+num])
  },
  'it should define getter and setter according to as option': function() {
    var num  = parseInt(Math.random() * 99999999)
    var User = sequelize.define('User' + num, { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + num, { title: Sequelize.STRING })
    
    User.hasOne(Task, {as: 'Task'})
    
    var u = User.build({username: 'asd'})
    assert.isDefined(u.setTask)
    assert.isDefined(u.getTask)
  },
  'it should set and get the correct objects': function(exit) {
    var User = sequelize.define('User' + parseInt(Math.random() * 99999999), { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + parseInt(Math.random() * 99999999), { title: Sequelize.STRING })
    
    User.hasOne(Task, {as: 'Task'})
    
    User.sync({force: true}).on('success', function() {
      Task.sync({force: true}).on('success', function() {
        User.create({username: 'name'}).on('success', function(user) {
          Task.create({title: 'snafu'}).on('success', function(task) {
            user.setTask(task).on('success', function() {
              user.getTask().on('success', function(task2) {
                assert.eql(task.title, task2.title)
                exit(function(){})
              })
            })
          })
        })
      })
    })
  }
}