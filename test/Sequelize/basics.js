var Sequelize = require(__dirname + "/../../lib/sequelize/Sequelize").Sequelize
var s = new Sequelize('sequelize_test', 'test', 'test')

module.exports = {
  'test constants': function(assert) {
    assert.isDefined(Sequelize.STRING)
    assert.isNotNull(Sequelize.STRING)
    assert.isDefined(Sequelize.TEXT)
    assert.isNotNull(Sequelize.TEXT)
    assert.isDefined(Sequelize.INTEGER)
    assert.isNotNull(Sequelize.INTEGER)
  },
  'the constructor sets config correctly': function(assert){
    assert.equal(s.config.database, 'sequelize_test')
    assert.equal(s.config.username, 'test')
    assert.equal(s.config.password, 'test')
  },
  'the constructor initializes empty tables hash': function(assert) {
    var s = new Sequelize('sequelize_test', 'test', 'test')
    assert.isDefined(s.tables)
    assert.isNotNull(s.tables)
    assert.eql(s.tables, {})
  },
  'define should return a function': function(assert){
    var Day = s.define('Day', { name: Sequelize.TEXT })
    assert.equal(typeof Day, 'function')
  },
  'define should add new table to tables': function(assert) {
    var Day = s.define('Day', { name: Sequelize.TEXT })
    assert.includes(Sequelize.Helper.Hash.keys(Day.sequelize.tables), 'Day')
  },
  'tableNames should be an empty array if no tables are specified': function(assert){
    var s2 = new Sequelize('sequelize_test', 'test', 'test')
    assert.deepEqual(s2.tableNames, [])
  },
  'tableNames should be no empty array if tables are specified': function(assert) {
    s.define('Day', { name: Sequelize.TEXT })
    assert.deepEqual(s.tableNames, ['Days'])
  },
  'sync: errors': function(assert, beforeExit) {
    var testIsFinished = false,
        sequelizeWithInvalidCredentials = new Sequelize('foo', 'bar', 'barfoos'),
        Fail = sequelizeWithInvalidCredentials.define('Fail', {})

    sequelizeWithInvalidCredentials.sync(function(errors) {
      assert.isDefined(errors)
      assert.equal(errors.length, 1)
      testIsFinished = true
    })
    beforeExit(function() { assert.equal(testIsFinished, true) })
  },
  'drop: errors': function(assert, beforeExit) {
    var testIsFinished = false,
        sequelizeWithInvalidCredentials = new Sequelize('foo', 'bar', 'barfoos'),
        Fail = sequelizeWithInvalidCredentials.define('Fail', {})

    sequelizeWithInvalidCredentials.drop(function(errors) {
      assert.isDefined(errors)
      assert.equal(errors.length, 1)
      testIsFinished = true
    })
    beforeExit(function() { assert.equal(testIsFinished, true) })
  }
}