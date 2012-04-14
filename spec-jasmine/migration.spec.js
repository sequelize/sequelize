var config    = require("./config/config")
  , Sequelize = require("../index")
  , sequelize = new Sequelize(config.mysql.database, config.mysql.username, config.mysql.password, { logging: false })
  , Helpers   = new (require("./config/helpers"))(sequelize)
  , Migrator  = require("../lib/migrator")
  , Migration = require("../lib/migration")
  , _         = Sequelize.Utils._

describe('Migration', function() {
  describe('migrationHasInterfaceCalls', function() {
    // the syntax in the following tests are correct
    // don't touch them! the functions will get stringified below
    var tests = [
      {
        topic: function(migration, DataTypes) {
          migration.createTable()
        },
        expectation: true
      },
      {
        topic: function(migration, DataTypes) {
          // migration.createTable()
        },
        expectation: false
      },
      {
        topic: function(migration, DataTypes) {
          migration
            .createTable()
        },
        expectation: true
      },
      {
        topic: function(migration, DataTypes) {
          migration.
            createTable()
        },
        expectation: true
      },
      {
        topic: function(migration, DataTypes) {
          migration . createTable ()
        },
        expectation: true
      },
      {
        topic: function(migration, DataTypes) {
          /*
            migration . createTable()
          */
        },
        expectation: false
      },
      {
        topic: function(migration, DataTypes) {
          migration/* noot noot */.createTable()
        },
        expectation: true
      }
    ]

    tests.forEach(function(test) {
      it('correctly result in ' + test.expectation + ' for ' + test.topic.toString(), function() {
        expect(Migration.migrationHasInterfaceCalls(test.topic)).toEqual(test.expectation)
      })
    })
  })
})
