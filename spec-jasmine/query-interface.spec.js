var config         = require("./config/config")
  , Sequelize      = require("../index")
  , sequelize      = new Sequelize(config.mysql.database, config.mysql.username, config.mysql.password, { logging: false })
  , Helpers        = new (require("./config/helpers"))(sequelize)
  , QueryInterface = require("../lib/query-interface")

describe('QueryInterface', function() {
  var interface = null

  beforeEach(function() {
    interface = sequelize.getQueryInterface()
    Helpers.dropAllTables()
  })

  afterEach(function() {
    interface = null
    Helpers.dropAllTables()
  })

  describe('dropAllTables', function() {
    it("should drop all tables", function() {
      Helpers.async(function(done) {
        interface.dropAllTables().success(done).error(function(err) { console.log(err) })
      })

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

  describe('indexes', function() {
    beforeEach(function(){
      Helpers.async(function(done) {
        interface.createTable('User', {
          username: Sequelize.STRING,
          isAdmin: Sequelize.BOOLEAN
        }).success(done)
      })
    })

    it('adds, reads and removes an index to the table', function() {
      Helpers.async(function(done) {
        interface.addIndex('User', ['username', 'isAdmin']).success(done).error(function(err) {
          console.log(err)
        })
      })

      Helpers.async(function(done) {
        interface.showIndex('User').success(function(indexes) {
          var indexColumns = indexes.map(function(index) { return index.Column_name }).sort()
          expect(indexColumns).toEqual(['isAdmin', 'username'])
          done()
        }).error(function(err) { console.log(err) })
      })

      Helpers.async(function(done) {
        interface.removeIndex('User', ['username', 'isAdmin']).success(done).error(function(err) {
          console.log(err)
        })
      })

      Helpers.async(function(done) {
        interface.showIndex('User').success(function(indexes) {
          var indexColumns = indexes.map(function(index) { return index.Column_name }).sort()
          expect(indexColumns).toEqual([])
          done()
        }).error(function(err) { console.log(err) })
      })
    })
  })
})
