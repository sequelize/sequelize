var Sequelize = require(__dirname + "/../../lib/sequelize/Sequelize").Sequelize
  , config = require(__dirname + '/../config')
  , s      = new Sequelize(config.database, config.username, config.password, {disableLogging: true})
  , Foo    = s.define('Foo', { name: Sequelize.TEXT })
  , Bar    = s.define('Bar', { nr: Sequelize.INTEGER })
  , assert = require("assert")

module.exports = {
  'should have no fetchedAssociations first': function(beforeExit) {
    var allowExit = false
    
    Foo.hasMany('bars', Bar, 'foos')
    Sequelize.chainQueries({drop: s}, {sync: s}, function() {
      new Foo({name:'asd'}).save(function(foo) {
        assert.eql(foo.fetchedAssociations, {})
        allowExit = true
      })
    })

    beforeExit(function() { assert.eql(allowExit, true) })
  },

  'should have an empty array for each table association': function(beforeExit) {
    var allowExit = false

    Foo.hasMany('bars', Bar, 'foos')
    Sequelize.chainQueries({drop: s}, {sync: s}, function() {
      new Foo({name:'asd'}).save(function(foo) {
        foo.fetchAssociations(function() {
          assert.eql(foo.fetchedAssociations, {bars: []})
          allowExit = true
        })
      })
    })

    beforeExit(function() { assert.eql(allowExit, true) })
  }
}