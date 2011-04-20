var assert = require("assert")
  , config = require("./../config")
  , Sequelize = require("./../../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false})

module.exports = {
  'it should correctly add the foreign id - monodirectional': function() {
    var num = parseInt(Math.random() * 99999999)
    var User = sequelize.define('User' + num, { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + num, { title: Sequelize.STRING })
    
    User.hasMany(Task)
    assert.eql(Task.attributes['User'+num+'Id'], "INT")
  },
  'it should correctly add the foreign ids - bidirectional': function(exit) {
    var num = parseInt(Math.random() * 99999999)
    var User = sequelize.define('User' + num, { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + num, { title: Sequelize.STRING })

    Task.hasMany(User)
    User.hasMany(Task)
    
    assert.isUndefined(Task.attributes['User'+num+'Id'])
    assert.isUndefined(User.attributes['User'+num+'Id'])

    sequelize.modelManager.models.forEach(function(model) {
      if(model.tableName == (Task.tableName + User.tableName)) {
        exit(function(){})
      }
    }) 
  },
  'it should correctly add the foreign id with underscore - monodirectional': function() {
    var num = parseInt(Math.random() * 99999999)
    var User = sequelize.define('User' + num, { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + num, { title: Sequelize.STRING}, {underscored: true})
    
    Task.hasMany(User)
    assert.isDefined(User.attributes['task'+ num +'_id'])
  },
  'it should correctly add the foreign id with underscore - bidirectional': function() {
    var num = parseInt(Math.random() * 99999999)
    var User = sequelize.define('User' + num, { username: Sequelize.STRING }, {underscored: true})
    var Task = sequelize.define('Task' + parseInt(Math.random() * 99999999), { title: Sequelize.STRING })
    
    Task.hasMany(User)
    User.hasMany(Task)
    
    assert.isUndefined(Task.attributes['user'+ num +'_id'])
    assert.isUndefined(User.attributes['user'+ num +'_id'])

    sequelize.modelManager.models.forEach(function(model) {
      if(model.tableName == (Task.tableName + User.tableName)) {
        assert.isDefined(model.attributes['user'+ num +'_id'])
      }
    })
  },
  'it should correctly add the foreign id when defining the foreignkey as option - monodirectional': function() {
    var num = parseInt(Math.random() * 99999999)
    var User = sequelize.define('User' + num, { username: Sequelize.STRING }, {underscored: true})
    var Task = sequelize.define('Task' + num, { title: Sequelize.STRING })
    
    User.hasMany(Task, {foreignKey: 'person_id'})
    assert.eql(Task.attributes.person_id, "INT")
  },
  'it should correctly add the foreign id when defining the foreignkey as option - bidirectional': function() {
    var num = parseInt(Math.random() * 99999999)
    var User = sequelize.define('User' + num, { username: Sequelize.STRING }, {underscored: true})
    var Task = sequelize.define('Task' + num, { title: Sequelize.STRING })
    
    User.hasMany(Task, {foreignKey: 'person_id'})
    Task.hasMany(User, {foreignKey: 'work_item_id'})
    
    sequelize.modelManager.models.forEach(function(model) {
      if(model.tableName == (Task.tableName + User.tableName)) {
        assert.isDefined(model.attributes.person_id)
        assert.isDefined(model.attributes.work_item_id)
      }
    })
  },
  'it should define getter and setter - monodirectional': function() {
    var num  = parseInt(Math.random() * 99999999)
    var User = sequelize.define('User' + num, { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + num, { title: Sequelize.STRING })
    
    User.hasMany(Task)
    
    var u = User.build({username: 'asd'})
    assert.isDefined(u['setTask'+num+"s"])
    assert.isDefined(u['getTask'+num+"s"])
  },
  'it should define getter and setter - bidirectional': function() {
    var num  = parseInt(Math.random() * 99999999)
    var User = sequelize.define('User' + num, { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + num, { title: Sequelize.STRING })
    
    User.hasMany(Task)
    Task.hasMany(User)
    
    var u = User.build({username: 'asd'})
    assert.isDefined(u['setTask'+num+"s"])
    assert.isDefined(u['getTask'+num+"s"])
    
    var t = Task.build({title: 'foobar'})
    assert.isDefined(t['setUser'+num+'s'])
    assert.isDefined(t['getUser'+num+'s'])
  },
  'it should define getter and setter according to as option - monodirectional': function() {
    var num  = parseInt(Math.random() * 99999999)
    var User = sequelize.define('User' + num, { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + num, { title: Sequelize.STRING })
    
    User.hasMany(Task, {as: 'Tasks'})
    
    var u = User.build({username: 'asd'})
    assert.isDefined(u.setTasks)
    assert.isDefined(u.getTasks)
  },
  'it should define getter and setter according to as option - bidirectional': function() {
    var num  = parseInt(Math.random() * 99999999)
    var User = sequelize.define('User' + num, { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + num, { title: Sequelize.STRING })
    
    User.hasMany(Task, {as: 'Tasks'})
    Task.hasMany(User, {as: 'Users'})
    
    var u = User.build({username: 'asd'})
    assert.isDefined(u.setTasks)
    assert.isDefined(u.getTasks)
    
    var t = Task.build({title: 'asd'})
    assert.isDefined(t.setUsers)
    assert.isDefined(t.getUsers)
  }/*,
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
  }*/
}