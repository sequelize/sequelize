if(typeof require === 'function') {
  const buster             = require("buster")
      , QueryChainer       = require("../lib/query-chainer")
      , CustomEventEmitter = require("../lib/emitters/custom-event-emitter")
      , Helpers            = require('./buster-helpers')
      , dialect            = Helpers.getTestDialect()
      , Migrator           = require("../lib/migrator")
}

buster.spec.expose()
buster.testRunner.timeout = 1000

describe(Helpers.getTestDialectTeaser("Migrator"), function() {
  before(function(done) {
    this.init = function(options, callback) {
      options = Helpers.Sequelize.Utils._.extend({
        path: __dirname + '/assets/migrations',
        logging: false
      }, options || {})

      var migrator = new Migrator(this.sequelize, options)

      migrator
        .findOrCreateSequelizeMetaDAO({ force: true })
        .success(function(SequelizeMeta) {
          callback && callback(migrator, SequelizeMeta)
        })
        .error(function(err) { console.log(err) })
    }.bind(this)

    Helpers.initTests({ dialect: dialect, onComplete: done, context: this })
  })

  it("as", function() {
    expect(1).toEqual(1)
  })

  describe('getUndoneMigrations', function() {
    it("returns no files if timestamps are after the files timestamp", function(done) {
      this.init({ from: 20120101010101 }, function(migrator) {
        migrator.getUndoneMigrations(function(err, migrations) {
          expect(err).toBeNull()
          expect(migrations.length).toEqual(0)
          done()
        }.bind(this))
      }.bind(this))
    })

    it("returns only files between from and to", function(done) {
      this.init({ from: 19700101000000, to: 20111117063700 }, function(migrator) {
        migrator.getUndoneMigrations(function(err, migrations) {
          expect(err).toBeNull()
          expect(migrations.length).toEqual(1)
          expect(migrations[migrations.length - 1].filename).toEqual('20111117063700-createPerson.js')
          done()
        }.bind(this))
      }.bind(this))
    })

    it("returns exactly the migration which is defined in from and to", function(done) {
      this.init({ from: 20111117063700, to: 20111117063700 }, function(migrator) {
        migrator.getUndoneMigrations(function(err, migrations) {
          expect(err).toBeNull()
          expect(migrations.length).toEqual(1)
          expect(migrations[migrations.length - 1].filename).toEqual('20111117063700-createPerson.js')
          done()
        }.bind(this))
      }.bind(this))
    })

    it("returns also the file which is exactly options.from or options.to", function(done) {
      this.init({ from: 20111117063700, to: 20111130161100 }, function(migrator) {
        migrator.getUndoneMigrations(function(err, migrations) {
          expect(err).toBeNull()
          expect(migrations.length).toEqual(2)
          expect(migrations[0].filename).toEqual('20111117063700-createPerson.js')
          expect(migrations[1].filename).toEqual('20111130161100-emptyMigration.js')
          done()
        }.bind(this))
      }.bind(this))
    })

    it("returns all files to options.to if no options.from is defined", function(done) {
      this.init({ to: 20111130161100 }, function(migrator) {
        migrator.getUndoneMigrations(function(err, migrations) {
          expect(err).toBeNull()
          expect(migrations.length).toEqual(2)
          done()
        }.bind(this))
      }.bind(this))
    })

    it("returns all files from last migration id stored in database", function(done) {
      this.init(undefined, function(migrator, SequelizeMeta) {
        SequelizeMeta.create({ from: null, to: 20111117063700 }).success(function() {
          migrator.getUndoneMigrations(function(err, migrations) {
            expect(err).toBeNull()
            expect(migrations.length).toEqual(6)
            expect(migrations[0].filename).toEqual('20111130161100-emptyMigration.js')
            done()
          }.bind(this))
        }.bind(this))
      }.bind(this))
    })
  })

  describe('migrations', function() {
    before(function(done) {
      this.init({ from: 20111117063700, to: 20111117063700 }, function(migrator) {
        this.migrator = migrator
        this.migrator.migrate().success(done)
      }.bind(this))
    })

    describe('executions', function() {
      it("executes migration #20111117063700 and correctly creates the table", function(done) {
        this.sequelize.getQueryInterface().showAllTables().success(function(tableNames) {
          tableNames = tableNames.filter(function(e){ return e != 'SequelizeMeta' })
          expect(tableNames).toEqual([ 'Person' ])
          done()
        })
      })

      ;(dialect === 'sqlite' ? itEventually : it)("executes migration #20111117063700 and correctly adds isBetaMember", function(done) {
        this.sequelize.getQueryInterface().describeTable('Person').success(function(data) {
          var fields = data.map(function(d) { return d.Field }).sort()
          expect(fields).toEqual([ 'isBetaMember', 'name' ])
          done()
        })
      })

      it("executes migration #20111117063700 correctly up (createTable) and downwards (dropTable)", function(done) {
        this.sequelize.getQueryInterface().showAllTables().success(function(tableNames) {
          tableNames = tableNames.filter(function(e){ return e != 'SequelizeMeta' })
          expect(tableNames).toEqual([ 'Person' ])

          this.migrator.migrate({ method: 'down' }).success(function() {
            this.sequelize.getQueryInterface().showAllTables().success(function(tableNames) {
              tableNames = tableNames.filter(function(e){ return e != 'SequelizeMeta' })
              expect(tableNames).toEqual([])
              done()
            }.bind(this))
          }.bind(this))
        }.bind(this))
      })

      it("executes the empty migration #20111130161100", function(done) {
        this.init({ from: 20111130161100, to: 20111130161100 }, function(migrator) {
          // this migration isn't actually testing anything but
          // should not timeout

          expect(1).toEqual(1)

          migrator
            .migrate()
            .success(done)
            .error(function(err) { console.log(err) })
        })
      })
    })

    describe('renameTable', function() {
     before(function(done) {
        this.init({ from: 20111117063700, to: 20111117063700 }, function(migrator) {
          this.migrator = migrator
          this.migrator.migrate().success(done)
        }.bind(this))
      })

      ;(dialect === 'sqlite' ? itEventually : it)("executes migration #20111205064000 and renames a table", function(done) {
        this.sequelize.getQueryInterface().showAllTables().success(function(tableNames) {
          tableNames = tableNames.filter(function(e){ return e != 'SequelizeMeta' })
          expect(tableNames).toEqual([ 'Person' ])

          this.init({ from: 20111205064000, to: 20111205064000 }, function(migrator) {
            migrator.migrate().success(function() {
              this.sequelize.getQueryInterface().showAllTables().success(function(tableNames) {
                tableNames = tableNames.filter(function(e){ return e != 'SequelizeMeta' })
                expect(tableNames).toEqual([ 'User' ])
                done()
              })
            }.bind(this))
          }.bind(this))
        }.bind(this))
      })
    })

    describe('addColumn', function() {
      it('//adds a column to the user table', function(done) {
        this.init({ from: 20111117063700, to: 20111205162700 }, function(migrator) {
          migrator.migrate().success(function() {
            this.sequelize.getQueryInterface().describeTable('User').success(function(data) {
              console.log(data)
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
            })
          }.bind(this))
        }.bind(this))
      })
    })

    describe('removeColumn', function() {
      (dialect === 'mysql' ? it : itEventually)('removes the shopId column from user', function(done) {
        this.init({ to: 20111206061400 }, function(migrator) {
          migrator.migrate().success(function(){
            this.sequelize.getQueryInterface().describeTable('User').success(function(data) {
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
            })
          }.bind(this))
        }.bind(this))
      })
    })

    describe('changeColumn', function() {
      (dialect === 'mysql' ? it : itEventually)('changes the signature column from user to default "signature" + notNull', function(done) {
        this.init({ to: 20111206063000 }, function(migrator) {
          migrator.migrate().success(function() {
            this.sequelize.getQueryInterface().describeTable('User').success(function(data) {
              var signature = data.filter(function(hash){ return hash.Field == 'signature' })[0]

              expect(signature.Field).toEqual('signature')
              expect(signature.Type).toEqual('varchar(255)')
              expect(signature.Null).toEqual('NO')
              expect(signature.Default).toEqual('Signature')

              done()
            })
          }.bind(this))
        }.bind(this))
      })
    })
  })

  describe('renameColumn', function() {
    (dialect === 'mysql' ? it : itEventually)("renames the signature column from user to sig", function(done) {
      this.init({ to: 20111206163300 }, function(migrator) {
        migrator.migrate().success(function(){
          this.sequelize.getQueryInterface().describeTable('User').success(function(data) {
            var signature = data.filter(function(hash){ return hash.Field == 'signature' })[0]
              , sig       = data.filter(function(hash){ return hash.Field == 'sig' })[0]

            expect(signature).toBeFalsy()
            expect(sig).toBeTruthy()

            done()
          })
        }.bind(this))
      }.bind(this))
    })
  })
})

