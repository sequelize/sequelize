var assert = require("assert")
  , config = require("./../config")
  , Sequelize = require("./../../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false})

module.exports = {
  'save should add a record to the database': function(exit) {
    var User = sequelize.define('User' + config.rand(), { name: Sequelize.STRING, bio: Sequelize.TEXT })

    User.sync({force: true}).on('success', function() {
      var u = User.build({name: 'hallo', bio: 'welt'})
      User.all.on('success', function(users) {
        assert.eql(users.length, 0)
        u.save().on('success', function() {
          User.all.on('success', function(users) {
            assert.eql(users.length, 1)
            assert.eql(users[0].name, 'hallo')
            exit(function(){})
          })
        })
      })
    })
  },
  'save should update the timestamp updated_at': function(exit) {
    var User = sequelize.define('User' + config.rand(), { name: Sequelize.STRING, bio: Sequelize.TEXT })
    User.sync({force: true}).on('success', function() {
      var now = Date.now()
      // timeout is needed, in order to check the update of the timestamp
      setTimeout(function() {
        var u    = User.build({name: 'foo', bio: 'bar'})
          , uNow = u.updatedAt

        assert.eql(true, uNow.getTime() > now)

        setTimeout(function() {
          u.save().on('success', function() {
            assert.eql(true, uNow.getTime() < u.updatedAt.getTime())
            exit(function(){})
          })
        }, 100)
      }, 100)
    })
  }
}