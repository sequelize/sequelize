module.exports = {
  up: function(migration, DataTypes) {
    migration.createTable('Person', {
      name: DataTypes.STRING
    })
  },
  down: function(migration) {
    migration.dropTable('Person')
  }
}
