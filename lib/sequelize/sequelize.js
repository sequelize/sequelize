var Utils           = require("./utils")
  , ModelDefinition = require("./model-definition")
  , Query           = require("./query")
  , DataTypes       = require('./data-types')

var Sequelize = module.exports = function(database, username, password, options) {
  options = options || {}

  var ModelManager = require("./model-manager")
  this.modelManager = new ModelManager(this)

  Utils._.reject(options, function(_, key) { return ["host", "port", "disableTableNameModification"].indexOf(key) > -1 })

  this.options = options
  this.config = {
    database: database,
    username: username,
    password: (( (["", null, false].indexOf(password) > -1) || (typeof password == 'undefined')) ? null : password),
    host    : options.host || 'localhost',
    port    : options.port || 3306
  }
  this.connectorCheckTimeoutId = null
}
Sequelize.Utils = Utils

var instanceMethods = {
  initConnector: function() {
    var self = this
    
    this.client = require("mysql").createClient({
      user: this.config.username,
      password: this.config.password,
      host: this.config.host,
      port: this.config.port,
      database: this.config.database
    })
    this.client.setMaxListeners(100)
  },
  
  freeConnector: function() {
    var self = this
    this.client.end(function() {
      self.client = null
      self.connectorCheckTimeoutId = null
    })
  },
  
  checkConnector: function() {
    var self = this

    this.connectorCheckTimeoutId && clearTimeout(this.connectorCheckTimeoutId)
    
    this.connectorCheckTimeoutId = setTimeout(function() {
      if(self.client && self.client._queue && (self.client._queue.length === 0))
        self.freeConnector()
    }, 500)
  },
  
  define: function(modelName, attributes, options) {
    options = options || {}
    
    if(this.options.defineOptions) options = Sequelize.Utils.merge(options, this.options.defineOptions)

    var model = this.modelManager.addModel(new ModelDefinition(modelName, attributes, options))
    
    return model
  },
  
  import: function(path) {
    var defineCall = require(path)
    return defineCall(this, DataTypes)
  },
  
  query: function(sql, callee, options) {
    options = options || {}
    
    if(this.options.queryOptions) options = Sequelize.Utils.merge(options, this.options.queryOptions)
    if(!this.client) this.initConnector()
    
    options.logging = this.options.hasOwnProperty('logging') ? this.options.logging : true
    
    var self  = this
      , query = new Query(this.client, callee, options).run(sql)
    
    query
      .on('success', function(){ self.checkConnector() })
      .on('failure', function(){ self.checkConnector() })
    
    return query
  },
  
  sync: function(options) {
    options = options || {}
    
    if(this.options.syncOptions) options = Sequelize.Utils.merge(options, this.options.syncOptions)
    
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
}


Sequelize.Utils._.map(DataTypes, function(sql, accessor) { Sequelize[accessor] = sql})
Sequelize.Utils._.map(instanceMethods, function(fct, name) { Sequelize.prototype[name] = fct})
