var buster             = require("buster")
  , Helpers            = require('./buster-helpers')
  , dialect            = Helpers.getTestDialect()

buster.spec.expose()
buster.testRunner.timeout = 1000

describe(Helpers.getTestDialectTeaser("QueryInterface"), function() {
  var sequelize = Helpers.createSequelizeInstance({dialect: dialect})

  before(function(done) {
    this.sequelize = sequelize
    this.interface = this.sequelize.getQueryInterface()
    Helpers.clearDatabase(this.sequelize, done)
  })

  describe('dropAllTables', function() {
    it("should drop all tables", function(done) {
      var self = this
      this.interface.dropAllTables().complete(function(err) {
        expect(err).toBeNull()

        self.interface.showAllTables().complete(function(err, tableNames) {
          expect(err).toBeNull()
          expect(tableNames.length).toEqual(0)

          self.interface.createTable('table', { name: Helpers.Sequelize.STRING }).complete(function(err) {
            expect(err).toBeNull()

            self.interface.showAllTables().complete(function(err, tableNames) {
              expect(err).toBeNull()
              expect(tableNames.length).toEqual(1)

              self.interface.dropAllTables().complete(function(err) {
                expect(err).toBeNull()

                self.interface.showAllTables().complete(function(err, tableNames) {
                  expect(err).toBeNull()
                  expect(tableNames.length).toEqual(0)
                  done()
                })
              })
            })
          })
        })
      })
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
      var self = this
      this.interface.addIndex('User', ['username', 'isAdmin']).complete(function(err) {
        expect(err).toBeNull()

        self.interface.showIndex('User').complete(function(err, indexes) {
          expect(err).toBeNull()

          var indexColumns = Helpers.Sequelize.Utils._.uniq(indexes.map(function(index) { return index.name }))
          expect(indexColumns).toEqual(['user_username_is_admin'])

          self.interface.removeIndex('User', ['username', 'isAdmin']).complete(function(err) {
            expect(err).toBeNull()

            self.interface.showIndex('User').complete(function(err, indexes) {
              expect(err).toBeNull()

              indexColumns = Helpers.Sequelize.Utils._.uniq(indexes.map(function(index) { return index.name }))
              expect(indexColumns).toEqual([])

              done()
            })
          })
        })
      })
    })
  })

  describe('describeTable', function() {
    it('reads the metadata of the table', function(done) {
      var self = this
      var Users = self.sequelize.define('User', {
        username: Helpers.Sequelize.STRING,
        isAdmin: Helpers.Sequelize.BOOLEAN,
        enumVals: Helpers.Sequelize.ENUM('hello', 'world')
      }, { freezeTableName: true })

      Users.sync({ force: true }).success(function() {
        self.interface.describeTable('User').complete(function(err, metadata) {
          expect(err).toBeNull()

          var username = metadata.username
          var isAdmin  = metadata.isAdmin
          var enumVals = metadata.enumVals

          expect(username.type).toEqual(dialect === 'postgres' ? 'CHARACTER VARYING' : 'VARCHAR(255)')
          expect(username.allowNull).toBeTrue()
          expect(username.defaultValue).toBeNull()

          expect(isAdmin.type).toEqual(dialect === 'postgres' ? 'BOOLEAN' : 'TINYINT(1)')
          expect(isAdmin.allowNull).toBeTrue()
          expect(isAdmin.defaultValue).toBeNull()

          if (dialect === "postgres" || dialect === "postgres-native") {
            expect(enumVals.special).toBeArray();
            expect(enumVals.special.length).toEqual(2);
          }

          done()
        })
      })
    })
  })
})
