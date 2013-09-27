module.exports = {
  up: function(migration, DataTypes, done) {
    migration.dropTrigger('trigger_test', 'update_updated_at').complete(done);
  },
  down: function(migration, DataTypes, done) {
    migration.createTrigger('trigger_test', 'update_updated_at', 'before', {update: true},
        'bump_updated_at', []).complete(done);
  }
}
