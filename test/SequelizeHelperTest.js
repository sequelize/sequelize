var Sequelize = require(__dirname + "/../lib/sequelize/Sequelize").Sequelize
var h = Sequelize.Helper

module.exports = {
  'log should be defined': function(assert) {
    assert.isNotNull(h.log)
    assert.isDefined(h.log)
  },
  
  'evaluateTemplate': function(assert) {
    assert.equal(h.evaluateTemplate("hallo %{foo}!", {foo: 'welt'}), "hallo welt!")
    assert.equal(h.evaluateTemplate("hallo %{foo}!", {foo: 'welt', bar: 'asd'}), "hallo welt!")
  },
  
  'SQL: manyToManyTableName': function(assert) {
    assert.equal(h.SQL.manyToManyTableName('foo', 'bar'), 'BarFoo')
    assert.equal(h.SQL.manyToManyTableName('bar','foo'), 'BarFoo')
  },
  'SQL: asTableIdentifier': function(assert) {
    assert.equal(h.SQL.asTableIdentifier('Users'), 'userId')
    assert.equal(h.SQL.asTableIdentifier('Children'), 'childId')
    assert.equal(h.SQL.asTableIdentifier('Children'), 'childId')
    assert.equal(h.SQL.asTableIdentifier('Mice'), 'mouseId')
  },
  'SQL: asTableName': function(assert) {
    assert.equal(h.SQL.asTableName('User'), 'Users')
    assert.equal(h.SQL.asTableName('Child'), 'Children')
    assert.equal(h.SQL.asTableName('Mouse'), 'Mice')
  },
  'SQL: asSqlDate': function(assert) {
    var d = new Date(Date.parse("Tue, 1 Jan 2000 00:00:00 GMT"))
    assert.equal(h.SQL.asSqlDate(d), '2000-01-01 01:00:00')
  },
  'SQL: valuesForInsertQuery': function(assert) {
    var s = new Sequelize('sequelize_test', 'test', 'test')
    var Day = s.define('Day', { name: Sequelize.TEXT })
    var result = h.SQL.valuesForInsertQuery(new Day({name: 'asd'}))
    assert.eql(result, ["'asd'", 'NULL', 'NULL'])
  },
  'SQL: fieldsForInsertQuery': function(assert) {
    var s = new Sequelize('sequelize_test', 'test', 'test')
    var Day = s.define('Day', { name: Sequelize.TEXT })
    var result = h.SQL.fieldsForInsertQuery(new Day({name: 'asd'}))
    assert.eql(result, 'name, createdAt, updatedAt')
  },
  'SQL: transformValueByDataType': function(assert) {
    assert.equal(h.SQL.transformValueByDataType('asd',  {type: Sequelize.STRING}), "'asd'")
    assert.equal(h.SQL.transformValueByDataType('asd',  {type: Sequelize.TEXT}), "'asd'")
    assert.equal(h.SQL.transformValueByDataType(6,      {type: Sequelize.INTEGER}), "6")
    assert.equal(h.SQL.transformValueByDataType(null,   {type: Sequelize.INTEGER}), "NULL")
    assert.equal(h.SQL.transformValueByDataType(null,   {type: Sequelize.STRING}), "NULL")
    assert.equal(h.SQL.transformValueByDataType(null,   {type: Sequelize.TEXT}), "NULL")
    
    var d = new Date(Date.parse("Tue, 1 Jan 2000 00:00:00 GMT"))
    assert.equal(h.SQL.transformValueByDataType(d, {type: Sequelize.DATE}), "'2000-01-01 01:00:00'")
  },
  'SQL: valuesForUpdate': function(assert) {
    var s = new Sequelize('sequelize_test', 'test', 'test')
    var Day = s.define('Day', { name: Sequelize.TEXT })
    var day = new Day({name: 'asd'})
    assert.equal(h.SQL.valuesForUpdate(day), "name = 'asd', createdAt = NULL, updatedAt = NULL")
    assert.equal(h.SQL.valuesForUpdate(day, {seperator: '; '}), "name = 'asd'; createdAt = NULL; updatedAt = NULL")
  },
  'SQL: hashToWhereConditions': function(assert) {
    var s = new Sequelize('sequelize_test', 'test', 'test')
    var Day = s.define('Day', { name: Sequelize.TEXT })
    var day = new Day({name: 'asd'})
    assert.equal(h.SQL.hashToWhereConditions(5, Day.attributes), 'id = 5')
    assert.equal(h.SQL.hashToWhereConditions({name: 'asd'}, Day.attributes), "name='asd'")
  },
  'SQL: addPrefix': function(assert) {
    assert.equal(h.SQL.addPrefix('foo', 'bar', true), 'fooBar')
    assert.equal(h.SQL.addPrefix('foo', 'bar', false), 'fooBars')
  },
  'Hash: forEach': function(assert) {
    var values = []
    var keys = []
    h.Hash.forEach({a:1, b:2, c:3}, function(value, key) {
      values.push(value)
      keys.push(key)
    })
    assert.eql(values, [1,2,3])
    assert.eql(keys, ['a', 'b', 'c'])
  },
  'Hash: map': function(assert) {
    var hash = {a:1, b:2, c:3}
    assert.eql(h.Hash.map(hash, function(value, key) {return value}), [1,2,3])
    assert.eql(h.Hash.map(hash, function(value, key) {return key}), ['a','b','c'])
  },
  'Hash: keys': function(assert) {
    assert.eql(h.Hash.keys({a:1,b:2}), ['a', 'b'])
  },
  'Hash: values': function(assert) {
    assert.eql(h.Hash.values({a:1,b:2}), [1,2])
  },
  'Hash: merge': function(assert) {
    var src = {a:1, b:2}
    var target = {b:3, c:3}
    
    assert.eql(h.Hash.merge(src, target), {a:1, b:3, c:3})
    assert.eql(h.Hash.merge(src, target, true), {a:1, b:2, c:3})
  },
  'Inflection: should be available': function(assert) {
    assert.isDefined(h.Inflection)
  },
  'Hash: without': function(assert) {
    var hash = {a: 1, b: 2}
    assert.eql(h.Hash.without(hash, ["a"]), {b: 2})
  }
}