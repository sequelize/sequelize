var chai         = require('chai')
  , expect       = chai.expect
  , Support      = require(__dirname + '/support')
  , Migrator     = require("../lib/migrator")
  , DataTypes     = require("../lib/data-types")
  , dialect      = Support.getTestDialect()

chai.config.includeStack = true

describe(Support.getTestDialectTeaser("Migrator"), function() {
  beforeEach(function() {
    this.init = function(options, callback) {
      options = Support.Sequelize.Utils._.extend({
        path:    __dirname + '/assets/migrations',
        logging: function(){}
      }, options || {})

      //this.sequelize.options.logging = console.log
      var migrator = new Migrator(this.sequelize, options)

      migrator
        .findOrCreateSequelizeMetaDAO({ force: true })
        .success(function(SequelizeMeta) {
          callback && callback(migrator, SequelizeMeta)
        })
        .error(function(err) { console.log(err) })
    }.bind(this)
  })

  describe('getUndoneMigrations', function() {
    it("supports coffee files", function(done) {
      this.init({
        filesFilter: /\.coffee$/,
        to: 20111130161100
      }, function(migrator) {
        migrator.getUndoneMigrations(function(err, migrations) {
          expect(err).to.be.null
          expect(migrations).to.have.length(1)
          done()
        })
      })
    })

    it("returns no files if timestamps are after the files timestamp", function(done) {
      this.init({ from: 20140101010101 }, function(migrator) {
        migrator.getUndoneMigrations(function(err, migrations) {
          expect(err).to.be.null
          expect(migrations.length).to.equal(0)
          done()
        })
      })
    })

    it("returns only files between from and to", function(done) {
      this.init({ from: 19700101000000, to: 20111117063700 }, function(migrator) {
        migrator.getUndoneMigrations(function(err, migrations) {
          expect(err).to.be.null
          expect(migrations.length).to.equal(1)
          expect(migrations[migrations.length - 1].filename).to.equal('20111117063700-createPerson.js')
          done()
        })
      })
    })

    it("returns exactly the migration which is defined in from and to", function(done) {
      this.init({ from: 20111117063700, to: 20111117063700 }, function(migrator) {
        migrator.getUndoneMigrations(function(err, migrations) {
          expect(err).to.be.null
          expect(migrations.length).to.equal(1)
          expect(migrations[migrations.length - 1].filename).to.equal('20111117063700-createPerson.js')
          done()
        })
      })
    })

    it("returns also the file which is exactly options.from or options.to", function(done) {
      this.init({ from: 20111117063700, to: 20111130161100 }, function(migrator) {
        migrator.getUndoneMigrations(function(err, migrations) {
          expect(err).to.be.null
          expect(migrations).to.have.length(2)
          expect(migrations[0].filename).to.equal('20111117063700-createPerson.js')
          expect(migrations[1].filename).to.equal('20111130161100-emptyMigration.js')
          done()
        })
      })
    })

    it("returns all files to options.to if no options.from is defined", function(done) {
      this.init({ to: 20111130161100 }, function(migrator) {
        migrator.getUndoneMigrations(function(err, migrations) {
          expect(err).to.be.null
          expect(migrations).to.have.length(2)
          done()
        })
      })
    })

    it("returns all files from last migration id stored in database", function(done) {
      this.init(undefined, function(migrator, SequelizeMeta) {
        SequelizeMeta.create({ from: null, to: 20111117063700 }).success(function() {
          migrator.getUndoneMigrations(function(err, migrations) {
            expect(err).to.be.null
            expect(migrations).to.have.length(15)
            expect(migrations[0].filename).to.equal('20111130161100-emptyMigration.js')
            done()
          })
        })
      })
    })
  })

  describe('migrations', function() {
    beforeEach(function(done) {
      var self = this

      this.init({ from: 20111117063700, to: 20111117063700 }, function(migrator) {
        self.migrator = migrator
        self.migrator.migrate().success(done)
      })
    })

    describe('executions', function() {
      it("supports coffee files", function(done) {
        var self = this

        this.init({
          filesFilter: /\.coffee$/,
          to: 20111130161100
        }, function(migrator) {
          self.migrator = migrator
          self.migrator.migrate().success(function() {
            self.sequelize.getQueryInterface().showAllTables().success(function(tableNames) {
              tableNames = tableNames.filter(function(e){ return e != 'SequelizeMeta' })
              expect(tableNames).to.eql([ 'Person' ])
              done()
            })
          })
        })
      })

      it("executes migration #20111117063700 and correctly creates the table", function(done) {
        this.sequelize.getQueryInterface().showAllTables().success(function(tableNames) {
          tableNames = tableNames.filter(function(e){ return e != 'SequelizeMeta' })
          expect(tableNames).to.eql([ 'Person' ])
          done()
        })
      })

      it("executes migration #20111117063700 and correctly adds isBetaMember", function(done) {
        this.sequelize.getQueryInterface().describeTable('Person').success(function(data) {
          var fields = Object.keys(data).sort()
          expect(fields).to.eql([ 'isBetaMember', 'name' ])
          done()
        })
      })

      it("executes migration #20111117063700 correctly up (createTable) and downwards (dropTable)", function(done) {
        var self = this

        this.sequelize.getQueryInterface().showAllTables().success(function(tableNames) {
          tableNames = tableNames.filter(function(e){ return e != 'SequelizeMeta' })
          expect(tableNames).to.eql([ 'Person' ])

          self.migrator.migrate({ method: 'down' }).success(function() {
            self.sequelize.getQueryInterface().showAllTables().success(function(tableNames) {
              tableNames = tableNames.filter(function(e){ return e != 'SequelizeMeta' })
              expect(tableNames).to.eql([])
              done()
            })
          })
        })
      })

      it("executes the empty migration #20111130161100", function(done) {
        this.init({ from: 20111130161100, to: 20111130161100 }, function(migrator) {
          // this migration isn't actually testing anything but
          // should not timeout

          // expect(1).to.equal(1)

          migrator
            .migrate()
            .success(done)
            .error(function(err) { console.log(err) })
        })
      })
    })

    describe('renameTable', function() {
      beforeEach(function(done) {
        var self = this

        this.init({ from: 20111117063700, to: 20111117063700 }, function(migrator) {
          self.migrator = migrator
          self.migrator.migrate().success(done)
        })
      })

      it("executes migration #20111205064000 and renames a table", function(done) {
        var self = this

        this.sequelize.getQueryInterface().showAllTables().success(function(tableNames) {
          tableNames = tableNames.filter(function(e) { return e != 'SequelizeMeta' })
          expect(tableNames).to.include('Person')

          self.init({ from: 20111205064000, to: 20111205064000 }, function(migrator) {
            migrator.migrate().success(function() {
              self.sequelize.getQueryInterface().showAllTables().success(function(tableNames) {
                tableNames = tableNames.filter(function(e){ return e != 'SequelizeMeta' })
                expect(tableNames).to.eql([ 'User' ])
                done()
              })
            })
          })
        })
      })
    })

    describe('addColumn', function() {
      it('adds a unique column to the user table', function(done) {
        var self = this

        this.init({ from: 20111117063700, to: 20111205167000 }, function(migrator) {
          migrator.migrate().complete(function(err) {
            self.sequelize.getQueryInterface().describeTable('User').complete(function(err, data) {
              var signature = data.signature
                , isAdmin   = data.isAdmin
                , shopId    = data.shopId

              expect(signature.allowNull).to.be.true
              expect(isAdmin.allowNull).to.be.false
              if (dialect === "postgres" || dialect === "postgres-native" || dialect === "sqlite") {
                expect(isAdmin.defaultValue).to.be.false
              } else {
                expect(isAdmin.defaultValue).to.equal("0")
              }
              expect(shopId.allowNull).to.be.true

              done()
            })
          })
        })
      })

      it('adds a column to the user table', function(done) {
        var self = this

        this.init({ from: 20111117063700, to: 20111205162700 }, function(migrator) {
          migrator.migrate().complete(function(err) {
            self.sequelize.getQueryInterface().describeTable('User').complete(function(err, data) {
              var signature = data.signature
                , isAdmin   = data.isAdmin
                , shopId    = data.shopId

              expect(signature.allowNull).to.be.true
              expect(isAdmin.allowNull).to.be.false
              if (dialect === "postgres" || dialect === "postgres-native" || dialect === "sqlite") {
                expect(isAdmin.defaultValue).to.be.false
              } else {
                expect(isAdmin.defaultValue).to.equal("0")
              }
              expect(shopId.allowNull).to.be.true

              done()
            })
          })
        })
      })
    })

    describe('removeColumn', function() {
      it('removes the shopId column from user', function(done) {
        var self = this

        this.init({ to: 20111206061400 }, function(migrator) {
          migrator.migrate().success(function(){
            self.sequelize.getQueryInterface().describeTable('User').success(function(data) {
              var signature = data.signature
                , isAdmin   = data.isAdmin
                , shopId    = data.shopId

              expect(signature.allowNull).to.be.true
              expect(isAdmin.allowNull).to.be.false
              if (dialect === "postgres" || dialect === "postgres-native" || dialect === "sqlite") {
                expect(isAdmin.defaultValue).to.be.false
              } else {
                expect(isAdmin.defaultValue).to.equal("0")
              }
              expect(shopId).to.be.not.ok

              done()
            })
          })
        })
      })
    })

    describe('changeColumn', function() {
      it('changes the signature column from user to default "signature" + notNull', function(done) {
        var self = this

        this.init({ to: 20111206063000 }, function(migrator) {
          migrator.migrate().success(function() {
            self.sequelize.getQueryInterface().describeTable('User').success(function(data) {
              var signature = data.signature

              if (dialect === 'postgres') {
                expect(signature.type).to.equal('CHARACTER VARYING')
              } else {
                expect(signature.type).to.equal('VARCHAR(255)')
              }
              expect(signature.allowNull).to.equal(false)
              expect(signature.defaultValue).to.equal('Signature')

              done()
            })
          })
        })
      })

      it('changes the level column from user and casts the data to the target enum type', function(done) {
        var self = this

        this.init({ to: 20111205163000 }, function(migrator) {
          migrator.migrate().success(function() {
            self.sequelize.getQueryInterface().describeTable('User').complete(function(err, data) {
              var level = data.level;

              if (dialect === 'postgres') {
                expect(level.type).to.equal('USER-DEFINED');
              } else if (dialect === 'sqlite') {
                expect(level.type).to.equal('TEXT');
              } else {
                expect(level.type).to.equal('ENUM(\'BASIC\',\'ADVANCED\')');
              }

              done()
            })
          })
        })
      })
    })

  })

  describe('renameColumn', function() {
    it("renames the signature column from user to sig", function(done) {
      var self = this

      this.init({ to: 20111206163300 }, function(migrator) {
        migrator.migrate().success(function(){
          self.sequelize.getQueryInterface().describeTable('User').success(function(data) {
            var signature = data.signature
              , sig       = data.sig

            expect(signature).to.not.be.ok
            expect(sig).to.be.ok

            done()
          })
        })
      })
    })
  })

  if (dialect.match(/^postgres/)) {

    describe('function migrations', function() {
      var generateFunctionCountQuery = function generateFunctionCountQuery(functionName, langName) {
        return [
            'SELECT * FROM pg_proc p LEFT OUTER JOIN pg_language l ON (l.oid = p.prolang)',
            'WHERE p.proname = \'' + functionName + '\' AND l.lanname = \'' + langName + '\';'
          ].join('\n')
      }
      var FUNC_NAME = 'get_an_answer'
      var RENAME_FUNC_NAME = 'get_the_answer'

      // Set up the table and trigger
      before(function(done){
        this.init({ from: 20130909174103, to: 20130909174103}, function(migrator) {
          migrator.migrate().success(function(){
            done()
          })
        })
      })


      it("creates a function " + FUNC_NAME + "()", function(done) {
        this.sequelize.query(generateFunctionCountQuery(FUNC_NAME, 'plpgsql')).success(function(rows){
          expect(rows.length).to.equal(1)
          done()
        })
      })

      it("renames a function " + FUNC_NAME + "() to " + RENAME_FUNC_NAME + "()", function(done) {
        var self = this
        this.init({ from: 20130909174253, to: 20130909174253 }, function(migrator) {
          migrator.migrate().success(function(){
            self.sequelize.query(generateFunctionCountQuery(FUNC_NAME, 'plpgsql')).success(function(rows){
              expect(rows.length).to.equal(0)
              self.sequelize.query(generateFunctionCountQuery(RENAME_FUNC_NAME, 'plpgsql')).success(function(rows){
                expect(rows.length).to.equal(1)
                done()
              })
            })
          })
        })
      })

      it("deletes a function " + RENAME_FUNC_NAME + "()", function(done) {
        var self = this
        this.init({ from: 20130909175000, to: 20130909175000 }, function(migrator) {
          migrator.migrate().success(function(){
            self.sequelize.query(generateFunctionCountQuery(RENAME_FUNC_NAME, 'plpgsql')).success(function(rows){
              expect(rows.length).to.equal(0)
              done()
            })
          })
        })
      })
    })

    describe('test trigger migrations', function() {
      var generateTriggerCountQuery = function generateTriggerCountQuery(triggerName) {
        return 'SELECT * FROM pg_trigger where tgname = \'' + triggerName + '\''
      }
      var generateTableCountQuery = function generateTableCountQuery(functionName, schemaName) {
        return 'SELECT * FROM pg_tables where tablename = \'' + functionName + '\' and schemaname = \'' + schemaName + '\''
      }
      var TRIGGER_NAME = 'updated_at'
      var RENAME_TRIGGER_NAME = 'update_updated_at'
      var TABLE_NAME = 'trigger_test'
      var CATALOG_NAME = 'public'

      // Make sure the function is present
      before(function(done){
        this.sequelize.query("CREATE FUNCTION bump_updated_at()\n" +
            "RETURNS TRIGGER AS $$\n" +
            "BEGIN\n" +
            "NEW.updated_at = now();\n" +
            "RETURN NEW;\n" +
            "END;\n" +
            "$$ language 'plpgsql';"
        ).success(function() {done()})

      })

      // Clean up the function
      after(function(done){
        this.sequelize.query("DROP FUNCTION IF EXISTS bump_updated_at()").success(function(){ done(); })
      })

      it("creates a trigger updated_at on trigger_test", function(done) {
        var self = this
        this.init({ from: 20130909175939, to: 20130909180846}, function(migrator) {
          migrator.migrate().success(function(){
            self.sequelize.query(generateTableCountQuery(TABLE_NAME, CATALOG_NAME)).success(function(rows){
              expect(rows.length).to.equal(1)
              self.sequelize.query(generateTriggerCountQuery(TRIGGER_NAME)).success(function(rows){
                expect(rows.length).to.equal(1)
                done()
              })
            })
          })
        })
      })

      it("renames a trigger on " + TABLE_NAME + " from " + TRIGGER_NAME + " to " + RENAME_TRIGGER_NAME, function(done){
        var self = this
        this.init({ from: 20130909175939, to: 20130909181148}, function(migrator) {
          migrator.migrate().success(function(){
            self.sequelize.query(generateTableCountQuery(TABLE_NAME, CATALOG_NAME)).success(function(rows){
              expect(rows.length).to.equal(1)
              self.sequelize.query(generateTriggerCountQuery(RENAME_TRIGGER_NAME)).success(function(rows){
                expect(rows.length).to.equal(1)
                self.sequelize.query(generateTriggerCountQuery(TRIGGER_NAME)).success(function(rows){
                  expect(rows.length).to.equal(0)
                  done()
                })
              })
            })
          })
        })
      })

      it("deletes a trigger " + TRIGGER_NAME + " on trigger_test", function(done) {
        var self = this
        this.init({ from: 20130909175939, to: 20130909185621}, function(migrator) {
          migrator.migrate().success(function(){
            self.sequelize.query(generateTriggerCountQuery(TRIGGER_NAME)).success(function(rows){
              expect(rows.length).to.equal(0)
              migrator.migrate({method: 'down'}).success(function(){
                self.sequelize.query(generateTableCountQuery(TABLE_NAME, CATALOG_NAME)).success(function(rows){
                  expect(rows.length).to.equal(0)
                  done()
                })
              })
            })
          })
        })
      })

    })

  } // if dialect postgres
})
