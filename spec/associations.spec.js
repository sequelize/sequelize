var config    = require("./config/config")
  , Sequelize = require("../index")
  , sequelize = new Sequelize(config.database, config.username, config.password, { logging: false })
  , Helpers   = new (require("./config/helpers"))(sequelize)

describe('Associations', function() {
  beforeEach(function() { Helpers.sync() })
  afterEach(function() { Helpers.drop() })

  /////////// many-to-many with same prefix ////////////

  describe('many-to-many', function() {
    describe('where tables have the same prefix', function() {
      var Table2 = sequelize.define('wp_table2', {foo: Sequelize.STRING})
        , Table1 = sequelize.define('wp_table1', {foo: Sequelize.STRING})

      Table1.hasMany(Table2)
      Table2.hasMany(Table1)

      it("should create a table wp_table1wp_table2s", function() {
        Helpers.async(function(done) {
          expect(sequelize.modelManager.getModel('wp_table1swp_table2s')).toBeDefined()
          done()
        })
      })
    })
  })

})
