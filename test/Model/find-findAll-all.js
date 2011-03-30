var assert = require("assert")
  , config = require("./../config")
  , Sequelize = require("./../../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false})
  , User = sequelize.define('User', { name: Sequelize.STRING, bio: Sequelize.TEXT })

module.exports = {
  'all should return all created models': function(beforeExit) {
    User.sync({force: true}).on('success', function() {
      User.create({name: 'foo', bio: 'foobar'}).on('success', function() {
        User.create({name: 'bar', bio: 'foobar'}).on('success', function() {
          User.all.on('success', function(users) {
            assert.eql(users.length, 2)
            beforeExit()
          })
        })
      })
    })
  },
  'find should return a single model': function(beforeExit) {
    beforeExit()
  }
}