module.exports = {
  up: function(migration, DataTypes, done) {
    migration.dropFunction('get_the_answer', []).complete(done);
  },
  down: function(migration, DataTypes, done) {
    migration.createFunction('get_the_answer', 'int', 'plpgsql',
            'RETURN 42;'
    ).complete(done);
  }
}
