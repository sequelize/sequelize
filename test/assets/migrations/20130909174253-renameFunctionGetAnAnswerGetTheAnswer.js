module.exports = {
  up: function(migration, DataTypes, done) {
    migration.renameFunction('get_an_answer', [], 'get_the_answer').complete(done);
  },
  down: function(migration, DataTypes, done) {
    migration.renameFunction('get_the_answer', [], 'get_an_answer').complete(done);
  }
}
