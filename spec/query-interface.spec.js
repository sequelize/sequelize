if(typeof require === 'function') {
  const buster             = require("buster")
      , CustomEventEmitter = require("../lib/emitters/custom-event-emitter")
      , Helpers            = require('./buster-helpers')
      , dialect            = Helpers.getTestDialect()
}

buster.spec.expose()
buster.testRunner.timeout = 1000

describe(Helpers.getTestDialectTeaser("QueryInterface"), function() {
  before(function(done) {
    Helpers.initTests({
      dialect: dialect,
      beforeComplete: function(sequelize) {
        this.sequelize = sequelize
      }.bind(this),
      onComplete: function() {
        this.interface = this.sequelize.getQueryInterface()
        done()
      }.bind(this)
    })
  })

  describe('dropAllTables', function() {
    it("should drop all tables", function(done) {
      this.interface.dropAllTables().complete(function(err) {
        expect(err).toBeNull()

        this.interface.showAllTables().complete(function(err, tableNames) {
          expect(err).toBeNull()
          expect(tableNames.length).toEqual(0)

          this.interface.createTable('table', { name: Helpers.Sequelize.STRING }).complete(function(err) {
            expect(err).toBeNull()

            this.interface.showAllTables().complete(function(err, tableNames) {
              expect(err).toBeNull()
              expect(tableNames.length).toEqual(1)

              this.interface.dropAllTables().complete(function(err) {
                expect(err).toBeNull()

                this.interface.showAllTables().complete(function(err, tableNames) {
                  expect(err).toBeNull()
                  expect(tableNames.length).toEqual(0)
                  done()
                })
              }.bind(this))
            }.bind(this))
          }.bind(this))
        }.bind(this))
      }.bind(this))
    })
  })

  describe('indexes', function() {
    before(function(done) {
      this.interface.createTable('User', {
        username: Helpers.Sequelize.STRING,
        isAdmin: Helpers.Sequelize.BOOLEAN
      }).success(done)
    })

    it('adds, reads and removes an index to the table', function(done) {
      this.interface.addIndex('User', ['username', 'isAdmin']).complete(function(err) {
        expect(err).toBeNull()

        this.interface.showIndex('User').complete(function(err, indexes) {
          expect(err).toBeNull()

          var indexColumns = Helpers.Sequelize.Utils._.uniq(indexes.map(function(index) { return index.name }))
          expect(indexColumns).toEqual(['user_username_is_admin'])

          this.interface.removeIndex('User', ['username', 'isAdmin']).complete(function(err) {
            expect(err).toBeNull()

            this.interface.showIndex('User').complete(function(err, indexes) {
              expect(err).toBeNull()

              indexColumns = Helpers.Sequelize.Utils._.uniq(indexes.map(function(index) { return index.name }))
              expect(indexColumns).toEqual([])

              done()
            })
          }.bind(this))
        }.bind(this))
      }.bind(this))
    })
  })

  describe('describeTable', function() {
    before(function(done) {
      this.interface.createTable('User', {
        username: Helpers.Sequelize.STRING,
        isAdmin: Helpers.Sequelize.BOOLEAN
      }).success(done)
    })

    it('reads the metadata of the table', function(done) {
      this.interface.describeTable('User').complete(function(err, metadata) {
        expect(err).toBeNull()

        var username = metadata.username
        var isAdmin  = metadata.isAdmin

        expect(username.type).toEqual(dialect === 'postgres' ? 'CHARACTER VARYING' : 'VARCHAR(255)')
        expect(username.allowNull).toBeTrue()
        expect(username.defaultValue).toBeNull()

        expect(isAdmin.type).toEqual(dialect === 'postgres' ? 'BOOLEAN' : 'TINYINT(1)')
        expect(isAdmin.allowNull).toBeTrue()
        expect(isAdmin.defaultValue).toBeNull()

        done()
      })
    })
  })
})
