var Utils = require("./utils")
  , Model = require("./model")
  , QueryGenerator = require("./query-generator")
  , DataTypes = require("./data-types")

var ModelDefinition = module.exports = function(name, attributes, options) {
  var self = this

  this.options = options || {}
  this.options.timestamps = this.options.hasOwnProperty('timestamps') ? this.options.timestamps : true
  this.name = name
  this.tableName = name
  this.attributes = Utils.simplifyAttributes(attributes)
  this.modelManager = null // defined by model-manager during addModel

  this.addDefaultAttributes()
}
Utils.addEventEmitter(ModelDefinition)

ModelDefinition.prototype.addDefaultAttributes = function() {
  var defaultAttributes = {id: {type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true}}
    , self = this

  if(Utils._.keys(this.primaryKeys).length > 0)
    defaultAttributes = {}
  
  if(this.options.timestamps) {
    defaultAttributes[this.options.camelcase ? 'created_at' : 'createdAt'] = {type: DataTypes.DATE, allowNull: false}
    defaultAttributes[this.options.camelcase ? 'updated_at' : 'updatedAt'] = {type: DataTypes.DATE, allowNull: false}

    if(this.options.paranoid)
      defaultAttributes[this.options.camelcase ? 'deleted_at' : 'deletedAt'] = {type: DataTypes.DATE}
  }

  defaultAttributes = Utils.simplifyAttributes(defaultAttributes)
  Utils._.map(defaultAttributes, function(value, attr) { self.attributes[attr] = value })
}


ModelDefinition.prototype.query = function() {
  var args = Utils._.map(arguments, function(arg, _) { return arg })
    , s    = this.modelManager.sequelize
  
  if(arguments.length == 1) args.push(this)
  return s.query.apply(s, args)
}

ModelDefinition.prototype.sync = function(options) {
  options = options || {}
  
  var self = this
  var doQuery = function() {
    self.query(QueryGenerator.createTableQuery(self.tableName, self.attributes))
      .on('success', function() { self.emit('success', self) })
      .on('failure', function() { self.emit('failure', self) })
  }
  
  if(options.force) this.drop().on('success', function() { doQuery() })
  else doQuery()
  
  return this
}

ModelDefinition.prototype.drop = function() {
  return this.query(QueryGenerator.dropTableQuery(this.tableName, this.id))
}

ModelDefinition.prototype.__defineGetter__('all', function() {
  return this.query(QueryGenerator.selectQuery(this.tableName))
})

ModelDefinition.prototype.findAll = function(options) {
  return this.query(QueryGenerator.selectQuery(this.tableName, options))
}

ModelDefinition.prototype.find = function(options) {
  // options is not a hash but an id
  if(typeof options == 'number')
    options = {where: options}
  else {
    // if(arguments.length == this.primaryKeys.length)
  }
  
  options.limit = 1
  
  var query = QueryGenerator.selectQuery(this.tableName, options)
  return this.query(query, this, {plain: true})
}

ModelDefinition.prototype.build = function(values) {
  var instance = new Model(values, this.options)
    , self     = this
 
  instance.definition = this
  
  return instance
}

ModelDefinition.prototype.create = function(values) {
  return this.build(values).save()
}

ModelDefinition.prototype.__defineGetter__('primaryKeys', function() {
  var result = {}
  
  Utils._.each(this.attributes, function(dataTypeString, attributeName) {
    if(dataTypeString.indexOf('PRIMARY KEY') > -1)
      result[attributeName] = dataTypeString
  })
  
  return result
})

Utils._.map(require("./association-mixin").classMethods, function(fct, name) { ModelDefinition.prototype[name] = fct })