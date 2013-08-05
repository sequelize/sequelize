module.exports = {
  up: function(migration, DataTypes, done) {
    migration.addColumn('User', 'uniqueName', { type: DataTypes.STRING }).complete(function() {
      migration.changeColumn('User', 'uniqueName', { type: DataTypes.STRING, allowNull: false, unique: true }).complete(done)
    })
  },

  down: function(migration, DataTypes, done) {
    migration.removeColumn('User', 'uniqueName').complete(done)
  }
}
