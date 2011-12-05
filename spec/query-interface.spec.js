var config         = require("./config/config")
  , Sequelize      = require("../index")
  , sequelize      = new Sequelize(config.database, config.username, config.password, { logging: false })
  , Helpers        = new (require("./config/helpers"))(sequelize)
  , QueryInterface = require("../lib/query-interface")

describe('QueryInterface', function() {
  describe('dropAllTables', function() {
    var interface = null

    beforeEach(function() {
      interface = sequelize.getQueryInterface()
      Helpers.dropAllTables()
    })

    afterEach(function() {
      interface = null
      Helpers.dropAllTables()
    })

    it("should drop all tables", function() {
      Helpers.async(function(done) {
        interface.showAllTables().success(function(tableNames) {
          expect(tableNames.length).toEqual(0)
          done()
        })
      })

      Helpers.async(function(done) {
        interface.createTable('table', { name: Sequelize.STRING })
          .success(done)
          .error(function(err){ console.log(err)})
      })

      Helpers.async(function(done) {
        interface.showAllTables().success(function(tableNames) {
          expect(tableNames.length).toEqual(1)
          done()
        })
      })

      Helpers.async(function(done) {
        interface.dropAllTables().success(done).error(function(err) { console.log(err) })
      })

      Helpers.async(function(done) {
        interface.showAllTables().success(function(tableNames) {
          expect(tableNames.length).toEqual(0)
          done()
        })
      })
    })
  })
})
