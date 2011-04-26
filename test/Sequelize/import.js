var assert = require("assert")
  , config = require("./../config")
  , Sequelize = require("./../../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false})

module.exports = {
  'the import should work correctly': function() {
    var Project = sequelize.import(__dirname + "/../project")
    assert.isDefined(Project)
  }
}