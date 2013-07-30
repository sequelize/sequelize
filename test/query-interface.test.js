var chai      = require('chai')
  , expect    = chai.expect
  , Support   = require(__dirname + '/support')
  , DataTypes = require(__dirname + "/../lib/data-types")
  , dialect   = Support.getTestDialect()
  , _         = require('lodash')

chai.Assertion.includeStack = true

describe(Support.getTestDialectTeaser("QueryInterface"), function () {
  beforeEach(function(done) {
    this.sequelize.options.quoteIdenifiers = true
    this.queryInterface = this.sequelize.getQueryInterface()
    done()
  })

  describe('dropAllTables', function() {
    it("should drop all tables", function(done) {
      var self = this
      this.queryInterface.dropAllTables().complete(function(err) {
        expect(err).to.be.null

        self.queryInterface.showAllTables().complete(function(err, tableNames) {
          expect(err).to.be.null
          expect(tableNames).to.be.empty

          self.queryInterface.createTable('table', { name: DataTypes.STRING }).complete(function(err) {
            expect(err).to.be.null

            self.queryInterface.showAllTables().complete(function(err, tableNames) {
              expect(err).to.be.null
              expect(tableNames).to.have.length(1)

              self.queryInterface.dropAllTables().complete(function(err) {
                expect(err).to.be.null

                self.queryInterface.showAllTables().complete(function(err, tableNames) {
                  expect(err).to.be.null
                  expect(tableNames).to.be.empty
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
    beforeEach(function(done) {
      var self = this
      this.queryInterface.dropTable('Users').success(function() {
        self.queryInterface.createTable('Users', {
          username: DataTypes.STRING,
          isAdmin: DataTypes.BOOLEAN
        }).success(function() {
          done()
        })
      })
    })

    it('adds, reads and removes an index to the table', function(done) {
      var self = this

      this.queryInterface.addIndex('Users', ['username', 'isAdmin']).complete(function(err) {
        expect(err).to.be.null

        self.queryInterface.showIndex('Users').complete(function(err, indexes) {
          expect(err).to.be.null

          var indexColumns = _.uniq(indexes.map(function(index) { return index.name }))
          expect(indexColumns).to.include('users_username_is_admin')

          self.queryInterface.removeIndex('Users', ['username', 'isAdmin']).complete(function(err) {
            expect(err).to.be.null

            self.queryInterface.showIndex('Users').complete(function(err, indexes) {
              expect(err).to.be.null

              indexColumns = _.uniq(indexes.map(function(index) { return index.name }))
              expect(indexColumns).to.be.empty

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
      var Users = self.sequelize.define('_Users', {
        username: DataTypes.STRING,
        isAdmin: DataTypes.BOOLEAN,
        enumVals: DataTypes.ENUM('hello', 'world')
      }, { freezeTableName: true })

      Users.sync({ force: true }).success(function() {
        self.queryInterface.describeTable('_Users').complete(function(err, metadata) {
          expect(err).to.be.null

          var username = metadata.username
          var isAdmin  = metadata.isAdmin
          var enumVals = metadata.enumVals

          expect(username.type).to.equal(dialect === 'postgres' ? 'CHARACTER VARYING' : 'VARCHAR(255)')
          expect(username.allowNull).to.be.true
          expect(username.defaultValue).to.be.null

          expect(isAdmin.type).to.equal(dialect === 'postgres' ? 'BOOLEAN' : 'TINYINT(1)')
          expect(isAdmin.allowNull).to.be.true
          expect(isAdmin.defaultValue).to.be.null

          if (dialect === "postgres" || dialect === "postgres-native") {
            expect(enumVals.special).to.be.instanceof(Array)
            expect(enumVals.special).to.have.length(2);
          }

          done()
        })
      })
    })
  })
})
