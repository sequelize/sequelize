require(__dirname + "/../sequelize")

var s = new Sequelize('sequelize_test', 'test', 'test')

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
    assert.equal(s.config.database, 'sequelize_test')
    assert.equal(s.config.username, 'test')
    assert.equal(s.config.password, 'test')
  },
  'the constructor initializes empty tables hash': function(assert) {
    assert.isNotUndefined(s.tables)
    assert.isNotNull(s.tables)
    assert.eql(s.tables, {})
  },
  'define should return a function': function(assert){
    var Day = s.define('Day', { name: Sequelize.TEXT })
    assert.equal(typeof Day, 'function')
  },
  'define should store attributes': function(assert) {
    var Day = s.define('Day', { name: Sequelize.TEXT })
    assert.isNotUndefined(Day.attributes)
    assert.isNotNull(Day.attributes)
    assert.eql(Day.attributes, { name: Sequelize.TEXT, createdAt: "DATETIME NOT NULL", updatedAt: "DATETIME NOT NULL"})
  },
  'define should add new table to tables': function(assert) {
    var Day = s.define('Day', { name: Sequelize.TEXT })
    assert.includes(SequelizeHelper.Hash.keys(Day.sequelize.tables), 'Day')
  },
  'tableNames should be an empty array if no tables are specified': function(assert){
    var s2 = new Sequelize('sequelize_test', 'test', 'test')
    assert.deepEqual(s2.tableNames, [])
  },
  'tableNames should be no empty array if tables are specified': function(assert) {
    s.define('Day', { name: Sequelize.TEXT })
    assert.deepEqual(s.tableNames, ['Days'])
  },
  'sqlQueryFor: create': function(assert) {
    var query = Sequelize.sqlQueryFor('create', { table: 'Foo', fields: 'a INT' })
    assert.equal(query, "CREATE TABLE IF NOT EXISTS Foo (a INT)")
  },
  'sqlQueryFor: drop': function(assert) {
    var query = Sequelize.sqlQueryFor('drop', { table: 'Foo' })
    assert.equal(query, "DROP TABLE IF EXISTS Foo")
  },
  'sqlQueryFor: select': function(assert) {
    assert.equal(Sequelize.sqlQueryFor('select', { table: 'Foo'}), "SELECT * FROM Foo")
    assert.equal(Sequelize.sqlQueryFor('select', { table: 'Foo', fields: 'id'}), "SELECT id FROM Foo")
    assert.equal(Sequelize.sqlQueryFor('select', { table: 'Foo', where: 'id = 1'}), "SELECT * FROM Foo WHERE id = 1")
    assert.equal(Sequelize.sqlQueryFor('select', { table: 'Foo', order: 'id DESC'}), "SELECT * FROM Foo ORDER BY id DESC")
    assert.equal(Sequelize.sqlQueryFor('select', { table: 'Foo', group: 'name'}), "SELECT * FROM Foo GROUP BY name")
    assert.equal(Sequelize.sqlQueryFor('select', { table: 'Foo', limit: 1}), "SELECT * FROM Foo LIMIT 1")
    assert.equal(Sequelize.sqlQueryFor('select', { table: 'Foo', offset: 10, limit: 1}), "SELECT * FROM Foo LIMIT 10, 1")
  },
  'sqlQueryFor: insert': function(assert) {
    var query = Sequelize.sqlQueryFor('insert', { table: 'Foo', fields: 'foo', values: "'bar'" })
    assert.equal(query, "INSERT INTO Foo (foo) VALUES ('bar')")
  },
  'sqlQueryFor: update': function(assert) {
    var query = Sequelize.sqlQueryFor('update', { table: 'Foo', values: "foo=1", id: 2 })
    assert.equal(query, "UPDATE Foo SET foo=1 WHERE id = 2")
  },
  'sqlQueryFor: delete': function(assert) {
    var query = Sequelize.sqlQueryFor('delete', {table: 'Foo', where: "id=2"})
    assert.equal(query, "DELETE FROM Foo WHERE id=2 LIMIT 1")
  }
}