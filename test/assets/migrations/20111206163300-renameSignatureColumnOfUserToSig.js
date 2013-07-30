module.exports = {
  up: function(migration, DataTypes, done) {
    migration.renameColumn('User', 'signature', 'sig').complete(done)
  },

  down: function(migration, DataTypes, done) {
    migration.renameColumn('User', 'sig', 'signature').complete(done)
  }
}
