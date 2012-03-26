var Utils          = require("./utils")
  , DAOFactory   = require("./dao-factory")
  , DataTypes      = require('./data-types')
  , DAOFactoryManager   = require("./dao-factory-manager")
  , Migrator       = require("./migrator")
  , QueryInterface = require("./query-interface")

module.exports = (function() {
  var Sequelize = function(database, username, password, options) {
    this.options = Utils._.extend({
      dialect: 'mysql',
      host: 'localhost',
      port: 3306,
      define: {},
      query: {},
      sync: {}
    }, options || {})

    this.config = {
      database: database,
      username: username,
      password: (( (["", null, false].indexOf(password) > -1) || (typeof password == 'undefined')) ? null : password),
      host    : this.options.host,
      port    : this.options.port,
      pool    : this.options.pool
    }

    var ConnectorManager = require("./dialects/" + this.options.dialect + "/connector-manager")

    this.daoFactoryManager     = new DAOFactoryManager(this)
    this.connectorManager = new ConnectorManager(this, this.config)
  }

  Sequelize.Utils = Utils
  Sequelize.Utils._.map(DataTypes, function(sql, accessor) { Sequelize[accessor] = sql})

  Sequelize.prototype.getQueryInterface = function() {
    this.queryInterface = this.queryInterface || new QueryInterface(this)
    return this.queryInterface
  }

  Sequelize.prototype.getMigrator = function(options, force) {
    if(force)
      this.migrator = new Migrator(this, options)
    else
      this.migrator = this.migrator || new Migrator(this, options)

    return this.migrator
  }

  Sequelize.prototype.define = function(daoName, attributes, options) {
    options = options || {}

    if(this.options.define)
      options = Sequelize.Utils.merge(options, this.options.define)

    var factory = new DAOFactory(daoName, attributes, options)

    this.daoFactoryManager.addDAO(factory.init(this.daoFactoryManager))

    return factory
  }

  Sequelize.prototype.import = function(path) {
    var defineCall = require(path)
    return defineCall(this, DataTypes)
  }

  Sequelize.prototype.migrate = function(options) {
    this.getMigrator().migrate(options)
  }

  Sequelize.prototype.query = function(sql, callee, options) {
    options = Utils._.extend(Utils._.clone(this.options.query), options || {})
    options = Utils._.extend(options, {
      logging: this.options.hasOwnProperty('logging') ? this.options.logging : true
    })

    return this.connectorManager.query(sql, callee, options)
  }

  Sequelize.prototype.sync = function(options) {
    options = options || {}

    if(this.options.sync)
      options = Sequelize.Utils.merge(options, this.options.sync)

    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      var chainer = new Utils.QueryChainer

      self.daoFactoryManager.daos.forEach(function(dao) { chainer.add(dao.sync(options)) })

      chainer
        .run()
        .success(function() { emitter.emit('success', null) })
        .error(function(err) { emitter.emit('failure', err) })
    }).run()
  }

  Sequelize.prototype.drop = function() {
    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      var chainer = new Utils.QueryChainer

      self.daoFactoryManager.daos.forEach(function(dao) { chainer.add(dao.drop()) })

      chainer
        .run()
        .success(function() { emitter.emit('success', null) })
        .error(function(err) { emitter.emit('failure', err) })
    }).run()
  }

  return Sequelize
})()
