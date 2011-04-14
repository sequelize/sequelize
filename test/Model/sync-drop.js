var assert = require("assert")
  , config = require("./../config")
  , Sequelize = require("./../../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false})
  , User = sequelize.define('User', { name: Sequelize.STRING, bio: Sequelize.TEXT })

module.exports = {
  'sync should work with correct database config': function(exit) {
    User.sync().on('success', function(){exit(function(){})})
  },
  'sync should fail with incorrect database config': function(exit) {
    var s = new Sequelize('foo', 'bar', null, {logging: false})
    var User2 = s.define('User', { name: Sequelize.STRING, bio: Sequelize.TEXT })
    User2.sync().on('failure', function(){exit(function(){})})
  },
  'drop should work': function(exit) {
    User.drop().on('success', function(){exit(function(){})})
  }
}