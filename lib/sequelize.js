var Utils             = require("./utils")
  , DAOFactory        = require("./dao-factory")
  , DataTypes         = require('./data-types')
  , DAOFactoryManager = require("./dao-factory-manager")
  , QueryInterface    = require("./query-interface")

module.exports = (function() {
  /**
    Main class of the project.

    @param {String} database The name of the database.
    @param {String} username The username which is used to authenticate against the database.
    @param {String} [password=null] The password which is used to authenticate against the database.
    @param {Object} [options={}] An object with options.
      @param {String} [options.dialect='mysql'] The dialect of the relational database.
      @param {String} [options.host='localhost'] The host of the relational database.
      @param {Integer} [options.port=3306] The port of the relational database.
      @param {String} [options.protocol='tcp'] The protocol of the relational database.
      @param {Object} [options.define={}] Options, which shall be default for every model definition.
      @param {Object} [options.query={}] I have absolutely no idea.
      @param {Object} [options.sync={}] Options, which shall be default for every `sync` call.
      @param {Function} [options.logging=console.log] A function that gets executed everytime Sequelize would log something.
      @param {Boolean} [options.omitNull=false] A flag that defines if null values should be passed to SQL queries or not.
      @param {Boolean} [options.queue=true] I have absolutely no idea.
      @param {Boolean} [options.native=false] A flag that defines if native library shall be used or not.
      @param {Boolean} [options.replication=false] I have absolutely no idea.
      @param {Object} [options.pool={}] Something.

    @example
        // without password and options
        var sequelize = new Sequelize('database', 'username')

        // without options
        var sequelize = new Sequelize('database', 'username', 'password')

        // without password / with blank password
        var sequelize = new Sequelize('database', 'username', null, {})

        // with password and options
        var sequelize = new Sequelize('my_database', 'john', 'doe', {})

    @class Sequelize
    @constructor
  */
  var Sequelize = function(database, username, password, options) {
    this.options = Utils._.extend({
      dialect: 'mysql',
      host: 'localhost',
      port: 3306,
      protocol: 'tcp',
      define: {},
      query: {},
      sync: {},
      logging: console.log,
      omitNull: false,
      queue: true,
      native: false,
      replication: false,
      pool: {}
    }, options || {})

    if (this.options.logging === true) {
      console.log('DEPRECATION WARNING: The logging-option should be either a function or false. Default: console.log')
      this.options.logging = console.log
    }

    this.config = {
      database: database,
      username: username,
      password: (( (["", null, false].indexOf(password) > -1) || (typeof password == 'undefined')) ? null : password),
      host    : this.options.host,
      port    : this.options.port,
      pool    : this.options.pool,
      protocol: this.options.protocol,
      queue   : this.options.queue,
      native  : this.options.native,
      replication: this.options.replication,
      maxConcurrentQueries: this.options.maxConcurrentQueries
    }

    var ConnectorManager = require("./dialects/" + this.options.dialect + "/connector-manager")

    this.daoFactoryManager = new DAOFactoryManager(this)
    this.connectorManager  = new ConnectorManager(this, this.config)

    this.importCache = {}
  }

  /**
    Reference to Utils
  */
  Sequelize.Utils = Utils

  for (var dataType in DataTypes) {
    Sequelize[dataType] = DataTypes[dataType]
  }

  /**
   Returns an instance of QueryInterface.

   @method getQueryInterface
   @return {QueryInterface} An instance (singleton) of QueryInterface.
   */
  Sequelize.prototype.getQueryInterface = function() {
    this.queryInterface = this.queryInterface || new QueryInterface(this)
    return this.queryInterface
  }

  /**
   Returns an instance (singleton) of Migrator.

   @method getMigrator
   @param {Object} [options={}] Some options
   @param {Boolean} [force=false] A flag that defines if the migrator should get instantiated or not.
   @return {Migrator} An instance of Migrator.
   */
  Sequelize.prototype.getMigrator = function(options, force) {
    var Migrator = require("./migrator")

    if (force) {
      this.migrator = new Migrator(this, options)
    } else {
      this.migrator = this.migrator || new Migrator(this, options)
    }

    return this.migrator
  }

  Sequelize.prototype.define = function(daoName, attributes, options) {
    options = options || {}
    var globalOptions = this.options

    if (globalOptions.define) {
      options = Utils._.extend({}, globalOptions.define, options)
      Utils._(['classMethods', 'instanceMethods']).each(function(key) {
        if (globalOptions.define[key]) {
          options[key] = options[key] || {}
          Utils._.extend(options[key], globalOptions.define[key])
        }
      })
    }
    options.omitNull = globalOptions.omitNull

    // if you call "define" multiple times for the same daoName, do not clutter the factory
    if(this.isDefined(daoName)) {
        this.daoFactoryManager.removeDAO(this.daoFactoryManager.getDAO(daoName))
    }

    var factory = new DAOFactory(daoName, attributes, options)
    this.daoFactoryManager.addDAO(factory.init(this.daoFactoryManager))
    return factory
  }

  Sequelize.prototype.isDefined = function(daoName) {
    var daos = this.daoFactoryManager.daos
    return (daos.filter(function(dao) { return dao.name === daoName }).length !== 0)
  }

  Sequelize.prototype.import = function(path) {
    if (!this.importCache[path]) {
      var defineCall = require(path)
      this.importCache[path] = defineCall(this, DataTypes)
    }

    return this.importCache[path]
  }

  Sequelize.prototype.migrate = function(options) {
    this.getMigrator().migrate(options)
  }

  Sequelize.prototype.query = function(sql, callee, options, replacements) {
    if (arguments.length === 4) {
      sql = Utils.format([sql].concat(replacements))
    } else if (arguments.length === 3) {
      options = options
    } else if (arguments.length === 2) {
      options = {}
    } else {
      options = { raw: true }
    }

    options = Utils._.extend(Utils._.clone(this.options.query), options)
    options = Utils._.defaults(options, {
      logging: this.options.hasOwnProperty('logging') ? this.options.logging : console.log,
      type: (sql.toLowerCase().indexOf('select') === 0) ? 'SELECT' : false
    })

    return this.connectorManager.query(sql, callee, options)
  }

  Sequelize.prototype.sync = function(options) {
    options = options || {}

    if (this.options.sync) {
      options = Utils._.extend({}, this.options.sync, options)
    }

    var chainer = new Utils.QueryChainer()

    this.daoFactoryManager.daos.forEach(function(dao) {
      chainer.add(dao.sync(options))
    })

    return chainer.run()
  }

  Sequelize.prototype.drop = function() {
    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      var chainer = new Utils.QueryChainer

      self.daoFactoryManager.daos.forEach(function(dao) { chainer.add(dao.drop()) })

      chainer
        .run()
        .success(function() { emitter.emit('success', null) })
        .error(function(err) { emitter.emit('error', err) })
    }).run()
  }

  return Sequelize
})()
