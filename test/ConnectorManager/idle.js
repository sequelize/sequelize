var assert = require("assert")
  , config = require("./../config")
  , Sequelize = require("./../../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false})
  
module.exports = {
  'it should work correctly after being idle': function(exit) {
    var User = sequelize.define('User', { username: Sequelize.STRING })
    
    User.sync({force: true}).on('success', function() {
      User.create({username: 'user1'}).on('success', function() {
        User.count().on('success', function(count) {
          assert.eql(count, 1)
          setTimeout(function() {
            User.count().on('success', function() { assert.eql(count, 1) })
            exit(function(){})
          }, 1000)
        })
      })
    })
  }
}