var chai      = require('chai')
  , expect    = chai.expect
  , Sequelize = require(__dirname + '/../index')
  , Support   = require(__dirname + '/support')

chai.Assertion.includeStack = true

describe(Support.getTestDialectTeaser("Language Util"), function() {
  before(function(done) {
    this.sequelize.options.language = 'es'
    done()
  })

  after(function(done) {
    this.sequelize.options.language = 'en'
    done()
  })

  describe("Plural", function(){
    it("should rename tables to their plural form...", function(done){
      var self = this
        , table = self.sequelize.define('arbol', {name: Sequelize.STRING})
        , table2 = self.sequelize.define('androide', {name: Sequelize.STRING})

      expect(table.tableName).to.equal('arboles')
      expect(table2.tableName).to.equal('androides')
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

      expect(table.associations.androides.identifier).to.equal('arbolId')
      expect(table2.associations.arboles).to.exist
      expect(table3.associations.androideshombres).to.exist
      done()
    })
  })
})
