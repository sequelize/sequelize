require(__dirname + "/../sequelize")

var s = new Sequelize('sequelize_test', 'test', 'test')
var Day = s.define('Day', { name: Sequelize.TEXT })

module.exports = {
  'constructor': function(assert) {
    assert.eql(Day.associations, [])
    assert.eql(Day.attributes, {"name":"VARCHAR(4000)","createdAt":"DATETIME NOT NULL","updatedAt":"DATETIME NOT NULL"})
    assert.eql(Day.tableName, 'Days')
  },
  'new': function(assert) {
    var day = new Day({name: 'asd'})
    assert.isNull(day.id)
    assert.eql(day.table, Day)
    assert.eql(day.name, 'asd')
    assert.isUndefined(new Day({name: 'asd', bla: 'foo'}).bla)
  },
  'isCrossAssociatedWith': function(assert) {
    var Foo = s.define('Foo', { bla: Sequelize.TEXT })
    assert.equal(Foo.isCrossAssociatedWith(Day), false)
    Foo.hasMany('days', Day)
    assert.equal(Foo.isCrossAssociatedWith(Day), false)
    Day.hasMany('foos', Foo)
    assert.equal(Foo.isCrossAssociatedWith(Day), true)
  }
}