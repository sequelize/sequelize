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
}
Sequelize.Utils = Utils

var instanceMethods = {
  define: function(modelName, attributes, options) {
    options = options || {}
    
    var model = this.modelManager.addModel(new ModelDefinition(modelName, attributes, options))
    
    return model
  },
  
  import: function(path) {
    var defineCall = require(path)
    return defineCall(this, DataTypes)
  },
  
  query: function(sql, callee, options) {
    options = options || {}
    options.logging = this.options.hasOwnProperty('logging') ? this.options.logging : true
    return new Query(this.config, callee, options).run(sql)
  }
}


Sequelize.Utils._.map(DataTypes, function(sql, accessor) { Sequelize[accessor] = sql})
Sequelize.Utils._.map(instanceMethods, function(fct, name) { Sequelize.prototype[name] = fct})