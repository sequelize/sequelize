module.exports = {
  up: function(migration, DataTypes) {
    migration.createTable('Person', {
      name: DataTypes.STRING,
      isBetaMember: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
      }
    })
  },
  down: function(migration) {
    migration.dropTable('Person')
  }
}
