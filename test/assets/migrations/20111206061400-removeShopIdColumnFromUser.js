module.exports = {
  up: function(migration, DataTypes, done) {
    migration.removeColumn('User', 'shopId').complete(done)
  },

  down: function(migration, DataTypes, done) {
    migration.addColumn('User', 'shopId', { type: DataTypes.INTEGER, allowNull: true }).complete(done)
  }
}
