var Utils          = require("./utils")
  , DAOFactory   = require("./dao-factory")
  , DataTypes      = require('./data-types')
  , DAOFactoryManager   = require("./dao-factory-manager")
  , Migrator       = require("./migrator")
  , QueryInterface = require("./query-interface")
  , events = require('events')
  , util = require('util')

if(parseFloat(process.version.replace('v', '')) < 0.6) {
  console.log("DEPRECATION WARNING: Support for Node.JS < v0.6 will be canceled in the next minor release.")
}

module.exports = (function() {
  var Sequelize = function(database, username, password, options) {
    events.EventEmitter.call(this)
    var self = this

    this.options = Utils._.extend({
      dialect: 'mysql',
      host: 'localhost',
      port: 3306,
      utcoffset: null, // TODO: change this to '+0:00' after some number of releases
      define: {},
      query: {},
      sync: {},
      logging: console.log
    }, options || {})

    if(this.options.logging === true) {
      console.log('DEPRECATION WARNING: The logging-option should be either a function or false. Default: console.log')
      this.options.logging = console.log
    }

    if(this.options.logging == console.log) {
      // using just console.log will break in node < 0.6
      this.options.logging = function(s) { console.log(s) }
    }

    if(this.options.utcoffset === null ) {
      console.log("WARNING: You have not set a UTC offset using the 'utcoffset' option.  In future releases, this option will default to '+0:00' (UTC).")
    }
    
    this.config = {
      database: database,
      username: username,
      password: (( (["", null, false].indexOf(password) > -1) || (typeof password == 'undefined')) ? null : password),
      host    : this.options.host,
      port    : this.options.port,
      pool    : this.options.pool,
      utcoffset: this.options.utcoffset
    }

    var ConnectorManager = require("./dialects/" + this.options.dialect + "/connector-manager")

    this.daoFactoryManager = new DAOFactoryManager(this)
    this.connectorManager  = new ConnectorManager(this, this.config)
    this.connectorManager.on('connect', function( client ) {
      self.emit('connect', client)
    })
    this.connectorManager.on('disconnect', function( client ) {
      self.emit('disconnect', client)
    })
  }

  Sequelize.Utils = Utils
  Sequelize.Utils._.map(DataTypes, function(sql, accessor) { Sequelize[accessor] = sql})
  util.inherits(Sequelize, events.EventEmitter)

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
      logging: this.options.hasOwnProperty('logging') ? this.options.logging : console.log
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
