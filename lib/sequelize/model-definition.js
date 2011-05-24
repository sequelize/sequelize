var Utils = require("./utils")
  , Model = require("./model")
  , QueryGenerator = require("./query-generator")
  , DataTypes = require("./data-types")

var ModelDefinition = module.exports = function(name, attributes, options) {
  var self = this

  this.options = options || {}
  this.options.timestamps = this.options.hasOwnProperty('timestamps') ? this.options.timestamps : true
  this.name = name
  this.tableName = this.options.freezeTableName ? name : Utils.pluralize(name)
  this.attributes = Utils.simplifyAttributes(attributes)
  this.rawAttributes = attributes
  this.modelManager = null // defined by model-manager during addModel
  this.associations = {}

  this.addDefaultAttributes()
  this.addOptionalClassMethods()
  this.findAutoIncrementField()
}
Utils.addEventEmitter(ModelDefinition)

ModelDefinition.prototype.addOptionalClassMethods = function() {
  var self = this
  Utils._.each(this.options.classMethods || {}, function(fct, name) { self[name] = fct })
}

ModelDefinition.prototype.addDefaultAttributes = function() {
  var defaultAttributes = {id: {type: DataTypes.INTEGER, allowNull: false, primaryKey: true, autoIncrement: true}}
    , self = this

  if(this.hasPrimaryKeys) defaultAttributes = {}
  
  if(this.options.timestamps) {
    defaultAttributes[Utils._.underscoredIf('createdAt', this.options.underscored)] = {type: DataTypes.DATE, allowNull: false}
    defaultAttributes[Utils._.underscoredIf('updatedAt', this.options.underscored)] = {type: DataTypes.DATE, allowNull: false}

    if(this.options.paranoid)
      defaultAttributes[Utils._.underscoredIf('deletedAt', this.options.underscored)] = {type: DataTypes.DATE}
  }

  defaultAttributes = Utils.simplifyAttributes(defaultAttributes)
  Utils._.map(defaultAttributes, function(value, attr) { self.attributes[attr] = value })
}

ModelDefinition.prototype.findAutoIncrementField = function() {
  var self = this;
  this.autoIncrementField = null;
  Utils._.map(this.attributes, function(definition, name) {
    if (definition && definition.indexOf('auto_increment') >= 0) {
      if (self.autoIncrementField) {
        throw new Error('Invalid model definition. Only one autoincrement field allowed.')
      }
      self.autoIncrementField = name;
    }
  })
}

ModelDefinition.prototype.query = function() {
  var args = Utils._.map(arguments, function(arg, _) { return arg })
    , s    = this.modelManager.sequelize

  // add this as the second argument
  if(arguments.length == 1) args.push(this)
  return s.query.apply(s, args)
}

ModelDefinition.prototype.sync = function(options) {
  options = options || {}
  
  var self = this
  var doQuery = function() {
    self.query(QueryGenerator.createTableQuery(self.tableName, self.attributes))
      .on('success', function() { self.emit('success', self) })
      .on('failure', function(err) { self.emit('failure', err) })
  }
  
  if(options.force) {
    this.drop()
      .on('success', function() { doQuery() })
      .on('failure', function(err) { self.emit('failure', err) })
  } else {
    doQuery()
  }
  
  return this
}

ModelDefinition.prototype.drop = function() {
  return this.query(QueryGenerator.dropTableQuery(this.tableName, this.id))
}

ModelDefinition.prototype.__defineGetter__('all', function() {
  return this.query(QueryGenerator.selectQuery(this.tableName))
})

ModelDefinition.prototype.count = function(options) {
  var self = this
  
  var emitter = new Utils.CustomEventEmitter(function() {
    self.query(QueryGenerator.countQuery(self.tableName, options), self, {plain: true}).on('success', function(obj) {
      emitter.emit('success', obj['count(*)'])
    })
  })
  return emitter.run()
}

ModelDefinition.prototype.findAll = function(options) {
  return this.query(QueryGenerator.selectQuery(this.tableName, options))
}

ModelDefinition.prototype.find = function(options) {
  // options is not a hash but an id
  if(typeof options == 'number')
    options = {where: options}
  else if (Utils.argsArePrimaryKeys(arguments, this.primaryKeys)) {
      var where = {}
        , self  = this
        
      Utils._.each(arguments, function(arg, i) {
        var key = Utils._.keys(self.primaryKeys)[i]
        where[key] = arg
      })

      options = {where: where}
  } else if((options == null) || (options == undefined)) {
    var NullEmitter = require("./null-emitter")
    return new NullEmitter()
  }
  
  options.limit = 1
  
  var query = QueryGenerator.selectQuery(this.tableName, options)
  return this.query(query, this, {plain: true})
}

ModelDefinition.prototype.build = function(values, options) {
  var instance = new Model(values, Utils._.extend(this.options, {hasPrimaryKeys: this.hasPrimaryKeys}))
    , self     = this
  
  options = options || {}
  instance.definition = this

  Utils._.map(this.attributes, function(definition, name) {
    if(typeof instance[name] == 'undefined') {
      var value = null

      if(self.rawAttributes.hasOwnProperty(name) && self.rawAttributes[name].hasOwnProperty('defaultValue'))
        value = self.rawAttributes[name].defaultValue

      instance[name] = value
      instance.addAttribute(name, value)
    }
  })
  Utils._.each(this.options.instanceMethods || {}, function(fct, name) { instance[name] = fct })
  Utils._.each(this.associations, function(association, associationName) {
    association.injectGetter(instance)
    association.injectSetter(instance)
  })
  
  instance.isNewRecord = options.hasOwnProperty('isNewRecord') ? options.isNewRecord : true
  
  return instance
}

ModelDefinition.prototype.create = function(values) {
  return this.build(values).save()
}

ModelDefinition.prototype.__defineGetter__('primaryKeys', function() {
  var result = {}

  Utils._.each(this.attributes, function(dataTypeString, attributeName) {
    if((attributeName != 'id') && (dataTypeString.indexOf('PRIMARY KEY') > -1))
      result[attributeName] = dataTypeString
  })

  return result
})

ModelDefinition.prototype.__defineGetter__('primaryKeyCount', function() {
  return Utils._.keys(this.primaryKeys).length
})

ModelDefinition.prototype.__defineGetter__('hasPrimaryKeys', function() {
  return this.primaryKeyCount > 0
})

Utils._.map(require("./associations/mixin").classMethods, function(fct, name) { ModelDefinition.prototype[name] = fct })