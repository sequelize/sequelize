var Utils          = require("./utils")
  , Mixin          = require("./association-mixin")
  , QueryGenerator = require("./query-generator")
  
var Model = module.exports = function(values, options) {
  var self = this
  
  this.definition = null // will be set on Model.build or Model.create
  this.attributes = []
  this.options = options || {}
  
  // add all passed values to the model and store the attribute names in this.attributes
  Utils._.map(values, function(value, key) { self.addAttribute(key, value) })

  // set id to null if not passed as value
  // a newly created model has no id
  if(!this.hasOwnProperty('id'))
    this.addAttribute('id', null) 
}
Utils.addEventEmitter(Model)
Utils._.map(Mixin.classMethods, function(fct, name) { Model[name] = fct })

Model.Events = {
  insert: 'InsertQuery',
  update: 'UpdateQuery',
  destroy: 'DestroyQuery'
}

Model.prototype.addAttribute = function(attribute, value) {
  this[attribute] = value
  this.attributes.push(attribute)
}

Model.prototype.query = function() {
  var args = Utils._.map(arguments, function(arg, _) { return arg })
    , s    = this.definition.modelManager.sequelize
      
  args.push(this)
  return s.query.apply(s, args)
}

Model.prototype.save = function() {
  if(this.isNewRecord)
    return this.query(QueryGenerator.insertQuery(this.definition.tableName, this.values))
  else
    return this.query(QueryGenerator.updateQuery(this.definition.tableName, this.values, this.id))
}

Model.prototype.destroy = function() {
  return this.query(QueryGenerator.deleteQuery(this.definition.tableName, this.id))
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
Utils._.map(Mixin.instanceMethods, function(fct, name) { Model.prototype[name] = fct})