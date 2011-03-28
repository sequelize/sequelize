var Utils = require("./utils")
  , Model = require("./model")

var Sequelize = module.exports = function(database, username, password, options) {
  options = options || {}

  var ModelManager = require("./model-manager")
  this.modelManager = new ModelManager(this)
  this.options = Utils._.reject(options, function(value, key) { return ["host", "port", "disableTableNameModification"].indexOf(key) > -1 })
  this.config = {
    database: database,
    username: username,
    password: (( (["", null, false].indexOf(password) > -1) || (typeof password == 'undefined')) ? null : password),
    host    : options.host || 'localhost',
    port    : options.port || 3306
  }
}

var instanceMethods = {
  define: function(modelName, attributes, options) {
    options = options || {}
    
    var model = this.modelManager.addModel(new Model(modelName, attributes, options))
    
    return model
  },
  
  query: function(sql, callback) {
    var client = new (require("mysql").client)({
      user: this.username,
      password: this.password,
      host: this.config.host,
      port: this.config.port,
      database: this.config.database
    })

    client.connect()
    client.query(sql)
    client.end()
  }
}


Utils._.map(require('./data-types'), function(sql, accessor) { Sequelize[accessor] = sql})
Utils._.map(instanceMethods, function(fct, name) { Sequelize.prototype[name] = fct})