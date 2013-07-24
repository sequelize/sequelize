module.exports = {
  up: function(migration, DataTypes, done) {
    migration
      .createTable('Person', {
        name: DataTypes.STRING,
        isBetaMember: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
          allowNull: false
        }
      })
      .complete(done)
  },
  down: function(migration, DataTypes, done) {
    migration.dropTable('Person').complete(done)
  }
}
