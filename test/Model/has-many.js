var assert = require("assert")
  , config = require("./../config")
  , Sequelize = require("./../../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false})

module.exports = {
  'it should correctly add the foreign id - monodirectional': function() {
    var num = config.rand()
    var User = sequelize.define('User' + num, { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + num, { title: Sequelize.STRING })
    
    User.hasMany(Task)
    assert.eql(Task.attributes['User'+num+'Id'], "INT")
  },
  'it should correctly add the foreign ids - bidirectional': function(exit) {
    var num = config.rand()
    var User = sequelize.define('User' + num, { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + num, { title: Sequelize.STRING })

    Task.hasMany(User)
    User.hasMany(Task)

    assert.isUndefined(Task.attributes['User'+num+'Id'])
    assert.isUndefined(User.attributes['User'+num+'Id'])

    sequelize.modelManager.models.forEach(function(model) {
      if(model.tableName == (Task.tableName + User.tableName)) {
        assert.isDefined(model.attributes['User'+num+'Id'])
        assert.isDefined(model.attributes['Task'+num+'Id'])
        exit(function(){})
      }
    }) 
  },
  'it should correctly add the foreign id with underscore - monodirectional': function() {
    var num = config.rand()
    var User = sequelize.define('User' + num, { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + num, { title: Sequelize.STRING}, {underscored: true})
    
    Task.hasMany(User)
    assert.isDefined(User.attributes['task'+ num +'_id'])
  },
  'it should correctly add the foreign id with underscore - bidirectional': function() {
    var num = config.rand()
    var User = sequelize.define('User' + num, { username: Sequelize.STRING }, {underscored: true})
    var Task = sequelize.define('Task' + num, { title: Sequelize.STRING })
    
    Task.hasMany(User)
    User.hasMany(Task)
    
    assert.isUndefined(Task.attributes['user'+ num +'_id'])
    assert.isUndefined(User.attributes['user'+ num +'_id'])

    sequelize.modelManager.models.forEach(function(model) {
      if(model.tableName == (Task.tableName + User.tableName)) {
        assert.isDefined(model.attributes['user'+ num +'_id'])
        assert.isDefined(model.attributes['Task'+ num +'Id'])
      }
    })
  },
  'it should correctly add the foreign id when defining the foreignkey as option - monodirectional': function() {
    var num = config.rand()
    var User = sequelize.define('User' + num, { username: Sequelize.STRING }, {underscored: true})
    var Task = sequelize.define('Task' + num, { title: Sequelize.STRING })
    
    User.hasMany(Task, {foreignKey: 'person_id'})
    assert.eql(Task.attributes.person_id, "INT")
  },
  'it should correctly add the foreign id when defining the foreignkey as option - bidirectional': function() {
    var num = config.rand()
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
    var num  = config.rand()
    var User = sequelize.define('User' + num, { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + num, { title: Sequelize.STRING })
    
    User.hasMany(Task)
    
    var u = User.build({username: 'asd'})
    assert.isDefined(u['setTask'+num+"s"])
    assert.isDefined(u['getTask'+num+"s"])
  },
  'it should define getter and setter - bidirectional': function() {
    var num  = config.rand()
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
    var num  = config.rand()
    var User = sequelize.define('User' + num, { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + num, { title: Sequelize.STRING })
    
    User.hasMany(Task, {as: 'Tasks'})
    
    var u = User.build({username: 'asd'})
    assert.isDefined(u.setTasks)
    assert.isDefined(u.getTasks)
  },
  'it should define getter and setter according to as option - bidirectional': function() {
    var num  = config.rand()
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
  },
  'it should set and get the correct objects - monodirectional': function(exit) {
    var User = sequelize.define('User' + config.rand(), { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + config.rand(), { title: Sequelize.STRING })
    
    User.hasMany(Task, {as: 'Tasks'})
    
    User.sync({force: true}).on('success', function() {
      Task.sync({force: true}).on('success', function() {
        User.create({username: 'name'}).on('success', function(user) {
          
          Task.create({title: 'task1'}).on('success', function(task1) {
            Task.create({title: 'task2'}).on('success', function(task2) {
              
              user.setTasks([task1, task2]).on('success', function() {
                user.getTasks().on('success', function(tasks) {
                  assert.eql(tasks.length, 2)
                  exit(function(){})
                })
              })
              
            })
          })
          
        })
      })
    })
  },
  'it should set and get the correct objects - bidirectional': function(exit) {
    var User = sequelize.define('User' + config.rand(), { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + config.rand(), { title: Sequelize.STRING })
    
    User.hasMany(Task, {as: 'Tasks'})
    Task.hasMany(User, {as: 'Users'})
    
    User.sync({force: true}).on('success', function() {
      Task.sync({force: true}).on('success', function() {
        User.create({username: 'name'}).on('success', function(user1) {
          User.create({username: 'name2'}).on('success', function(user2) {
            
            Task.create({title: 'task1'}).on('success', function(task1) {
              Task.create({title: 'task2'}).on('success', function(task2) {

                user1.setTasks([task1, task2]).on('success', function() {
                  user1.getTasks().on('success', function(tasks) {
                    assert.eql(tasks.length, 2)
                    
                    task2.setUsers([user1, user2]).on('success', function() {
                      task2.getUsers().on('success', function(users) {
                        assert.eql(users.length, 2)
                        exit(function(){})
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
  },
  'it should correctly build the connector model names': function(exit){
    var num    = config.rand()
      , Person = sequelize.define('Person' + num, { name: Sequelize.STRING })

    Person.hasMany(Person, {as: 'Children'})
    Person.hasMany(Person, {as: 'Friends'})
    Person.hasMany(Person, {as: 'CoWorkers'})
    
    Person.sync({force: true}).on('success', function() {
      var modelNames  = sequelize.modelManager.models.map(function(model) { return model.tableName })
        , expectation = ["Person" + num + "s", "ChildrenPerson" + num + "s", "CoWorkersPerson" + num + "s", "FriendsPerson" + num + "s"]

      expectation.forEach(function(ex) {
        assert.eql(modelNames.indexOf(ex) > -1, true)
      })
      
      exit(function(){})
    })
  },
  'it should correctly get and set the connected models': function(exit) {
    var num    = config.rand()
      , Person = sequelize.define('Person' + num, { name: Sequelize.STRING })

    Person.hasMany(Person, {as: 'Children'})
    Person.hasMany(Person, {as: 'Friends'})
    Person.hasMany(Person, {as: 'CoWorkers'})
    
    Person.sync({force: true}).on('success', function() {
      Person.create({name: 'foobar'}).on('success', function(person) {
        Person.create({name: 'friend'}).on('success', function(friend) {
          person.setFriends([friend]).on('success', function() {
            person.getFriends().on('success', function(friends) {
              assert.eql(friends.length, 1)
              assert.eql(friends[0].name, 'friend')
              exit(function(){})
            })
          })
        })
      })
    })
  }
}