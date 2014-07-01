module.exports = {
  up: function(migration, DataTypes, done) {
    migration.addColumn('User', 'level', { type: DataTypes.STRING }).complete(function() {
      migration.changeColumn('User', 'level', { type: DataTypes.ENUM, allowNull: false, values: ['basic', 'advanced'] }).complete(done);
    });
  },

  down: function(migration, DataTypes, done) {
    migration.removeColumn('User', 'level').complete(done);
  }
};
