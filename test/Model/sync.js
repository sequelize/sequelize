var assert = require("assert")
  , config = require("./../config")
  , Sequelize = require("./../../index")
  , sequelize = new Sequelize(config.database, config.username, config.password)

module.exports = {
  'sync should work with correct database config': function(beforeExit) {
    var User = sequelize.define('User', {
      name: Sequelize.STRING,
      bio: Sequelize.TEXT
    })
    User.sync().on('success', beforeExit)
  },
  'sync should fail with incorrect database config': function(beforeExit) {
    var s = new Sequelize('foo', 'bar', null)
    var User = s.define('User', {
      name: Sequelize.STRING,
      bio: Sequelize.TEXT
    })
    User.sync().on('failure', beforeExit)
  }
}