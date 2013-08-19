module.exports = {
  up: function(migration, DataTypes, done) {
    migration
      .addColumn('User', 'isAdmin', { type: DataTypes.BOOLEAN, defaultValue: false, allowNull: false })
      .complete(function(err) {
        if (err) {
          done(err)
        } else {
          migration
            .addColumn('User', 'signature', DataTypes.TEXT)
            .complete(function(err) {
              if (err) {
                done(err)
              } else {
                migration.addColumn('User', 'shopId', { type: DataTypes.INTEGER, allowNull: true }).complete(done)
              }
            })
        }
      })


  },

  down: function(migration, DataTypes, done) {
    migration.removeColumn('User', 'signature').complete(function(err) {
      if (err) {
        done(err)
      } else {
        migration.removeColumn('User', 'shopId').complete(function(err) {
          if (err) {
            done(err)
          } else {
            migration.removeColumn('User', 'isAdmin').complete(done)
          }
        })
      }
    })
  }
}
