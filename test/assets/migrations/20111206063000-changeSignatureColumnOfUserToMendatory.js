module.exports = {
  up: function(migration, DataTypes, done) {
    migration.changeColumn('User', 'signature', {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'Signature'
    }).complete(done)
  },

  down: function(migration, DataTypes, done) { done() }
}
