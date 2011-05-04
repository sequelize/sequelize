var assert = require("assert")
  , config = require("./../config")
  , Sequelize = require("./../../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false})
  
module.exports = {
  'it should correctly count all objects': function(exit) {
    var User = sequelize.define('User', { username: Sequelize.STRING })
    User.sync({force: true}).on('success', function() {
      User.create({username: 'user1'}).on('success', function() {
        User.create({username: 'user2'}).on('success', function() {
          User.count().on('success', function(count) {
            assert.eql(count, 2)
            exit(function(){})
          })
        })
      })
    })
  },
  'it should correctly count filtered objects': function(exit) {
    var User = sequelize.define('User', { username: Sequelize.STRING })
    User.sync({force: true}).on('success', function() {
      User.create({username: 'user1'}).on('success', function() {
        User.create({username: 'foo'}).on('success', function() {
          User.count({where: "username LIKE '%us%'"}).on('success', function(count) {
            assert.eql(count, 1)
            exit(function(){})
          })
        })
      })
    })
  }
}