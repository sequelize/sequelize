module.exports = {
  up: function(migration, DataTypes) {
    migration.renameTable('Person', 'User')
  },

  down: function(migration, DataTypes) {
    migration.renameTable('User', 'Person')
  }
}
