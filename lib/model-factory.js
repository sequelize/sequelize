var Utils = require("./utils")
  , Model = require("./model")
  , DataTypes = require("./data-types")

module.exports = (function() {
  var ModelFactory = function(name, attributes, options) {
    var self = this

    this.options = options || {}
    this.options.timestamps = this.options.hasOwnProperty('timestamps') ? this.options.timestamps : true
    this.name = name
    this.tableName = this.options.freezeTableName ? name : Utils.pluralize(name)
    this.attributes = Utils.simplifyAttributes(attributes)
    this.rawAttributes = attributes
    this.modelManager = null // defined by model-manager during addModel
    this.associations = {}

    // extract validation
    this.validate = this.options.validate || {}

    addDefaultAttributes.call(this)
    addOptionalClassMethods.call(this)
    findAutoIncrementField.call(this)
  }

  ModelFactory.prototype.__defineGetter__('QueryGenerator', function() {
    return this.modelManager.sequelize.connectorManager.getQueryGenerator()
  })

  ModelFactory.prototype.sync = function(options) {
    options = Utils.merge(options || {}, this.options)

    var self = this
    var eventEmitter = new Utils.CustomEventEmitter(function() {
      var doQuery = function() {
       query.call(self, self.QueryGenerator.createTableQuery(self.tableName, self.attributes, options))
        .on('success', function() { eventEmitter.emit('success', self) })
        .on('failure', function(err) { eventEmitter.emit('failure', err) })
      }

      if(options.force) {
        self.drop()
          .on('success', function() { doQuery() })
          .on('failure', function(err) { eventEmitter.emit('failure', err) })
      } else {
        doQuery()
      }
    })

    return eventEmitter.run()
  }

  ModelFactory.prototype.drop = function() {
    return query.call(this, this.QueryGenerator.dropTableQuery(this.tableName, this.id))
  }

  ModelFactory.prototype.all = function() {
    return query.call(this, this.QueryGenerator.selectQuery(this.tableName))
  }

  ModelFactory.prototype.count = function(options) {
    var self = this

    var emitter = new Utils.CustomEventEmitter(function() {
      query.call(self, self.QueryGenerator.countQuery(self.tableName, options), self, {plain: true}).on('success', function(obj) {
        emitter.emit('success', obj['count(*)'])
      })
    })
    return emitter.run()
  }

  ModelFactory.prototype.max = function(field, options) {
    var self = this

    var emitter = new Utils.CustomEventEmitter(function() {
      query.call(self, self.QueryGenerator.maxQuery(self.tableName, field,options), self, {plain: true}).on('success', function(obj) {
        emitter.emit('success', obj['max'])
      })
    })
    return emitter.run()
  }
  ModelFactory.prototype.min = function(field, options) {
    var self = this

    var emitter = new Utils.CustomEventEmitter(function() {
      query.call(self, self.QueryGenerator.minQuery(self.tableName, field,options), self, {plain: true}).on('success', function(obj) {
        emitter.emit('success', obj['min'])
      })
    })
    return emitter.run()
  }
  ModelFactory.prototype.findAll = function(options) {
    return query.call(this, this.QueryGenerator.selectQuery(this.tableName, options))
  }

  ModelFactory.prototype.find = function(options) {
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
      var NullEmitter = require("./emitters/null-emitter")
      return new NullEmitter()
    }

    options.limit = 1

    var sql = this.QueryGenerator.selectQuery(this.tableName, options)
    return query.call(this, sql, this, {plain: true})
  }

  ModelFactory.prototype.build = function(values, options) {
    var instance = new Model(values, Utils._.extend(this.options, this.attributes, { hasPrimaryKeys: this.hasPrimaryKeys }))
      , self     = this

    options = options || {}
    instance.__definition = this

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

  ModelFactory.prototype.__defineGetter__('primaryKeyCount', function() {
    return Utils._.keys(this.primaryKeys).length
  })

  ModelFactory.prototype.__defineGetter__('hasPrimaryKeys', function() {
    return this.primaryKeyCount > 0
  })

  // private

  var query = function() {
    var args = Utils._.map(arguments, function(arg, _) { return arg })
      , s    = this.modelManager.sequelize

    // add this as the second argument
    if(arguments.length == 1) args.push(this)
    return s.query.apply(s, args)
  }

  var addOptionalClassMethods = function() {
    var self = this
    Utils._.each(this.options.classMethods || {}, function(fct, name) { self[name] = fct })
  }

  var addDefaultAttributes = function() {
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

  var findAutoIncrementField = function() {
    var self = this

    this.autoIncrementField = null
    Utils._.map(this.attributes, function(definition, name) {
      if (definition && (definition.indexOf('auto_increment') > -1)) {
        if (self.autoIncrementField)
          throw new Error('Invalid model definition. Only one autoincrement field allowed.')
        else
          self.autoIncrementField = name
      }
    })
  }

  Utils._.extend(ModelFactory.prototype, require("./associations/mixin"))

  return ModelFactory
})()
