var assert = require("assert")
  , config = require("./../config")
  , Sequelize = require("./../../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false})
  , User = sequelize.define('User' + config.rand(), { name: Sequelize.STRING, bio: Sequelize.TEXT })

module.exports = {
  'it should update the attributes': function(exit) {
    User.sync({force:true}).on('success', function() {
      User.create({name: 'snafu'}).on('success', function(user) {
        assert.eql(user.name, 'snafu')
        user.updateAttributes({name: 'foobar'}).on('success', function(user) {
          assert.eql(user.name, 'foobar')
          exit(function(){})
        })
      })
    })
  },
  'it should not set attributes which were not defined': function(exit) {
    User.sync({force:true}).on('success', function() {
      User.create({name: 'snafu'}).on('success', function(user) {
        user.updateAttributes({name: 'foobar', foo: 'bar'}).on('success', function(user) {
          assert.eql(user.name, 'foobar')
          assert.isUndefined(user.foo)
          exit(function(){})
        })
      })
    })
  },
  'it should not set primary keys or timestamps': function(exit) {
    var User = sequelize.define('User' + config.rand(), {
      name: Sequelize.STRING, bio: Sequelize.TEXT, identifier: {type: Sequelize.STRING, primaryKey: true}
    })

    User.sync({force:true}).on('success', function() {
      User.create({name: 'snafu', identifier: 'identifier'}).on('success', function(user) {
        var oldCreatedAt  = user.createdAt
          , oldIdentifier = user.identifier

        user.updateAttributes({name: 'foobar', createdAt: new Date(2000, 1, 1), identifier: 'another identifier'}).on('success', function(user) {
          assert.eql(user.createdAt, oldCreatedAt)
          assert.eql(user.identifier, oldIdentifier)
          exit(function(){})
        })
      })
    })
  },
  "it should use the primary keys in the where clause": function(exit) {
    var User = sequelize.define('User' + config.rand(), {
      name: Sequelize.STRING, bio: Sequelize.TEXT, identifier: {type: Sequelize.STRING, primaryKey: true}
    })

    User.sync({force:true}).on('success', function() {
      User.create({name: 'snafu', identifier: 'identifier'}).on('success', function(user) {
        var query = user.updateAttributes({name: 'foobar'})
        assert.match(query.sql, /WHERE `identifier`..identifier./)
        exit(function(){})
      })
    })
  }
}