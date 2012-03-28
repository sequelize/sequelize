var config         = require("./config/config")
  , Sequelize      = require("../index")
  , QueryInterface = require("../lib/query-interface")

describe('Sequelize', function() {
  var sequelize = null
    , Helpers   = null


  var setup = function(options) {
    options   = options || {logging: false}
    sequelize = new Sequelize(config.database, config.username, config.password, options)
    Helpers   = new (require("./config/helpers"))(sequelize)

    return options
  }

  beforeEach(function() { setup() })
  afterEach(function() { sequelize = null })

  describe('constructor', function() {
    it('should pass the global options correctly', function() {
      setup({ logging: false, define: { underscored:true } })

      var DAO = sequelize.define('dao', {name: Sequelize.STRING})
      expect(DAO.options.underscored).toBeTruthy()
    })

    it('should correctly set the host and the port', function() {
      var options = setup({ host: '127.0.0.1', port: 1234 })

      expect(sequelize.config.host).toEqual(options.host)
      expect(sequelize.config.port).toEqual(options.port)
    })
  })

  describe('define', function() {
    it("adds a new dao to the dao manager", function() {
      expect(sequelize.daoFactoryManager.all.length).toEqual(0)
      sequelize.define('foo', { title: Sequelize.STRING })
      expect(sequelize.daoFactoryManager.all.length).toEqual(1)
    })
  })

  describe('sync', function() {
    it("synchronizes all daos", function() {
      var Project = sequelize.define('project' + config.rand(), { title: Sequelize.STRING })
      var Task = sequelize.define('task' + config.rand(), { title: Sequelize.STRING })

      Helpers.async(function(done) {
        sequelize.sync().success(function() {
          Project.create({title: 'bla'}).success(function() {
            Task.create({title: 'bla'}).success(done)
          })
        })
      })
    })
  })

  describe('import', function() {
    it("imports a dao definition from a file", function() {
      var Project = sequelize.import(__dirname + "/assets/project")
      expect(Project).toBeDefined()
    })
  })
})
