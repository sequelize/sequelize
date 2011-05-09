var assert = require("assert")
  , config = require("./../config")
  , Sequelize = require("./../../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false})

module.exports = {
  'destroy should delete a saved record from the database': function(exit) {
    var User = sequelize.define('User' + config.rand(), { name: Sequelize.STRING, bio: Sequelize.TEXT })
    User.sync({force: true}).on('success', function() {
      User.create({name: 'hallo', bio: 'welt'}).on('success', function(u) {
        User.all.on('success', function(users) {
          assert.eql(users.length, 1)
          u.destroy().on('success', function() {
            User.all.on('success', function(users) {
              assert.eql(users.length, 0)
              exit(function(){})
            })
          })
        })
      })
    })
  },
  'destroy should mark the record as deleted if paranoid is activated': function(exit) {
    var User = sequelize.define('User' + config.rand(), { name: Sequelize.STRING, bio: Sequelize.TEXT }, {paranoid:true})
    User.sync({force: true}).on('success', function() {
      User.create({name: 'asd', bio: 'asd'}).on('success', function(u) {
        assert.isNull(u.deletedAt)
        u.destroy().on('success', function(u) {
          assert.isNotNull(u.deletedAt)
          exit(function(){})
        })
      })
    })
  }
}