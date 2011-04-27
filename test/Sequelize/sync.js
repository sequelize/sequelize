var assert = require("assert")
  , config = require("./../config")
  , Sequelize = require("./../../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false})

module.exports = {
  'it should sync all models - so instances can be created and saved to the database without failures': function(exit) {
    var Project = sequelize.define('project' + parseInt(Math.random() * 9999999999999999999), {
      title: Sequelize.STRING
    })
    var Task = sequelize.define('task' + parseInt(Math.random() * 99999999999999999), {
      title: Sequelize.STRING
    })
    
    sequelize.sync().on('success', function() {
      Project.create({title: 'bla'}).on('success', function() {
        Task.create({title: 'bla'}).on('success', function() {
          exit(function(){})
        })
      })
    })
  }
}