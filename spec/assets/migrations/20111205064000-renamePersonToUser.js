module.exports = {
  up: function(migration, DataTypes, done) {
    migration.renameTable('Person', 'User').complete(done)
  },

  down: function(migration, DataTypes, done) {
    migration.renameTable('User', 'Person').complete(done)
  }
}
