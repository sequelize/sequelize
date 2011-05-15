var Utils          = require("./utils")
  , Mixin          = require("./associations/mixin")
  , QueryGenerator = require("./query-generator")
  
var Model = module.exports = function(values, options) {
  var self = this
  
  this.definition = null // will be set in Model.build
  this.attributes = []
  this.options = options || {}
  
  // add all passed values to the model and store the attribute names in this.attributes
  Utils._.map(values, function(value, key) { self.addAttribute(key, value) })

  // set id to null if not passed as value
  // a newly created model has no id
  var defaults = this.options.hasPrimaryKeys ? {} : { id: null }

  if(this.options.timestamps) {
    defaults[this.options.underscored ? 'created_at' : 'createdAt'] = new Date()
    defaults[this.options.underscored ? 'updated_at' : 'updatedAt'] = new Date()

    if(this.options.paranoid)
      defaults[this.options.underscored ? 'deleted_at' : 'deletedAt'] = null
  }

  Utils._.map(defaults, function(value, attr) {
    if(!self.hasOwnProperty(attr))
      self.addAttribute(attr, value)
  })
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
  var attr = this.options.underscored ? 'updated_at' : 'updatedAt'
  
  if(this.hasOwnProperty(attr))
    this[attr] = new Date()
  
  if(this.isNewRecord) {
    var self = this
    var eventEmitter = new Utils.CustomEventEmitter(function() {
      self.query(QueryGenerator.insertQuery(self.definition.tableName, self.values))
      .on('success', function(obj) {
        obj.isNewRecord = false
        eventEmitter.emit('success', obj)
      })
      .on('failure', function(err) { eventEmitter.emit('failure', err) })
    })
    return eventEmitter.run()
  } else {
    var identifier = this.options.hasPrimaryKeys ? this.primaryKeyValues : this.id
    return this.query(QueryGenerator.updateQuery(this.definition.tableName, this.values, identifier))
  }
}

Model.prototype.updateAttributes = function(updates) {
  var self = this

  var readOnlyAttributes = Utils._.keys(this.definition.primaryKeys)
  readOnlyAttributes.push('id')
  readOnlyAttributes.push('createdAt')
  readOnlyAttributes.push('updatedAt')
  readOnlyAttributes.push('deletedAt')

  Utils._.each(updates, function(value, attr) {
    var updateAllowed = (
      (readOnlyAttributes.indexOf(attr) == -1) &&
      (readOnlyAttributes.indexOf(Utils._.underscored(attr)) == -1) &&
      (self.attributes.indexOf(attr) > -1)
    )
    updateAllowed && (self[attr] = value)
  })
  return this.save()
}

Model.prototype.destroy = function() {
  if(this.options.timestamps && this.options.paranoid) {
    this[this.options.underscored ? 'deleted_at' : 'deletedAt'] = new Date()
    return this.save()
  } else {
    var identifier = this.options.hasPrimaryKeys ? this.primaryKeyValues : this.id
    return this.query(QueryGenerator.deleteQuery(this.definition.tableName, identifier))
  }
}

Model.prototype.__defineGetter__("identifiers", function() {
  var primaryKeys = Utils._.keys(this.definition.primaryKeys)
    , result      = {}
    , self        = this
  
  if(!this.definition.hasPrimaryKeys)
    primaryKeys = ['id']
  
  primaryKeys.forEach(function(identifier) {
    result[identifier] = self[identifier]
  })
  
  return result
})

Model.prototype.__defineGetter__('isDeleted', function() {
  var result = this.options.timestamps && this.options.paranoid
  result = result && this[this.options.underscored ? 'deleted_at' : 'deletedAt'] != null
  
  return result
})

Model.prototype.__defineGetter__('values', function() {
  var result = {}
    , self   = this
    
  this.attributes.forEach(function(attr) {
    result[attr] = self[attr]
  })
  
  return result
})

Model.prototype.__defineGetter__('primaryKeyValues', function() {
  var result = {}
    , self   = this
    
  Utils._.each(this.definition.primaryKeys, function(_, attr) {
    result[attr] = self[attr]
  })
  
  return result
})

Model.prototype.equals = function(other) {
  var result = true
    , self   = this

  Utils._.each(this.values, function(value, key) {
    result = result && (value == other[key])
  })
  
  return result
}

Model.prototype.equalsOneOf = function(others) {
  var result = false
    , self   = this
    
  others.forEach(function(other) { result = result || self.equals(other) })
  
  return result
}

/* Add the instance methods to Model */
Utils._.map(Mixin.instanceMethods, function(fct, name) { Model.prototype[name] = fct})