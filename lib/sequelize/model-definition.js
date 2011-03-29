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

  // additional attributes
  this.attributes.id = 'INT NOT NULL auto_increment PRIMARY KEY'
}
Utils.addEventEmitter(ModelDefinition)

ModelDefinition.prototype.sync = function(options) {
  options = options || {}
  
  var self = this
  var doQuery = function() {
    self.modelManager.sequelize
      .query(QueryGenerator.createTableQuery(self.tableName, self.attributes), self)
      .on('success', function() { self.emit('success', self) })
      .on('failure', function() { self.emit('failure', self) })
  }
  
  if(options.force) this.drop.on('success', function() { doQuery() })
  else doQuery()
  
  return this
}

ModelDefinition.prototype.__defineGetter__('drop', function() {
  var query = QueryGenerator.dropTableQuery(this.tableName, this.id)
  return this.modelManager.sequelize.query(query, this)
})

ModelDefinition.prototype.build = function(values) {
  var instance = new Model(values)
    , self     = this
 
  instance.definition = this
  
  return instance
}

ModelDefinition.prototype.create = function(values) {
  return this.build(values).save
}