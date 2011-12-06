module.exports = {
  up: function(migration, DataTypes) {
    migration.removeColumn('User', 'shopId')
  },

  down: function(migration, DataTypes) {}
}
