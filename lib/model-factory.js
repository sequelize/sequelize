var Utils     = require("./utils")
  , Model     = require("./model")
  , DataTypes = require("./data-types")

module.exports = (function() {
  var ModelFactory = function(name, attributes, options) {
    var self = this

    this.options = Utils._.extend({
      timestamps: true,
      instanceMethods: {},
      classMethods: {},
      validate: {},
      freezeTableName: false,
      underscored: false,
      paranoid: false
    }, options || {})

    this.name = name
    this.tableName = this.options.freezeTableName ? name : Utils.pluralize(name)
    this.rawAttributes = attributes
    this.modelFactoryManager = null // defined in init function
    this.associations = {}

    // extract validation
    this.validate = this.options.validate || {}
  }

  Object.defineProperty(ModelFactory.prototype, 'attributes', {
    get: function() {
      return this.QueryGenerator.attributesToSQL(this.rawAttributes)
    }
  })

  Object.defineProperty(ModelFactory.prototype, 'QueryInterface', {
    get: function() { return this.modelFactoryManager.sequelize.getQueryInterface() }
  })

  Object.defineProperty(ModelFactory.prototype, 'QueryGenerator', {
    get: function() { return this.QueryInterface.QueryGenerator }
  })

  Object.defineProperty(ModelFactory.prototype, 'primaryKeyCount', {
    get: function() { return Utils._.keys(this.primaryKeys).length }
  })

  Object.defineProperty(ModelFactory.prototype, 'hasPrimaryKeys', {
    get: function() { return this.primaryKeyCount > 0 }
  })

  ModelFactory.prototype.init = function(modelFactoryManager) {
    this.modelFactoryManager = modelFactoryManager

    addDefaultAttributes.call(this)
    addOptionalClassMethods.call(this)
    findAutoIncrementField.call(this)

    return this
  }

  ModelFactory.prototype.sync = function(options) {
    options = Utils.merge(options || {}, this.options)

    var self = this
    return new Utils.CustomEventEmitter(function(emitter) {
      var doQuery = function() {
        self.QueryInterface
          .createTable(self.tableName, self.attributes, options)
          .success(function() { emitter.emit('success', self) })
          .error(function(err) { emitter.emit('failure', err) })
      }

      if(options.force)
        self.drop().success(doQuery).error(function(err) { emitter.emit('failure', err) })
      else
        doQuery()

    }).run()
  }

  ModelFactory.prototype.drop = function() {
    return this.QueryInterface.dropTable(this.tableName)
  }

  ModelFactory.prototype.all = function() {
    return this.findAll()
  }

  ModelFactory.prototype.findAll = function(options) {
    return this.QueryInterface.select(this, this.tableName, options)
  }

  //right now, the caller (has-many-double-linked) is in charge of the where clause
  ModelFactory.prototype.findAllJoin = function(joinTableName, options) {
    optcpy = Utils._.clone(options)
    optcpy.attributes = optcpy.attributes || [Utils.addTicks(this.tableName)+".*"]

    return this.QueryInterface.select(this, [this.tableName, joinTableName], optcpy)
  }

  ModelFactory.prototype.find = function(options) {
    if([null, undefined].indexOf(options) > -1) {
      var NullEmitter = require("./emitters/null-emitter")
      return new NullEmitter()
    }

    // options is not a hash but an id
    if(typeof options == 'number')
      options = { where: options }
    else if (Utils.argsArePrimaryKeys(arguments, this.primaryKeys)) {
        var where = {}
          , self  = this

        Utils._.each(arguments, function(arg, i) {
          var key = Utils._.keys(self.primaryKeys)[i]
          where[key] = arg
        })

        options = { where: where }
    }

    options.limit = 1

    return this.QueryInterface.select(this, this.tableName, options, {plain: true})
  }

  ModelFactory.prototype.count = function(options) {
    options = Utils._.extend({ attributes: [] }, options || {})
    options.attributes.push(['count(*)', 'count'])

    return this.QueryInterface.rawSelect(this.tableName, options, 'count')
  }

  ModelFactory.prototype.max = function(field, options) {
    options = Utils._.extend({ attributes: [] }, options || {})
    options.attributes.push(['max(' + field + ')', 'max'])

    return this.QueryInterface.rawSelect(this.tableName, options, 'max')
  }
  ModelFactory.prototype.min = function(field, options) {
    options = Utils._.extend({ attributes: [] }, options || {})
    options.attributes.push(['min(' + field + ')', 'min'])

    return this.QueryInterface.rawSelect(this.tableName, options, 'min')
  }

  ModelFactory.prototype.build = function(values, options) {
    var instance = new Model(values, Utils._.extend(this.options, this.attributes, { hasPrimaryKeys: this.hasPrimaryKeys }))
      , self     = this

    options = options || {}
    instance.__factory = this

    Utils._.map(this.attributes, function(definition, name) {
      if(typeof instance[name] == 'undefined') {
        var value = null

        if(self.rawAttributes.hasOwnProperty(name) && self.rawAttributes[name].hasOwnProperty('defaultValue')) {
            value = self.rawAttributes[name].defaultValue
        }

        instance[name] = value
        instance.addAttribute(name, value)
      }
      // add validation
      if (self.rawAttributes.hasOwnProperty(name) && self.rawAttributes[name].hasOwnProperty('validate')) {
        instance.setValidators(name, self.rawAttributes[name].validate)
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

  ModelFactory.prototype.create = function(values) {
    return this.build(values).save()
  }

  ModelFactory.prototype.__defineGetter__('primaryKeys', function() {
    var result = {}
    Utils._.each(this.attributes, function(dataTypeString, attributeName) {
      if((attributeName != 'id') && (dataTypeString.indexOf('PRIMARY KEY') > -1))
        result[attributeName] = dataTypeString
    })

    return result
  })

  // private

  var query = function() {
    var args = Utils._.map(arguments, function(arg, _) { return arg })
      , s    = this.modelFactoryManager.sequelize

    // add this as the second argument
    if(arguments.length == 1) args.push(this)
    return s.query.apply(s, args)
  }

  var addOptionalClassMethods = function() {
    var self = this
    Utils._.each(this.options.classMethods || {}, function(fct, name) { self[name] = fct })
  }

  var addDefaultAttributes = function() {
    var self              = this
      , defaultAttributes = {
        id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }
      }

    if(this.hasPrimaryKeys) defaultAttributes = {}

    if(this.options.timestamps) {
      defaultAttributes[Utils._.underscoredIf('createdAt', this.options.underscored)] = {type: DataTypes.DATE, allowNull: false}
      defaultAttributes[Utils._.underscoredIf('updatedAt', this.options.underscored)] = {type: DataTypes.DATE, allowNull: false}

      if(this.options.paranoid)
        defaultAttributes[Utils._.underscoredIf('deletedAt', this.options.underscored)] = {type: DataTypes.DATE}
    }

    Utils._.each(defaultAttributes, function(value, attr) {
      self.rawAttributes[attr] = value
    })
  }

  var findAutoIncrementField = function() {
    var self   = this
      , fields = this.QueryGenerator.findAutoIncrementField(this)

    this.autoIncrementField = null

    fields.forEach(function(field) {
      if(self.autoIncrementField)
        throw new Error('Invalid model definition. Only one autoincrement field allowed.')
      else
        self.autoIncrementField = field
    })
  }

  Utils._.extend(ModelFactory.prototype, require("./associations/mixin"))

  return ModelFactory
})()
