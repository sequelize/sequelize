var buster      = require("buster")
    , Sequelize = require("../index")
    , Helpers   = require('./buster-helpers')
    , dialect   = Helpers.getTestDialect()

buster.spec.expose()
buster.testRunner.timeout = 1000

describe(Helpers.getTestDialectTeaser("Language Util"), function() {
  var sequelize = Helpers.createSequelizeInstance({dialect: dialect})
  describe("Plural", function(){
    before(function(done) {
      var self = this
      self.sequelize = Object.create(sequelize)
      self.sequelize.options.language = 'es'
      Helpers.clearDatabase(self.sequelize, done)
    })

    it("should rename tables to their plural form...", function(done){
      var self = this
        , table = self.sequelize.define('arbol', {name: Sequelize.STRING})
        , table2 = self.sequelize.define('androide', {name: Sequelize.STRING})

      expect(table.tableName).toEqual('arboles')
      expect(table2.tableName).toEqual('androides')
      done()
    })

    it("should be able to pluralize/singularize associations...", function(done){
      var self = this
        , table = self.sequelize.define('arbol', {name: Sequelize.STRING})
        , table2 = self.sequelize.define('androide', {name: Sequelize.STRING})
        , table3 = self.sequelize.define('hombre', {name: Sequelize.STRING})

      table.hasOne(table2)
      table2.belongsTo(table)
      table3.hasMany(table2)

      expect(table.associations.androides.identifier).toEqual('arbolId')
      expect(table2.associations.arboles).toBeDefined()
      expect(table3.associations.androideshombres).toBeDefined()
      done()
    })
  })
})
