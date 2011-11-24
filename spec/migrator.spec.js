var config    = require("./config/config")
  , Sequelize = require("../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, { logging: false })
  , Helpers   = new (require("./config/helpers"))(sequelize)
  , Migrator  = require("../lib/migrator")

describe('Migrator', function() {
  describe('getUndoneMigrations', function() {
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

    // specs

    it("returns no files if timestamps are after the files timestamp", function() {
      setup({ from: 20120101010101 })

      Helpers.async(function(done) {
        migrator.getUndoneMigrations(function(files) {
          expect(files.length).toEqual(0)
          done()
        })
      })
    })

    it("returns only files between from and to", function() {
      setup({ from: 19700101000000, to: 20111117063700 })

      Helpers.async(function(done) {
        migrator.getUndoneMigrations(function(files) {
          expect(files.length).toEqual(1)
          expect(files[0]).toEqual('20111117063700-createPerson.js')
          done()
        })
      })
    })

    it("returns also the file which is exactly options.from or options.to", function() {
      setup({ from: 20111117063700, to: 20111123060700 })

      Helpers.async(function(done) {
        migrator.getUndoneMigrations(function(files) {
          expect(files.length).toEqual(2)
          expect(files[0]).toEqual('20111117063700-createPerson.js')
          expect(files[1]).toEqual('20111123060700-addBirthdateToPerson.js')
          done()
        })
      })
    })

    it("returns all files to options.to if no options.from is defined", function() {
      setup({ to: 20111123060700 })

      Helpers.async(function(done) {
        migrator.getUndoneMigrations(function(files) {
          expect(files.length).toEqual(2)
          done()
        })
      })
    })

    it("returns all files from last migration id stored in database", function() {
      setup()

      Helpers.async(function(done) {
        SequelizeMeta.create({ lastMigrationId: '20111117063700' }).success(function() {
          migrator.getUndoneMigrations(function(files) {
            expect(files.length).toEqual(1)
            expect(files[0]).toEqual('20111123060700-addBirthdateToPerson.js')
            done()
          })
        })
      })
    })
  })
/*

  describe('getLastMigrationId', function() {
    it("should correctly transform array into IN", function() {
      Helpers.async(function(done) {
        new Migrator(sequelize, {
          path: __dirname + '/assets/migrations',
          from: 2011111706370020111117063700,
          to: 20111117063700
        }).migrate().success(function() {
          done()
        })
      })
    })
  })*/
})
