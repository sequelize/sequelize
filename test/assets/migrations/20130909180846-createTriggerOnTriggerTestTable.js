module.exports = {
  up: function(migration, DataTypes, done) {
    migration.createTrigger('trigger_test', 'updated_at', 'before', {update: true},
        'bump_updated_at', []).complete(done);
  },
  down: function(migration, DataTypes, done) {
    migration.dropTrigger('trigger_test', 'updated_at').complete(done);
  }
}
