if(typeof require === 'function') {
  const buster             = require("buster")
      , QueryChainer       = require("../lib/query-chainer")
      , CustomEventEmitter = require("../lib/emitters/custom-event-emitter")
      , Helpers            = require('./buster-helpers')
      , dialect            = Helpers.getTestDialect()
      , Migrator           = require("../lib/migrator")
      , Migration          = require("../lib/migration")
}

buster.spec.expose()
buster.testRunner.timeout = 1000

describe(Helpers.getTestDialectTeaser("Migration"), function() {
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
