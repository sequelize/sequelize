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

ModelDefinition.prototype.sync = function() {
  console.log(QueryGenerator.createTableQuery(this.tableName, this.attributes))
}

ModelDefinition.prototype.drop = function() {
  console.log(QueryGenerator.dropTableQuery(this.tableName))
}

ModelDefinition.prototype.create = function(values) {
  var instance = new Model(values)
  return instance
}