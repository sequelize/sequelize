module.exports = {
  up: function(migration, DataTypes, done) {
    migration.renameTrigger('trigger_test', 'updated_at', 'update_updated_at').complete(done);
  },
  down: function(migration, DataTypes, done) {
    migration.renameTrigger('trigger_test', 'update_updated_at', 'updated_at').complete(done);
  }
}
