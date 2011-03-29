var Utils          = require("./utils")
  , Mixin          = require("./association-mixin")
  , QueryGenerator = require("./query-generator")
  
var Model = module.exports = function(values) {
  var self = this
  
  this.definition = null // will be set on Model.build or Model.create
  this.attributes = []
  this.addAttribute('id', null) // a newly created model has no id
  
  Utils._.map(values, function(value, key) { self.addAttribute(key, value) })
}
Utils.addEventEmitter(Model)
Utils._.map(Mixin.classMethods, function(fct, name) { Model[name] = fct })

Model.Events = {
  insert: 'InsertQuery',
  update: 'UpdateQuery',
  destroy: 'DestroyQuery'
}

var instanceMethods = {
  save: function() {
    if(this.isNewRecord) {
      var query = QueryGenerator.insertQuery(this.definition.tableName, this.values)
      return this.definition.modelManager.sequelize.query(query)
    } else {
      var query = QueryGenerate.updateQuery(this.definition.tableName, this.values, this.id)
      return this.definition.modelManager.sequelize.query(query)
    }
  },
  destroy: function() {
    var query = QueryGenerate.deleteQuery(this.definition.tableName, this.id)
    return this.definition.modelManager.sequelize.query(query)
  },
  addAttribute: function(attribute, value) {
    this[attribute] = value
    this.attributes.push(attribute)
  }
}

Model.prototype.__defineGetter__('isNewRecord', function() {
  return this.id == null
})
Model.prototype.__defineGetter__('values', function() {
  var result = {}
    , self   = this
    
  this.attributes.forEach(function(attr) {
    result[attr] = self[attr]
  })
  
  return result
})

/* Add the instance methods to Model */
Utils._.map(instanceMethods, function(fct, name) { Model.prototype[name] = fct})
Utils._.map(Mixin.instanceMethods, function(fct, name) { Model.prototype[name] = fct})