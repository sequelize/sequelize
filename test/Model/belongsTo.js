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
    var num  = parseInt(Math.random() * 99999999)
    var User = sequelize.define('User' + num, { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + parseInt(Math.random() * 99999999), { title: Sequelize.STRING }, {underscored: true})
    
    Task.belongsTo(User)
    assert.eql(Task.attributes['user'+num+'_id'], "INT")
  },
  'it should correctly add the foreign id if foreignKey is passed': function() {
    var User = sequelize.define('User' + parseInt(Math.random() * 99999999), { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + parseInt(Math.random() * 99999999), { title: Sequelize.STRING })
    
    Task.belongsTo(User, {foreignKey: 'person_id'})
    assert.eql(Task.attributes['person_id'], "INT")
  },
  'it should define getter and setter': function() {
    var num  = parseInt(Math.random() * 99999999)
    var User = sequelize.define('User' + num, { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + parseInt(Math.random() * 99999999), { title: Sequelize.STRING })
    
    Task.belongsTo(User)
    
    var t = Task.build({title: 'asd'})
    assert.isDefined(t['setUser'+num])
    assert.isDefined(t['getUser'+num])
  },
  'it should define getter and setter according to passed as option': function() {
    var User = sequelize.define('User' + parseInt(Math.random() * 99999999), { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + parseInt(Math.random() * 99999999), { title: Sequelize.STRING })
    
    Task.belongsTo(User, {as: 'Person'})
    
    var t = Task.build({title: 'asd'})
    assert.isDefined(t.setPerson)
    assert.isDefined(t.getPerson)
  },
  'it should set the foreign id to null': function() {
    var num  = parseInt(Math.random() * 99999999)
    var User = sequelize.define('User' + num, { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + parseInt(Math.random() * 99999999), { title: Sequelize.STRING })
    
    Task.belongsTo(User)
    
    var t = Task.build({title: 'asd'})
    assert.isNull(t['User'+num+'Id'])
  },
  'it should set and get the correct object': function(exit) {
    var User = sequelize.define('User' + parseInt(Math.random() * 99999999), { username: Sequelize.STRING })
    var Task = sequelize.define('Task' + parseInt(Math.random() * 99999999), { title: Sequelize.STRING })
    
    Task.belongsTo(User, {as: 'User'})

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
    
    Task.belongsTo(User, {as: 'User'})
    
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