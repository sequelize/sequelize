if(typeof require === 'function') {
  const buster             = require("buster")
      , QueryChainer       = require("../lib/query-chainer")
      , CustomEventEmitter = require("../lib/emitters/custom-event-emitter")
      , Helpers            = require('./buster-helpers')
      , dialect            = Helpers.getTestDialect()
      , Migrator           = require("../lib/migrator")
}

buster.spec.expose()
buster.testRunner.timeout = 10000

describe(Helpers.getTestDialectTeaser("Migrator"), function() {
  before(function(done) {
    this.init = function(options, callback) {
      options = Helpers.Sequelize.Utils._.extend({
        path:    __dirname + '/assets/migrations',
        logging: function(){}
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

      it("executes migration #20111117063700 and correctly adds isBetaMember", function(done) {
        this.sequelize.getQueryInterface().describeTable('Person').success(function(data) {
          var fields = Helpers.Sequelize.Utils._.keys(data).sort()
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

      it("executes migration #20111205064000 and renames a table", function(done) {
        this.sequelize.getQueryInterface().showAllTables().success(function(tableNames) {
          tableNames = tableNames.filter(function(e){ return e != 'SequelizeMeta' })
          expect(tableNames).toContain('Person')

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
      it('adds a column to the user table', function(done) {
        this.init({ from: 20111117063700, to: 20111205162700 }, function(migrator) {
          migrator.migrate().complete(function(err) {
            this.sequelize.getQueryInterface().describeTable('User').complete(function(err, data) {
              var signature = data.signature
                , isAdmin   = data.isAdmin
                , shopId    = data.shopId

              expect(signature.allowNull).toEqual(true)
              expect(isAdmin.allowNull).toEqual(false)
              expect(isAdmin.defaultValue).toEqual(false)
              expect(shopId.allowNull).toEqual(true)

              done()
            })
          }.bind(this))
        }.bind(this))
      })
    })

    describe('removeColumn', function() {
      it('removes the shopId column from user', function(done) {
        this.init({ to: 20111206061400 }, function(migrator) {
          migrator.migrate().success(function(){
            this.sequelize.getQueryInterface().describeTable('User').success(function(data) {
              var signature = data.signature
                , isAdmin   = data.isAdmin
                , shopId    = data.shopId

              expect(signature.allowNull).toEqual(true)
              expect(isAdmin.allowNull).toEqual(false)
              expect(isAdmin.defaultValue).toEqual(false)

              expect(shopId).toBeFalsy()

              done()
            })
          }.bind(this))
        }.bind(this))
      })
    })

    describe('changeColumn', function() {
      it('changes the signature column from user to default "signature" + notNull', function(done) {
        this.init({ to: 20111206063000 }, function(migrator) {
          migrator.migrate().success(function() {
            this.sequelize.getQueryInterface().describeTable('User').success(function(data) {
              var signature = data.signature

              if (dialect === 'postgres') {
                expect(signature.type).toEqual('CHARACTER VARYING')
              } else {
                expect(signature.type).toEqual('VARCHAR(255)')
              }
              expect(signature.allowNull).toEqual(false)
              expect(signature.defaultValue).toEqual('Signature')

              done()
            })
          }.bind(this))
        }.bind(this))
      })
    })
  })

  describe('renameColumn', function() {
    it("renames the signature column from user to sig", function(done) {
      this.init({ to: 20111206163300 }, function(migrator) {
        migrator.migrate().success(function(){
          this.sequelize.getQueryInterface().describeTable('User').success(function(data) {
            var signature = data.signature
              , sig       = data.sig

            expect(signature).toBeFalsy()
            expect(sig).toBeTruthy()

            done()
          })
        }.bind(this))
      }.bind(this))
    })
  })
})

