var assert = require("assert")
  , config = require("./../config")
  , Sequelize = require("./../../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false})

module.exports = {
  'save should add a record to the database': function(exit) {
    var User = sequelize.define('User' + parseInt(Math.random() * 99999999), { name: Sequelize.STRING, bio: Sequelize.TEXT })
    User.sync({force: true}).on('success', function() {
      var u = User.build({name: 'hallo', bio: 'welt'})
      User.all.on('success', function(users) {
        assert.eql(users.length, 0)
        u.save().on('success', function() {
          User.all.on('success', function(users) {
            assert.eql(users.length, 1)
            assert.eql(users[0].name, 'hallo')
            exit()
          })
        })
      })
    })
  }
}