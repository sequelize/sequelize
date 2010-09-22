var Sequelize = require(__dirname + "/../../lib/sequelize/Sequelize").Sequelize
var s = new Sequelize('sequelize_test', 'test', 'test')

module.exports = {
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
  },
  'sqlQueryFor: delete wihtout limit': function(assert) {
    var query = Sequelize.sqlQueryFor('delete', {table: 'Foo', where: "id=2", limit: null})
    assert.equal(query, "DELETE FROM Foo WHERE id=2")
  }
}