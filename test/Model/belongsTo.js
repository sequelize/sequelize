var assert = require("assert")
  , config = require("./../config")
  , Sequelize = require("./../../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false})

module.exports = {
  'it should correctly add the foreign id': function() {
    var num  = parseInt(Math.random() * 99999999)
    var User = sequelize.define('User' + num, { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + parseInt(Math.random() * 99999999), { title: Sequelize.STRING })
    
    Task.belongsTo(User)
    assert.eql(Task.attributes['User'+num+'Id'], "INT")
  },
  'it should correctly add the foreign id with underscore': function() {
    var User = sequelize.define('User' + parseInt(Math.random() * 99999999), { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + parseInt(Math.random() * 99999999), { title: Sequelize.STRING }, {underscored: true})
    
    Task.belongsTo('user', User)
console.log(Task.attributes)
    assert.eql(Task.attributes.user_id, "INT")
  },
  'it should define getter and setter': function() {
    var User = sequelize.define('User' + parseInt(Math.random() * 99999999), { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + parseInt(Math.random() * 99999999), { title: Sequelize.STRING })
    
    Task.belongsTo('user', User)
    
    var t = Task.build({title: 'asd'})
    assert.isDefined(t.setUser)
    assert.isDefined(t.getUser)
  },
  'it should set the foreign id to null': function() {
    var User = sequelize.define('User' + parseInt(Math.random() * 99999999), { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + parseInt(Math.random() * 99999999), { title: Sequelize.STRING })
    
    Task.belongsTo('user', User)
    
    var t = Task.build({title: 'asd'})
    assert.isNull(t.userId)
  },
  'it should set and get the correct object': function(exit) {
    var User = sequelize.define('User' + parseInt(Math.random() * 99999999), { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + parseInt(Math.random() * 99999999), { title: Sequelize.STRING })
    
    Task.belongsTo('user', User)
    
    User.sync({force: true}).on('success', function() {
      Task.sync({force: true}).on('success', function() {
        User.create({username: 'asd'}).on('success', function(u) {
          Task.create({title: 'a task'}).on('success', function(t) {
            t.setUser(u).on('success', function() {
              t.getUser().on('success', function(user) {
                assert.eql(user.username, 'asd')
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
    
    Task.belongsTo('user', User)
    
    User.sync({force: true}).on('success', function() {
      Task.sync({force: true}).on('success', function() {
        User.create({username: 'asd'}).on('success', function(u) {
          Task.create({title: 'a task'}).on('success', function(t) {
            t.setUser(u).on('success', function() {
              t.getUser().on('success', function(user) {
                assert.eql(user.username, 'asd')
                t.setUser(null).on('success', function() {
                  t.getUser().on('success', function(user) {
                    assert.isNull(user)
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