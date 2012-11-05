var Utils             = require("./utils")
  , DAOFactory        = require("./dao-factory")
  , DataTypes         = require('./data-types')
  , DAOFactoryManager = require("./dao-factory-manager")
  , Migrator          = require("./migrator")
  , QueryInterface    = require("./query-interface")

if(parseFloat(process.version.replace('v', '')) < 0.6) {
  console.log("DEPRECATION WARNING: Support for Node.JS < v0.6 will be canceled in the next minor release.")
}

module.exports = (function() {
  /**
    Main constructor of the project.

    Params:

      - `database`
      - `username`
      - `password`, optional, default: null
      - `options`, optional, default: {}

    Examples:

        mymodule.write('foo')
        mymodule.write('foo', { stream: process.stderr })

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
      queue: true
    }, options || {})

    if(this.options.logging === true) {
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
      queue: this.options.queue
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

  Sequelize.prototype.getQueryInterface = function() {
    this.queryInterface = this.queryInterface || new QueryInterface(this)
    return this.queryInterface
  }

  Sequelize.prototype.getMigrator = function(options, force) {
    if(force) {
      this.migrator = new Migrator(this, options)
    } else {
      this.migrator = this.migrator || new Migrator(this, options)
    }

    return this.migrator
  }

  Sequelize.prototype.define = function(daoName, attributes, options) {
    options = options || {}
    if(this.options.define) {
      options = Sequelize.Utils.merge(options, this.options.define)
    }
    options.omitNull = this.options.omitNull

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

  Sequelize.prototype.query = function(sql, callee, options) {
    options = (arguments.length === 3) ? options : { raw: true }
    options = Utils._.extend(Utils._.clone(this.options.query), options)
    options = Utils._.extend(options, {
      logging: this.options.hasOwnProperty('logging') ? this.options.logging : console.log,
      type: (sql.toLowerCase().indexOf('select') === 0) ? 'SELECT' : false
    })

    return this.connectorManager.query(sql, callee, options)
  }

  Sequelize.prototype.sync = function(options) {
    options = options || {}

    if(this.options.sync) {
      options = Sequelize.Utils.merge(options, this.options.sync)
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
