var config         = require("./config/config")
  , Sequelize      = require("../index")
  , QueryInterface = require("../lib/query-interface")

describe('Sequelize', function() {
  var sequelize = null
    , Helpers   = null


  var setup = function(options) {
    options   = options || {logging: false}
    sequelize = new Sequelize(config.mysql.database, config.mysql.username, config.mysql.password, options)
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

    it("overwrites global options", function() {
      setup({ define: { collate: 'utf8_general_ci' } })
      var DAO = sequelize.define('foo', {bar: Sequelize.STRING}, {collate: 'utf8_bin'})
      expect(DAO.options.collate).toEqual('utf8_bin')
    })

    it("inherits global collate option", function() {
      setup({ define: { collate: 'utf8_general_ci' } })
      var DAO = sequelize.define('foo', {bar: Sequelize.STRING})
      expect(DAO.options.collate).toEqual('utf8_general_ci')
    })

    it("inherits global classMethods and instanceMethods", function() {
      setup({
        define: {
          classMethods : { globalClassMethod : function() {} },
          instanceMethods : { globalInstanceMethod : function() {} }
        }
      })

      var DAO = sequelize.define('foo', {bar: Sequelize.STRING}, {
        classMethods : { localClassMethod : function() {} }
      })

      expect(typeof DAO.options.classMethods.globalClassMethod).toEqual('function')
      expect(typeof DAO.options.classMethods.localClassMethod).toEqual('function')
      expect(typeof DAO.options.instanceMethods.globalInstanceMethod).toEqual('function')
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
