var Sequelize = require(__dirname + "/../../lib/sequelize/Sequelize").Sequelize,
    s = new Sequelize('sequelize_test', 'root', null, {disableLogging: true}),
    Foo = s.define('Foo', { name: Sequelize.TEXT }),
    Bar = s.define('Bar', { nr: Sequelize.INTEGER })


module.exports = {
  'should store data inside the fetchedAssociations hash': function(assert, beforeExit) {
    var allowExit = false

    Foo.hasMany('bars', Bar, 'foos')
    Sequelize.chainQueries([{drop: s}, {sync: s}], function() {
      var foo = new Foo({name:'asd'})
      foo.save(function() {
        assert.eql(foo.fetchedAssociations, {})
        foo.fetchAssociations(function() {
          assert.eql(foo.fetchedAssociations, {bars: []})
          allowExit = true
        })
      })
    })

    beforeExit(function() { assert.eql(allowExit, true) })
  }
}