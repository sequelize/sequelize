var config    = require("./config/config")
  , Sequelize = require("../index")

describe('Sequelize', function() {
  var sequelize = null


  var setup = function(options) {
    sequelize = new Sequelize(config.database, config.username, config.password, options)
    return options
  }

  beforeEach(function() { setup() })
  afterEach(function() { sequelize = null })

  describe('constructor', function() {
    it('should pass the global options correctly', function() {
      setup({ logging: false, define: { underscored:true } })

      var Model = sequelize.define('model', {name: Sequelize.STRING})
      expect(Model.options.underscored).toBeTruthy()
    })

    it('should correctly set the host and the port', function() {
      var options = setup({ host: '127.0.0.1', port: 1234 })

      expect(sequelize.config.host).toEqual(options.host)
      expect(sequelize.config.port).toEqual(options.port)
    })
  })

  describe('define', function() {
    it("adds a new model to the model manager", function() {
      expect(sequelize.modelManager.all.length).toEqual(0)
      sequelize.define('foo', { title: Sequelize.STRING })
      expect(sequelize.modelManager.all.length).toEqual(1)
    })
  })
})
