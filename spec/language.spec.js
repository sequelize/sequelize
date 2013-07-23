var buster      = require("buster")
    , Sequelize = require("../index")
    , Helpers   = require('./buster-helpers')
    , dialect   = Helpers.getTestDialect()

buster.spec.expose()
buster.testRunner.timeout = 1000

describe(Helpers.getTestDialectTeaser("Language Util"), function() {
  describe("Plural", function(){
    beforeAll(function(done) {
      var self = this
      Helpers.initTests({
        dialect: dialect,
        onComplete: function(sequelize) {
          self.sequelize = sequelize
          self.sequelize.options.language = 'es'
          done()
        }
      })
    })

    it("should rename tables to their plural form...", function(done){
      var table = this.sequelize.define('arbol', {name: Sequelize.STRING})
      var table2 = this.sequelize.define('androide', {name: Sequelize.STRING})
      expect(table.tableName).toEqual('arboles')
      expect(table2.tableName).toEqual('androides')
      done()
    })

    it("should be able to pluralize/singularize associations...", function(done){
      var table = this.sequelize.define('arbol', {name: Sequelize.STRING})
      var table2 = this.sequelize.define('androide', {name: Sequelize.STRING})
      var table3 = this.sequelize.define('hombre', {name: Sequelize.STRING})

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
