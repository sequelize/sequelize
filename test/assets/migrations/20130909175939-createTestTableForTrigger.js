module.exports = {
  up: function(migration, DataTypes, done) {
    migration
        .createTable('trigger_test', {
          name: DataTypes.STRING,
          updated_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
            allowNull: false
          }
        })
        .complete(done)
  },
  down: function(migration, DataTypes, done) {
    migration.dropTable('trigger_test').complete(done)
  }
}
