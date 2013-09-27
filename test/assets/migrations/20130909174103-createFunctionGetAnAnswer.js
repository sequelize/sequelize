module.exports = {
  up: function(migration, DataTypes, done) {
    migration.createFunction('get_an_answer', [], 'int', 'plpgsql',
            'RETURN 42;'
    ).complete(done);
  },
  down: function(migration, DataTypes, done) {
    migration.dropFunction('get_an_answer', []).complete(done);
  }
}
