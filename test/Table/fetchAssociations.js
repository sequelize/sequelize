var Sequelize = require(__dirname + "/../../lib/sequelize/Sequelize").Sequelize,
    s = new Sequelize('sequelize_test', 'root', null, {disableLogging: true}),
    Foo = s.define('Foo', { name: Sequelize.TEXT }),
    Bar = s.define('Bar', { nr: Sequelize.INTEGER })

module.exports = {
  'should have no fetchedAssociations first': function(assert, beforeExit) {
    var allowExit = false

    Foo.hasMany('bars', Bar, 'foos')
    Sequelize.chainQueries([{drop: s}, {sync: s}], function() {
      new Foo({name:'asd'}).save(function(foo) {
        assert.eql(foo.fetchedAssociations, {})
        allowExit = true
      })
    })

    beforeExit(function() { assert.eql(allowExit, true) })
  },

  'should have an empty array for each table association': function(assert, beforeExit) {
    var allowExit = false

    Foo.hasMany('bars', Bar, 'foos')
    Sequelize.chainQueries([{drop: s}, {sync: s}], function() {
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