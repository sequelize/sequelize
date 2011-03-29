var Utils = require("./utils")
  , Model = require("./model")
  , QueryGenerator = require("./query-generator")

var ModelDefinition = module.exports = function(name, attributes, options) {
  var self = this

  this.options = options || {}
  this.name = name
  this.tableName = name
  this.attributes = attributes
  this.modelManager = null // defined by model-manager during addModel
}

ModelDefinition.prototype.sync = function(options) {
  options = options || {}
  
  var self = this
  var doQuery = function() {
    var query = QueryGenerator.createTableQuery(self.tableName, self.attributes)
    return self.modelManager.sequelize.query(query)
  }
  
  if(options.force)
    this.drop().on('end', function() { return doQuery() })
  else
    return doQuery()
}

ModelDefinition.prototype.drop = function() {
  var query = QueryGenerator.dropTableQuery(this.tableName)
  return this.modelManager.sequelize.query(query)
}

ModelDefinition.prototype.create = function(values) {
  var instance = new Model(values)
  return instance
}