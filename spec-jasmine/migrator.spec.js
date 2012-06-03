var config    = require("./config/config")
  , Sequelize = require("../index")
  , sequelize = new Sequelize(config.mysql.database, config.mysql.username, config.mysql.password, { logging: false })
  , Helpers   = new (require("./config/helpers"))(sequelize)
  , Migrator  = require("../lib/migrator")
  , _         = Sequelize.Utils._

describe('Migrator', function() {
  var migrator      = null
    , SequelizeMeta = null

  var setup = function(_options) {
    Helpers.async(function(done) {
      var options = Sequelize.Utils._.extend({
        path: __dirname + '/assets/migrations',
        logging: false
      }, _options || {})

      migrator = new Migrator(sequelize, options)
      migrator
        .findOrCreateSequelizeMetaDAO({ force: true })
        .success(function(_SequelizeMeta) {
          SequelizeMeta = _SequelizeMeta
          done()
        })
        .error(function(err) { console.log(err) })
    })
  }

  var reset = function() {
    migrator = null
    Helpers.dropAllTables()
  }

  beforeEach(reset)
  afterEach(reset)

  describe('getUndoneMigrations', function() {
    it("returns no files if timestamps are after the files timestamp", function() {
      setup({ from: 20120101010101 })

      Helpers.async(function(done) {
        migrator.getUndoneMigrations(function(err, migrations) {
          expect(err).toBeNull()
          expect(migrations.length).toEqual(0)
          done()
        })
      })
    })

    it("returns only files between from and to", function() {
      setup({ from: 19700101000000, to: 20111117063700 })

      Helpers.async(function(done) {
        migrator.getUndoneMigrations(function(err, migrations) {
          expect(err).toBeNull()
          expect(migrations.length).toEqual(1)
          expect(_.last(migrations).filename).toEqual('20111117063700-createPerson.js')
          done()
        })
      })
    })

    it("returns also the file which is exactly options.from or options.to", function() {
      setup({ from: 20111117063700, to: 20111130161100 })

      Helpers.async(function(done) {
        migrator.getUndoneMigrations(function(err, migrations) {
          expect(err).toBeNull()
          expect(migrations.length).toEqual(2)
          expect(migrations[0].filename).toEqual('20111117063700-createPerson.js')
          expect(migrations[1].filename).toEqual('20111130161100-emptyMigration.js')
          done()
        })
      })
    })

    it("returns all files to options.to if no options.from is defined", function() {
      setup({ to: 20111130161100 })

      Helpers.async(function(done) {
        migrator.getUndoneMigrations(function(err, migrations) {
          expect(err).toBeNull()
          expect(migrations.length).toEqual(2)
          done()
        })
      })
    })

    it("returns all files from last migration id stored in database", function() {
      setup()

      Helpers.async(function(done) {
        SequelizeMeta.create({ from: null, to: 20111117063700 }).success(function() {
          migrator.getUndoneMigrations(function(err, migrations) {
            expect(err).toBeNull()
            expect(migrations.length).toEqual(6)
            expect(migrations[0].filename).toEqual('20111130161100-emptyMigration.js')
            done()
          })
        })
      })
    })
  })

  describe('migrations', function() {
    beforeEach(function() {
      setup({ from: 20111117063700, to: 20111117063700 })

      Helpers.async(function(done) {
        migrator.migrate().success(done).error(function(err) { console.log(err) })
      })
    })

    describe('executions', function() {
      it("executes migration #20111117063700 and correctly creates the table", function() {
        Helpers.async(function(done) {
          sequelize.getQueryInterface().showAllTables().success(function(tableNames) {
            tableNames = tableNames.filter(function(e){ return e != 'SequelizeMeta' })
            expect(tableNames.length).toEqual(1)
            expect(tableNames[0]).toEqual('Person')
            done()
          })
        })
      })

      it("executes migration #20111117063700 and correctly adds isBetaMember", function() {
        Helpers.async(function(done) {
          sequelize.getQueryInterface().describeTable('Person').success(function(data) {
            var beta = data.filter(function(d) { return d.Field == 'isBetaMember'})
            expect(beta).toBeDefined()
            done()
          })
        })
      })

      it("executes migration #20111117063700 correctly up (createTable) and downwards (dropTable)", function() {
        Helpers.async(function(done) {
          sequelize.getQueryInterface().showAllTables().success(function(tableNames) {
            tableNames = tableNames.filter(function(e){ return e != 'SequelizeMeta' })
            expect(tableNames.length).toEqual(1)
            done()
          })
        })

        Helpers.async(function(done) {
          migrator.migrate({ method: 'down' }).success(function() {
            sequelize.getQueryInterface().showAllTables().success(function(tableNames) {
              tableNames = tableNames.filter(function(e){ return e != 'SequelizeMeta' })
              expect(tableNames.length).toEqual(0)
              done()
            }).error(function(err){ console.log(err); done() })
          }).error(function(err){ console.log(err); done() })
        })
      })

      it("executes the empty migration #20111130161100", function() {
        Helpers.async(function(done) {
          setup({ from: 20111130161100, to: 20111130161100})
          done()
        })

        Helpers.async(function(done) {
          migrator.migrate().success(done).error(function(err) { console.log(err) })
          // this migration isn't actually testing anything but
          // should not timeout
        })
      })
    })

    describe('renameTable', function() {
      it("executes migration #20111205064000 and renames a table", function() {
        Helpers.async(function(done) {
          sequelize.getQueryInterface().showAllTables().success(function(tableNames) {
            tableNames = tableNames.filter(function(e){ return e != 'SequelizeMeta' })
            expect(tableNames.length).toEqual(1)
            expect(tableNames[0]).toEqual('Person')
            done()
          })
        })

        setup({from: 20111205064000, to: 20111205064000})

        Helpers.async(function(done) {
          migrator.migrate().success(done).error(function(err) { console.log(err) })
        })

        Helpers.async(function(done) {
          sequelize.getQueryInterface().showAllTables().success(function(tableNames) {
            tableNames = tableNames.filter(function(e){ return e != 'SequelizeMeta' })
            expect(tableNames.length).toEqual(1)
            expect(tableNames[0]).toEqual('User')
            done()
          })
        })
      })
    })

    describe('addColumn', function() {
      it('adds a column to the user table', function() {
        setup({from: 20111205064000, to: 20111205162700})

        Helpers.async(function(done) {
          migrator.migrate().success(done).error(function(err) { console.log(err) })
        })

        Helpers.async(function(done) {
          sequelize.getQueryInterface().describeTable('User').success(function(data) {
            var signature = data.filter(function(hash){ return hash.Field == 'signature' })[0]
              , isAdmin   = data.filter(function(hash){ return hash.Field == 'isAdmin' })[0]
              , shopId    = data.filter(function(hash){ return hash.Field == 'shopId' })[0]

            expect(signature.Field).toEqual('signature')
            expect(signature.Null).toEqual('NO')

            expect(isAdmin.Field).toEqual('isAdmin')
            expect(isAdmin.Null).toEqual('NO')
            expect(isAdmin.Default).toEqual('0')

            expect(shopId.Field).toEqual('shopId')
            expect(shopId.Null).toEqual('YES')

            done()
          }).error(function(err) {
            console.log(err)
          })
        })
      })
    })

    describe('removeColumn', function() {
      it('removes the shopId column from user', function() {
        setup({from: 20111205064000, to: 20111206061400})

        Helpers.async(function(done) {
          migrator.migrate().success(done).error(function(err) { console.log(err) })
        })

        Helpers.async(function(done) {
          sequelize.getQueryInterface().describeTable('User').success(function(data) {
            var signature = data.filter(function(hash){ return hash.Field == 'signature' })[0]
              , isAdmin   = data.filter(function(hash){ return hash.Field == 'isAdmin' })[0]
              , shopId    = data.filter(function(hash){ return hash.Field == 'shopId' })[0]

            expect(signature.Field).toEqual('signature')
            expect(signature.Null).toEqual('NO')

            expect(isAdmin.Field).toEqual('isAdmin')
            expect(isAdmin.Null).toEqual('NO')
            expect(isAdmin.Default).toEqual('0')

            expect(shopId).toBeFalsy()

            done()
          }).error(function(err) {
            console.log(err)
          })
        })

      })
    })

    describe('changeColumn', function() {
      it('changes the signature column from user to default "signature" + notNull', function() {
        setup({from: 20111205064000, to: 20111206063000})

        Helpers.async(function(done) {
          migrator.migrate().success(done).error(function(err) { console.log(err) })
        })

        Helpers.async(function(done) {
          sequelize.getQueryInterface().describeTable('User').success(function(data) {
            var signature = data.filter(function(hash){ return hash.Field == 'signature' })[0]

            expect(signature.Field).toEqual('signature')
            expect(signature.Type).toEqual('varchar(255)')
            expect(signature.Null).toEqual('NO')
            expect(signature.Default).toEqual('Signature')

            done()
          }).error(function(err) {
            console.log(err)
          })
        })
      })
    })
  })

  describe('renameColumn', function() {
    it("renames the signature column from user to sig", function() {
      setup({from: 20111117063700, to: 20111206163300})

      Helpers.async(function(done) {
        migrator.migrate().success(done).error(function(err) { console.log(err) })
      })

      Helpers.async(function(done) {
        sequelize.getQueryInterface().describeTable('User').success(function(data) {
          var signature = data.filter(function(hash){ return hash.Field == 'signature' })[0]
            , sig       = data.filter(function(hash){ return hash.Field == 'sig' })[0]

          expect(signature).toBeFalsy()
          expect(sig).toBeTruthy()

          done()
        }).error(function(err) {
          console.log(err)
        })
      })
    })
  })
})

