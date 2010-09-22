var Sequelize = require(__dirname + "/../../lib/sequelize/Sequelize").Sequelize
var s = new Sequelize('sequelize_test', 'root', null, {disableLogging: true})
var Day = s.define('Day', { name: Sequelize.TEXT })

module.exports = {
  'constructor': function(assert) {
    assert.eql(Day.associations, [])
    assert.eql(Day.attributes, {"name": {type: "TEXT"},"createdAt": {type: "DATETIME", allowNull: false},"updatedAt": {type: "DATETIME", allowNull: false}})
    assert.eql(Day.tableName, 'Days')
  },
  'new': function(assert) {
    var day = new Day({name: 'asd'})
    assert.isNull(day.id)
    assert.eql(day.table, Day)
    assert.eql(day.name, 'asd')
    assert.isUndefined(new Day({name: 'asd', bla: 'foo'}).bla)
  },
  'sync should return the table class': function(assert, beforeExit) {
    var toBeTested = null
    Day.sync(function(_Day) { toBeTested = _Day })
    beforeExit(function() { assert.eql(toBeTested, Day) })
  },
  'drop should return the table class': function(assert, beforeExit) {
    var toBeTested = null
    Day.drop(function(_Day) { toBeTested = _Day })
    beforeExit(function() { assert.eql(toBeTested, Day) })
  },
  'sqlResultToObject returns the correct object': function(assert) {
    var SqlResultToObjectTest = s.define('SqlResultToObject', {name: Sequelize.STRING})
    var toBeTested = SqlResultToObjectTest.sqlResultToObject({
      id: 1,
      name: 'foo'
    })
    assert.equal(toBeTested instanceof SqlResultToObjectTest, true)
    assert.equal(toBeTested.id, 1)
    assert.equal(toBeTested.name, 'foo')
  },
  'identifier': function(assert) {
    assert.equal(s.define('Identifier', {}).identifier, 'identifierId')
  },
  'values': function(assert) {
    var day = new Day({name: 's'})
    assert.eql(day.values, { name: "s", createdAt: null, updatedAt: null})
  },
  'default values': function(assert) {
    var DefaultTest = s.define("DefaultTest", {
      aString: { type: Sequelize.STRING, allowNull: false, default: 'woot'},
      aNumber: { type: Sequelize.INTEGER, allowNull: true},
      aBoolean: { type: Sequelize.BOOLEAN, allowNull: false, default: false},
      aText: { type: Sequelize.TEXT, allowNull: true }
    }),
    instance = new DefaultTest({})

    assert.eql(instance.aString, 'woot')
    assert.isUndefined(instance.aNumber)
    assert.eql(instance.aBoolean, false)
    assert.isUndefined(instance.aText)
  }
}