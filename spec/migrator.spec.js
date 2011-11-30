var config    = require("./config/config")
  , Sequelize = require("../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, { logging: false })
  , Helpers   = new (require("./config/helpers"))(sequelize)
  , Migrator  = require("../lib/migrator")
  , _         = Sequelize.Utils._

describe('Migrator', function() {
  var migrator      = null
    , SequelizeMeta = null

  var setup = function(_options) {
    Helpers.async(function(done) {
      var options = Sequelize.Utils._.extend({
        path: __dirname + '/assets/migrations'
      }, _options || {})

      migrator = new Migrator(sequelize, options)
      migrator.findOrCreateSequelizeMetaModel({ force: true }).success(function(_SequelizeMeta) {
        SequelizeMeta = _SequelizeMeta
        done()
      })
    })
  }

  beforeEach(function() { migrator = null })
  afterEach(function() { migrator = null })

  describe('getUndoneMigrations', function() {
    it("returns no files if timestamps are after the files timestamp", function() {
      setup({ from: 20120101010101 })

      Helpers.async(function(done) {
        migrator.getUndoneMigrations(function(err, migrations) {
          expect(err).toBeFalsy()
          expect(migrations.length).toEqual(0)
          done()
        })
      })
    })

    it("returns only files between from and to", function() {
      setup({ from: 19700101000000, to: 20111117063700 })

      Helpers.async(function(done) {
        migrator.getUndoneMigrations(function(err, migrations) {
          expect(err).toBeFalsy()
          expect(migrations.length).toEqual(1)
          expect(_.last(migrations).filename).toEqual('20111117063700-createPerson.js')
          done()
        })
      })
    })

    it("returns also the file which is exactly options.from or options.to", function() {
      setup({ from: 20111117063700, to: 20111123060700 })

      Helpers.async(function(done) {
        migrator.getUndoneMigrations(function(err, migrations) {
          expect(err).toBeFalsy()
          expect(migrations.length).toEqual(2)
          expect(migrations[0].filename).toEqual('20111117063700-createPerson.js')
          expect(migrations[1].filename).toEqual('20111123060700-addBirthdateToPerson.js')
          done()
        })
      })
    })

    it("returns all files to options.to if no options.from is defined", function() {
      setup({ to: 20111123060700 })

      Helpers.async(function(done) {
        migrator.getUndoneMigrations(function(err, migrations) {
          expect(err).toBeFalsy()
          expect(migrations.length).toEqual(2)
          done()
        })
      })
    })

    it("returns all files from last migration id stored in database", function() {
      setup()

      Helpers.async(function(done) {
        SequelizeMeta.create({ lastMigrationId: '20111117063700' }).success(function() {
          migrator.getUndoneMigrations(function(err, migrations) {
            expect(err).toBeFalsy()
            expect(migrations.length).toEqual(1)
            expect(migrations[0].filename).toEqual('20111123060700-addBirthdateToPerson.js')
            done()
          })
        })
      })
    })
  })

  describe('migrate', function() {
    beforeEach(function() {
      setup({ from: 20111117063700, to: 20111117063700 })

      Helpers.async(function(done) {
        migrator.migrate().success(done).error(function(err) { console.log(err) })
      })
    })

    afterEach(function() {
      migrator = null
      Helpers.async(function(done) {
        sequelize.getQueryInterface().dropAllTables().success(done).error(function(err) { console.log(err) })
      })
    })

    it("executes migration #20111117063700 and correctly creates the table", function() {
      Helpers.async(function(done) {
        sequelize.getQueryInterface().showAllTables().success(function(tableNames) {
          tableNames = tableNames.slice('SequelizeMeta', 1)
          expect(tableNames.length).toEqual(1)
          expect(tableNames[0]).toEqual('Person')
          done()
        })
      })
    })

    it("executes migration #20111117063700 correctly up (createTable) and downwards (dropTable)", function() {
      Helpers.async(function(done) {
        sequelize.getQueryInterface().showAllTables().success(function(tableNames) {
          tableNames = tableNames.slice('SequelizeMeta', 1)
          expect(tableNames.length).toEqual(1)
          done()
        })
      })

      Helpers.async(function(done) {
        migrator.migrate({ method: 'down' }).success(function() {
          sequelize.getQueryInterface().showAllTables().success(function(tableNames) {
            tableNames = tableNames.slice('SequelizeMeta', 1)
            expect(tableNames.length).toEqual(0)
            done()
          }).error(function(err){ console.log(err); done() })
        }).error(function(err){ console.log(err); done() })
      })
    })
  })
})
