var config    = require("../config/config")
  , Sequelize = require("../../index")
  , sequelize = new Sequelize(config.mysql.database, config.mysql.username, config.mysql.password, { pool: config.mysql.pool, logging: false, host: config.mysql.host, port: config.mysql.port })
  , Helpers   = new (require("../config/helpers"))(sequelize)

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
          expect(sequelize.daoFactoryManager.getDAO('wp_table1swp_table2s')).toBeDefined()
          done()
        })
      })
    })
    describe('when join table name is specified', function() {
      var Table2 = sequelize.define('ms_table1', {foo: Sequelize.STRING})
        , Table1 = sequelize.define('ms_table2', {foo: Sequelize.STRING})

      Table1.hasMany(Table2, {joinTableName: 'table1_to_table2'})
      Table2.hasMany(Table1, {joinTableName: 'table1_to_table2'})

      it("should not use a combined name", function() {
        expect(sequelize.daoFactoryManager.getDAO('ms_table1sms_table2s')).toBeUndefined()
      })
      it("should use the specified name", function() {
        expect(sequelize.daoFactoryManager.getDAO('table1_to_table2')).toBeDefined()
      })
    })
  })

})
