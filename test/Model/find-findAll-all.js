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
  'all should return all created models': function(exit) {
    initUsers(function(_, User) {
      User.all.on('success', function(users) {
        assert.eql(users.length, 2)
        exit()
      })
    })
  },
  'find should return a single model': function(exit) {
    initUsers(function(lastInsertedUser, User) {
      User.find(lastInsertedUser.id).on('success', function(user) {
        assert.eql(user.id, lastInsertedUser.id)
        exit()
      })
    })
  },
  'find a specific user': function(exit) {
    initUsers(function(u, User) {
      User.find({name: 'foo'}).on('success', function(user) {
        assert.eql(user.name, 'foo')
        exit()
      })
    })
  }
}