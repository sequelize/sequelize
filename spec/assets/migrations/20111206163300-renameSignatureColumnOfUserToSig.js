module.exports = {
  up: function(migration, DataTypes) {
    migration.renameColumn('User', 'signature', 'sig')
  },

  down: function(migration, DataTypes) {
    migration.renameColumn('User', 'sig', 'signature')
  }
}
