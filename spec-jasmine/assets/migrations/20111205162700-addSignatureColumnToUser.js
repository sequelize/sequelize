module.exports = {
  up: function(migration, DataTypes) {
    migration.addColumn('User', 'signature', DataTypes.TEXT)
    migration.addColumn('User', 'shopId', { type: DataTypes.INTEGER, allowNull: true })
    migration.addColumn('User', 'isAdmin', { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false })
  },

  down: function(migration, DataTypes) {
    migration.removeColumn('User', 'signature')
    migration.removeColumn('User', 'shopId')
    migration.removeColumn('User', 'isAdmin')
  }
}
