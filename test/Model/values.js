var assert = require("assert")
  , config = require("./../config")
  , Sequelize = require("./../../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false})

var initUsers = function(num, callback) {
  var User  = sequelize.define('User' + config.rand(), { name: Sequelize.STRING, bio: Sequelize.TEXT }, {timestamps:false})
    , users = []
    
  User.sync({force: true}).on('success', function() {
    while(num--) users.push(User.build({name: 'user' + num, bio: 'foobar'}))
    callback(users, User)
  })
}

module.exports = {
  'build should not create database entries': function(exit) {
    initUsers(1, function(users, User) {
      assert.eql(users[0].values, {"name":"user0","bio":"foobar","id":null})
      exit(function(){})
    })
  }
}