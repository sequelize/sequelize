require(__dirname + "/../sequelize")

module.exports = {
  'test constants': function(assert) {
    assert.isNotUndefined(Sequelize.STRING)
    assert.isNotNull(Sequelize.STRING)
    assert.isNotUndefined(Sequelize.TEXT)
    assert.isNotNull(Sequelize.TEXT)
    assert.isNotUndefined(Sequelize.INTEGER)
    assert.isNotNull(Sequelize.INTEGER)
  },
  'the constructor sets config correctly': function(assert){
    var s = new Sequelize('sequelize_test', 'test', 'test')
    assert.equal(s.config.database, 'sequelize_test')
    assert.equal(s.config.username, 'test')
    assert.equal(s.config.password, 'test')
  },
  'the constructor initializes empty tables hash': function(assert) {
    var s = new Sequelize('sequelize_test', 'test', 'test')
    assert.isNotUndefined(s.tables)
    assert.isNotNull(s.tables)
    assert.eql(s.tables, {})
  },
  'define should return a function': function(assert){
    var s = new Sequelize('sequelize_test', 'test', 'test')
    var Day = s.define('Day', { name: Sequelize.TEXT })
    assert.equal(typeof Day, 'function')
  },
  'define should store attributes': function(assert) {
    var s = new Sequelize('sequelize_test', 'test', 'test')
    var Day = s.define('Day', { name: Sequelize.TEXT })
    assert.isNotUndefined(Day.attributes)
    assert.isNotNull(Day.attributes)
    assert.eql(Day.attributes, { name: Sequelize.TEXT, createdAt: "DATETIME NOT NULL", updatedAt: "DATETIME NOT NULL"})
  },
  'define should add new table to tables': function(assert) {
    var s = new Sequelize('sequelize_test', 'test', 'test')
    var Day = s.define('Day', { name: Sequelize.TEXT })
    assert.includes(SequelizeHelper.Hash.keys(Day.sequelize.tables), 'Day')
  },
  'tableNames should be an empty array if no tables are specified': function(assert){
    var s = new Sequelize('sequelize_test', 'test', 'test')
    assert.deepEqual(s.tableNames, [])
  },
  'tableNames should be no empty array if tables are specified': function(assert) {
    var s = new Sequelize('sequelize_test', 'test', 'test')
    s.define('Day', { name: Sequelize.TEXT })
    assert.deepEqual(s.tableNames, ['Days'])
  }
}