var assert = require("assert")
  , config = require("./../config")
  , Sequelize = require("./../../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false})

module.exports = {
  'destroy should delete a saved record from the database': function(exit) {
    var User = sequelize.define('User' + parseInt(Math.random() * 99999999), { name: Sequelize.STRING, bio: Sequelize.TEXT })
    User.sync({force: true}).on('success', function() {
      User.create({name: 'hallo', bio: 'welt'}).on('success', function(u) {
        User.all.on('success', function(users) {
          assert.eql(users.length, 1)
          u.destroy().on('success', function() {
            User.all.on('success', function(users) {
              assert.eql(users.length, 0)
              exit()
            })
          })
        })
      })
    })
  }
}