module.exports = {
  up: function(migration, DataTypes) {
    migration.removeColumn('User', 'shopId')
  },

  down: function(migration, DataTypes) {
    migration.addColumn('User', 'shopId', { type: DataTypes.INTEGER, allowNull: true })
  }
}
