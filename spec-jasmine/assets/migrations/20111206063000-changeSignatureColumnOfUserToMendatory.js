module.exports = {
  up: function(migration, DataTypes) {
    migration.changeColumn('User', 'signature', {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Signature'
    })
  },

  down: function(migration, DataTypes) {}
}
