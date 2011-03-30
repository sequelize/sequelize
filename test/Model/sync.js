var assert = require("assert")
  , config = require("./../config")
  , Sequelize = require("./../../index")
  , sequelize = new Sequelize(config.database, config.username, config.password)

module.exports = {
  'sync should work': function(beforeExit) {
    var User = sequelize.define('User', {
      name: Sequelize.STRING,
      bio: Sequelize.TEXT
    })
    User.sync().on('success', beforeExit)
  }
}