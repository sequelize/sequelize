var assert = require("assert")
  , config = require("./../config")
  , Sequelize = require("./../../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false})

var initUsers = function(num, callback) {
  var User  = sequelize.define('User' + parseInt(Math.random() * 99999999), { name: Sequelize.STRING, bio: Sequelize.TEXT })
    , users = []
    
  User.sync({force: true}).on('success', function() {
    while(num--) users.push(User.build({name: 'user' + num, bio: 'foobar'}))
    callback(users, User)
  })
}

module.exports = {
  'build should not create database entries': function(exit) {
    initUsers(10, function(users, User) {
      assert.eql(users.length, 10)
      User.all.on('success', function(users) {
        assert.eql(users.length, 0)
        exit(function(){})
      })
    })
  },
  'build should fill the object with default values': function() {
    var Task = sequelize.define('Task' + parseInt(Math.random() * 99999999), {
      title: {dataType: Sequelize.STRING, defaultValue: 'a task!'},
      foo: {dataType: Sequelize.INTEGER, defaultValue: 2},
      bar: {dataType: Sequelize.DATE},
      foobar: {dataType: Sequelize.TEXT, defaultValue: 'asd'}
    })
    assert.eql(Task.build().title, 'a task!')
    assert.eql(Task.build().foo, 2)
    assert.eql(Task.build().bar, null)
    assert.eql(Task.build().foobar, 'asd')
  }
}