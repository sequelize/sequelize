var assert = require("assert")
  , config = require("./../config")
  , Sequelize = require("./../../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false})

module.exports = {
  'sync should work with correct database config': function(beforeExit) {
    var User = sequelize.define('User', {
      name: Sequelize.STRING,
      bio: Sequelize.TEXT
    })
    User.sync().on('success', beforeExit)
  },
  'sync should fail with incorrect database config': function(beforeExit) {
    var s = new Sequelize('foo', 'bar', null, {logging: false})
    var User = s.define('User', {
      name: Sequelize.STRING,
      bio: Sequelize.TEXT
    })
    User.sync().on('failure', beforeExit)
  },
  'drop should work': function(beforeExit) {
    var User = sequelize.define('User', {
      name: Sequelize.STRING,
      bio: Sequelize.TEXT
    })
    User.drop().on('success', beforeExit)
  }
}