var assert = require("assert")
  , config = require("./../config")
  , Sequelize = require("./../../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false, define: { charset: 'latin1' }})

module.exports = {
  'it should correctly add the foreign id': function() {
    var num = config.rand()
    var User = sequelize.define('User' + num, { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + num, { title: Sequelize.STRING })

    User.hasOne(Task)
    assert.eql(Task.attributes['User'+num+'Id'], "INT")
  },
  'it should correctly add the foreign id with underscore': function() {
    var num = config.rand()
    var User = sequelize.define('User' + num, { username: Sequelize.STRING }, {underscored: true})
    var Task = sequelize.define('Task' + num, { title: Sequelize.STRING })

    User.hasOne(Task)
    assert.eql(Task.attributes['user'+num+'_id'], "INT")
  },
  'it should correctly add the foreign id when defining the foreignkey as option': function() {
    var num = config.rand()
    var User = sequelize.define('User' + num, { username: Sequelize.STRING }, {underscored: true})
    var Task = sequelize.define('Task' + num, { title: Sequelize.STRING })

    User.hasOne(Task, {foreignKey: 'person_id'})
    assert.eql(Task.attributes.person_id, "INT")
  },
  'it should define getter and setter': function() {
    var num  = config.rand()
    var User = sequelize.define('User' + num, { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + num, { title: Sequelize.STRING })

    User.hasOne(Task)

    var u = User.build({username: 'asd'})
    assert.isDefined(u['setTask'+num])
    assert.isDefined(u['getTask'+num])
  },
  'it should define getter and setter according to as option': function() {
    var num  = config.rand()
    var User = sequelize.define('User' + num, { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + num, { title: Sequelize.STRING })

    User.hasOne(Task, {as: 'Task'})

    var u = User.build({username: 'asd'})
    assert.isDefined(u.setTask)
    assert.isDefined(u.getTask)
  },
  'it should set and get the correct objects': function(exit) {
    var User = sequelize.define('User' + config.rand(), { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + config.rand(), { title: Sequelize.STRING })

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
  },
  'it should correctly unset the obsolete objects': function(exit) {
    var User = sequelize.define('User' + config.rand(), { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + config.rand(), { title: Sequelize.STRING })

    User.hasOne(Task, {as: 'Task'})

    User.sync({force: true}).on('success', function() {
      Task.sync({force: true}).on('success', function() {
        User.create({username: 'name'}).on('success', function(user) {
          Task.create({title: 'snafu'}).on('success', function(task) {
            Task.create({title: 'another task'}).on('success', function(task2) {
              user.setTask(task).on('success', function() {
                user.getTask().on('success', function(_task) {
                  assert.eql(task.title, _task.title)
                  user.setTask(task2).on('success', function() {
                    user.getTask().on('success', function(_task2) {
                      assert.eql(task2.title, _task2.title)
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
  },
  'it should correctly associate with itself': function(exit) {
    var Person = sequelize.define('Person' + config.rand(), { name: Sequelize.STRING })

    Person.hasOne(Person, {as: 'Mother', foreignKey: 'MotherId'})
    Person.hasOne(Person, {as: 'Father', foreignKey: 'FatherId'})

    Person.sync({force: true}).on('success', function() {
      var p = Person.build()
      assert.isDefined(p.setFather)
      assert.isDefined(p.setMother)
      exit(function(){})
    })
  },
  'it should automatically set the foreignKey if it is a self association': function() {
    var num = config.rand()
    var Person = sequelize.define('Person' + num, { name: Sequelize.STRING })

    Person.hasOne(Person, {as: 'Mother'})
    assert.eql(Person.associations["MotherPerson"+num+"s"].options.foreignKey, 'MotherId')
  }
}
