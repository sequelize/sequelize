var Utils        = require("./utils")
  , ModelFactory = require("./model-factory")
  , DataTypes    = require('./data-types')
  , ModelManager = require("./model-manager")

module.exports = (function() {
  var Sequelize = function(database, username, password, options) {
    this.options = Utils._.extend({
      connector: 'mysql',
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
      port    : this.options.port
    }

    var ConnectorManager = require("./connectors/" + this.options.connector + "/connector-manager")

    this.modelManager = new ModelManager(this)
    this.connectorManager = new ConnectorManager(this, this.config)
  }

  Sequelize.Utils = Utils
  Sequelize.Utils._.map(DataTypes, function(sql, accessor) { Sequelize[accessor] = sql})

  Sequelize.prototype.define = function(modelName, attributes, options) {
    options = options || {}

    if(this.options.define)
      options = Sequelize.Utils.merge(options, this.options.define)

    var model = this.modelManager.addModel(new ModelFactory(modelName, attributes, options))

    return model
  }

  Sequelize.prototype.import = function(path) {
    var defineCall = require(path)
    return defineCall(this, DataTypes)
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
    var eventEmitter = new Utils.CustomEventEmitter(function() {
      var chainer = new Utils.QueryChainer

      self.modelManager.models.forEach(function(model) { chainer.add(model.sync(options)) })

      chainer
        .run()
        .on('success', function() { eventEmitter.emit('success', null) })
        .on('failure', function(err) { eventEmitter.emit('failure', err) })
    })
    return eventEmitter.run()
  }

  Sequelize.prototype.drop = function() {
    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      var chainer = new Utils.QueryChainer

      self.modelManager.models.forEach(function(model) { chainer.add(model.drop()) })

      chainer
        .run()
        .on('success', function() { emitter.emit('success', null) })
        .on('failure', function(err) { emitter.emit('failure', err) })
    }).run()
  }

  return Sequelize
})()
