var assert = require("assert")
  , config = require("./../config")
  , Sequelize = require("./../../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false})

var initUsers = function(callback) {
  var User = sequelize.define('User' + parseInt(Math.random() * 99999999), { name: Sequelize.STRING, bio: Sequelize.TEXT })
  User.sync({force: true}).on('success', function() {
    User.create({name: 'foo', bio: 'foobar'}).on('success', function() {
      User.create({name: 'bar', bio: 'foobar'}).on('success', function(user) {
        callback(user, User)
      })
    })
  })
}


module.exports = {
  'all should return all created models': function(beforeExit) {
    initUsers(function(user, User) {
      User.all.on('success', function(users) {
        assert.eql(users.length, 2)
        beforeExit()
      })
    })
  },
  'find should return a single model': function(beforeExit) {
    initUsers(function(lastInsertedUser, User) {
      User.find(lastInsertedUser.id).on('success', function(user) {
        assert.eql(user.id, lastInsertedUser.id)
        beforeExit()
      })
    })
  }
}