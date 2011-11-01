var assert = require("assert")
  , config = require("./../config")
  , Sequelize = require("./../../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, { logging: false, define: { charset: 'latin1' } })

module.exports = {
  'it should correctly determine equal objects': function(exit) {
    var User = sequelize.define('User' + config.rand(), { name: Sequelize.STRING, bio: Sequelize.TEXT })

    User.sync({force: true}).on('success', function() {
      User.create({name: 'hallo', bio: 'welt'}).on('success', function(u) {
        assert.eql(u.equals(u), true)
        exit(function(){})
      })
    })
  },
  'it should correctly work with different primary keys': function(exit) {
    var User = sequelize.define('User' + config.rand(), {
      foo: {type: Sequelize.STRING, primaryKey: true},
      bar: {type: Sequelize.STRING, primaryKey: true},
      name: Sequelize.STRING, bio: Sequelize.TEXT
    })

    User.sync({force: true, charset: 'latin1'}).on('success', function() {
      User.create({foo: '1', bar: '2', name: 'hallo', bio: 'welt'}).on('success', function(u) {
        assert.eql(u.equals(u), true)
        exit(function(){})
      }).on('failure', function(err) { console.log(err) })
    }).on('failure', function(err) { console.log(err) })
  },
  'equalsOneOf should work': function(exit) {
    var User = sequelize.define('User' + config.rand(), {
      foo: {type: Sequelize.STRING, primaryKey: true},
      bar: {type: Sequelize.STRING, primaryKey: true},
      name: Sequelize.STRING, bio: Sequelize.TEXT
    })

    User.sync({force: true}).on('success', function() {
      User.create({foo: '1', bar: '2', name: 'hallo', bio: 'welt'}).on('success', function(u) {
        assert.eql(u.equalsOneOf([u, {a:1}]), true)
        assert.eql(u.equalsOneOf([{b:2}, {a:1}]), false)
        exit(function(){})
      })
    })
  }
}
