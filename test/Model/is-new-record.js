var assert = require("assert")
  , config = require("./../config")
  , Sequelize = require("./../../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false, define: { charset: 'latin1' }})

var initUsers = function(num, callback) {
  var User  = sequelize.define('User' + config.rand(), { name: Sequelize.STRING, bio: Sequelize.TEXT })
    , users = []

  User.sync({force: true}).on('success', function() {
    while(num--) users.push(User.build({name: 'user' + num, bio: 'foobar'}))
    callback(users, User)
  })
}

module.exports = {
  'build should not create database entries': function(exit) {
    initUsers(1, function(users, User) {
      assert.isNull(users[0].id)
      assert.eql(users[0].isNewRecord, true)
      exit(function(){})
    })
  },
  'should be false for saved objects': function(exit) {
    initUsers(1, function(users, User) {
      users[0].save().on('success', function(user) {
        assert.eql(user.isNewRecord, false)
        exit(function(){})
      })
    })
  },
  'should be false for created objects': function(exit) {
    initUsers(1, function(users, User) {
      User.create({name: 'user'}).on('success', function(user) {
        assert.eql(user.isNewRecord, false)
        exit(function(){})
      })
    })
  },
  'should be false for find': function(exit) {
    initUsers(1, function(users, User) {
      User.create({name: 'user'}).on('success', function(user) {
        User.find(user.id).on('success', function(user) {
          assert.eql(user.isNewRecord, false)
          exit(function(){})
        })
      })
    })
  },
  'should be false for findAll': function(exit) {
    var chainer = new Sequelize.Utils.QueryChainer

    initUsers(10, function(users, User) {
      users.forEach(function(user) {
        chainer.add(user.save())
      })
      chainer.run().on('success', function() {
        User.findAll().on('success', function(users) {
          users.forEach(function(u) {
            assert.eql(u.isNewRecord, false)
          })
          exit(function() {})
        })
      })
    })
  }
}
