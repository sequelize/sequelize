var Utils       = require("./utils")
  , DAO         = require("./dao")
  , DataTypes   = require("./data-types")
  , Util        = require('util')
  , sql         = require('sql')
  , SqlString   = require('./sql-string')
  , Transaction = require('./transaction')
  , QueryTypes  = require('./query-types')

module.exports = (function() {
  var DAOFactory = function(name, attributes, options) {
    this.options = Utils._.extend({
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      deletedAt: 'deletedAt',
      instanceMethods: {},
      classMethods: {},
      validate: {},
      freezeTableName: false,
      freezeAssociations: false,
      underscored: false,
      syncOnAssociation: true,
      paranoid: false,
      whereCollection: null,
      schema: null,
      schemaDelimiter: '',
      language: 'en',
      defaultScope: null,
      scopes: null,
      hooks: {
        beforeCreate: [],
        afterCreate: []
      }
    }, options || {})

    // error check options
    Utils._.each(options.validate, function(validator, validatorType) {
      if (Utils._.contains(Utils._.keys(attributes), validatorType)) {
        throw new Error("A model validator function must not have the same name as a field. Model: " + name + ", field/validation name: " + validatorType)
      }

      if (!Utils._.isFunction(validator)) {
        throw new Error("Members of the validate option must be functions. Model: " + name + ", error with validate member " + validatorType)
      }
    })

    this.name = name

    if (!this.options.tableName) {
      this.tableName = this.options.freezeTableName ? name : Utils.pluralize(name, this.options.language)
    } else {
      this.tableName = this.options.tableName
    }

    attributes = replaceReferencesWithTableNames(attributes)
    this.options.hooks = this.replaceHookAliases(this.options.hooks)

    this.rawAttributes     = attributes
    this.daoFactoryManager = null // defined in init function
    this.associations      = {}
    this.scopeObj          = {}
  }

  Object.defineProperty(DAOFactory.prototype, 'attributes', {
    get: function() {
      return this.QueryGenerator.attributesToSQL(this.rawAttributes)
    }
  })

  Object.defineProperty(DAOFactory.prototype, 'sequelize', {
    get: function() { return this.daoFactoryManager.sequelize }
  })

  Object.defineProperty(DAOFactory.prototype, 'QueryInterface', {
    get: function() { return this.daoFactoryManager.sequelize.getQueryInterface() }
  })

  Object.defineProperty(DAOFactory.prototype, 'QueryGenerator', {
    get: function() { return this.QueryInterface.QueryGenerator }
  })

  // inject the node-sql methods to the dao factory in order to
  // receive the syntax sugar ...

 ;(function() {
    var instance = sql.define({ name: "dummy", columns: [] })

    for (var methodName in instance) {
     ;(function(methodName) {
        DAOFactory.prototype[methodName] = function() {
          var dataset = this.dataset()
            , result  = dataset[methodName].apply(dataset, arguments)
            , dialect = this.daoFactoryManager.sequelize.options.dialect
            , self    = this

          result.toSql = function() {
            var query = result.toQuery()
            return SqlString.format(query.text.replace(/(\$\d)/g, '?'), query.values, null, dialect) + ';'
          }

          result.exec = function(options) {
            options = Utils._.extend({
              transaction: null,
              type:        QueryTypes.SELECT
            }, options || {})

            return self.QueryInterface.queryAndEmit([result.toSql(), self, options], 'snafu')
          }

          return result
        }
      })(methodName)
    }
  })()

  DAOFactory.prototype.init = function(daoFactoryManager) {
    var self = this

    this.daoFactoryManager  = daoFactoryManager
    this.primaryKeys        = {}
    self.options.uniqueKeys = {}

    Utils._.each(this.rawAttributes, function(columnValues, columnName) {
      if (columnValues.hasOwnProperty('unique') && columnValues.unique !== true && columnValues.unique !== false) {
        var idxName = columnValues.unique
        if (typeof columnValues.unique === "object") {
          idxName = columnValues.unique.name
        }

        self.options.uniqueKeys[idxName] = self.options.uniqueKeys[idxName] || {fields: [], msg: null}
        self.options.uniqueKeys[idxName].fields.push(columnName)
        self.options.uniqueKeys[idxName].msg = self.options.uniqueKeys[idxName].msg || columnValues.unique.msg || null
      }
    })

    Utils._.each(this.attributes, function(dataTypeString, attributeName) {
      if (dataTypeString.indexOf('PRIMARY KEY') !== -1) {
        self.primaryKeys[attributeName] = dataTypeString
      }
    })

    this.primaryKeyAttributes = Object.keys(this.primaryKeys)
    this.primaryKeyCount = this.primaryKeyAttributes.length
    this.options.hasPrimaryKeys = this.hasPrimaryKeys = this.primaryKeyCount > 0

    if (typeof this.options.defaultScope === "object") {
      Utils.injectScope.call(this, this.options.defaultScope)
    }

    // DAO prototype
    // WTF ... ?
    this.DAO = function() {
      DAO.apply(this, arguments);
    }

    Util.inherits(this.DAO, DAO);

    this._timestampAttributes = {}
    if (this.options.timestamps) {
      if (this.options.createdAt) {
        this._timestampAttributes.createdAt = Utils._.underscoredIf(this.options.createdAt, this.options.underscored)
      }
      if (this.options.updatedAt) {
        this._timestampAttributes.updatedAt = Utils._.underscoredIf(this.options.updatedAt, this.options.underscored)
      }
      if (this.options.paranoid && this.options.deletedAt) {
        this._timestampAttributes.deletedAt = Utils._.underscoredIf(this.options.deletedAt, this.options.underscored)
      }

      this.DAO.prototype._readOnlyAttributes = Object.keys(this._timestampAttributes)
    }

    this.DAO.prototype._hasReadOnlyAttributes = this.DAO.prototype._readOnlyAttributes && this.DAO.prototype._readOnlyAttributes.length
    this.DAO.prototype._isReadOnlyAttribute = Utils._.memoize(function (key) {
      return self.DAO.prototype._hasReadOnlyAttributes && self.DAO.prototype._readOnlyAttributes.indexOf(key) !== -1
    })

    addDefaultAttributes.call(this)
    addOptionalClassMethods.call(this)
    findAutoIncrementField.call(this)

    this.DAO.prototype.rawAttributes = this.rawAttributes;

    this.DAO.prototype._hasPrimaryKeys = this.options.hasPrimaryKeys
    this.DAO.prototype._isPrimaryKey = Utils._.memoize(function (key) {
      return self.primaryKeyAttributes.indexOf(key) !== -1 && key !== 'id'
    })

    if (this.options.instanceMethods) {
      Utils._.each(this.options.instanceMethods, function(fct, name) {
        self.DAO.prototype[name] = fct
      })
    }

    this.refreshAttributes();

    this.DAO.prototype.booleanValues = []
    this.DAO.prototype.dateAttributes = []
    this.DAO.prototype.defaultValues = {}
    this.DAO.prototype.validators    = {}

    Utils._.each(this.rawAttributes, function (definition, name) {
      if (((definition === DataTypes.BOOLEAN) || (definition.type === DataTypes.BOOLEAN))) {
        self.DAO.prototype.booleanValues.push(name);
      }
      if (((definition === DataTypes.DATE) || (definition.type === DataTypes.DATE) || (definition.originalType === DataTypes.DATE))) {
        self.DAO.prototype.dateAttributes.push(name);
      }
      if (definition.hasOwnProperty('defaultValue')) {
        self.DAO.prototype.defaultValues[name] = Utils._.partial(
          Utils.toDefaultValue, definition.defaultValue)
      }

      if (definition.hasOwnProperty('validate')) {
        self.DAO.prototype.validators[name] = definition.validate;
      }
    })

    this.DAO.prototype._hasBooleanAttributes = !!this.DAO.prototype.booleanValues.length
    this.DAO.prototype._isBooleanAttribute = Utils._.memoize(function (key) {
      return self.DAO.prototype.booleanValues.indexOf(key) !== -1
    })

    this.DAO.prototype._hasDateAttributes = !!this.DAO.prototype.dateAttributes.length
    this.DAO.prototype._isDateAttribute = Utils._.memoize(function (key) {
      return self.DAO.prototype.dateAttributes.indexOf(key) !== -1
    })

    this.DAO.prototype.__factory        = this
    this.DAO.prototype.daoFactory       = this
    this.DAO.prototype.Model            = this
    this.DAO.prototype.hasDefaultValues = !Utils._.isEmpty(this.DAO.prototype.defaultValues)
    this.DAO.prototype.daoFactoryName   = this.name

    return this
  }

  DAOFactory.prototype.refreshAttributes = function() {
    var self = this
      , attributeManipulation = {};

    this.DAO.prototype._customGetters = {}
    this.DAO.prototype._customSetters = {}

    Utils._.each(['get', 'set'], function(type) {
      var opt   = type + 'terMethods'
        , funcs = Utils._.clone(Utils._.isObject(self.options[opt]) ? self.options[opt] : {})
        , _custom = type === 'get' ? self.DAO.prototype._customGetters : self.DAO.prototype._customSetters

      Utils._.each(funcs, function (method, attribute) {
        _custom[attribute] = method

        if (type === 'get') {
          funcs[attribute] = function() {
            return this.get(attribute)
          }
        }
        if (type === 'set') {
          funcs[attribute] = function(value) {
            return this.set(attribute, value)
          }
        }
      })

      Utils._.each(self.rawAttributes, function(options, attribute) {
        if (options.hasOwnProperty(type)) {
          _custom[attribute] = options[type]
        }

        if (type === 'get') {
          funcs[attribute] = function() {
            return this.get(attribute)
          }
        }
        if (type === 'set') {
          funcs[attribute] = function(value) {
            return this.set(attribute, value)
          }
        }
      })

      Utils._.each(funcs, function(fct, name) {
        if (!attributeManipulation[name]) {
          attributeManipulation[name] = {
            configurable: true
          }
        }
        attributeManipulation[name][type] = fct
      })
    })

    this.DAO.prototype._hasCustomGetters = Object.keys(this.DAO.prototype._customGetters).length
    this.DAO.prototype._hasCustomSetters = Object.keys(this.DAO.prototype._customSetters).length

    Object.defineProperties(this.DAO.prototype, attributeManipulation)
    this.DAO.prototype.attributes = Object.keys(this.DAO.prototype.rawAttributes)
    this.DAO.prototype._isAttribute = Utils._.memoize(function (key) {
      return self.DAO.prototype.attributes.indexOf(key) !== -1
    })
  }

  DAOFactory.prototype.sync = function(options) {
    options = Utils._.extend({}, this.options, options || {})

    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      var doQuery = function() {
        self
          .QueryInterface
          .createTable(self.getTableName(), self.attributes, options)
          .proxy(emitter, {events: ['error', 'sql']})
          .success(function() { emitter.emit('success', self) })
      }

      if (options.force) {
        self
          .drop(options)
          .proxy(emitter, {events: ['error', 'sql']})
          .success(doQuery)
      } else {
        doQuery()
      }
    }).run()
  }

  DAOFactory.prototype.drop = function(options) {
    // Only Postgres' QueryGenerator.dropTableQuery() will add schema manually
    var isPostgres = this.options.dialect === "postgres" || (!!this.daoFactoryManager && this.daoFactoryManager.sequelize.options.dialect === "postgres")
     , tableName = isPostgres ? this.tableName : this.getTableName()

    return this.QueryInterface.dropTable(tableName, options)
  }

  DAOFactory.prototype.dropSchema = function(schema) {
    return this.QueryInterface.dropSchema(schema)
  }

  DAOFactory.prototype.schema = function(schema, options) {
    this.options.schema = schema

    if (!!options) {
      if (typeof options === "string") {
        this.options.schemaDelimiter = options
      } else {
        if (!!options.schemaDelimiter) {
          this.options.schemaDelimiter = options.schemaDelimiter
        }
      }
    }

    return this
  }

  DAOFactory.prototype.getTableName = function() {
    return this.QueryGenerator.addSchema(this)
  }

  DAOFactory.prototype.scope = function(option) {
    var self = Object.create(this)
      , type
      , options
      , merge
      , i
      , scope
      , scopeName
      , scopeOptions
      , argLength = arguments.length
      , lastArg = arguments[argLength-1]

    // Set defaults
    scopeOptions = (typeof lastArg === "object" && !Array.isArray(lastArg) ? lastArg : {}) || {} // <-- for no arguments
    scopeOptions.silent = (scopeOptions !== null && scopeOptions.hasOwnProperty('silent') ? scopeOptions.silent : true)

    // Clear out any predefined scopes...
    self.scopeObj = {}

    // Possible formats for option:
    // String of arguments: 'hello', 'world', 'etc'
    // Array: ['hello', 'world', 'etc']
    // Object: {merge: 'hello'}, {method: ['scopeName' [, args1, args2..]]}, {merge: true, method: ...}

    if (argLength < 1 || !option) {
      return self
    }

    for (i = 0; i < argLength; i++) {
      options = Array.isArray(arguments[i]) ? arguments[i] : [arguments[i]]

      options.forEach(function(o){
        type = typeof o
        scope = null
        merge = false
        scopeName = null

        if (type === "object") {
          // Right now we only support a merge functionality for objects
          if (!!o.merge) {
            merge = true
            scopeName = o.merge[0]
            if (Array.isArray(o.merge) && !!self.options.scopes[scopeName]) {
              scope = self.options.scopes[scopeName].apply(self, o.merge.splice(1))
            }
            else if (typeof o.merge === "string") {
              scopeName = o.merge
              scope = self.options.scopes[scopeName]
            }
          }

          if (!!o.method) {
            if (Array.isArray(o.method) && !!self.options.scopes[o.method[0]]) {
              scopeName = o.method[0]
              scope = self.options.scopes[scopeName].apply(self, o.method.splice(1))
              merge = !!o.merge
            }
            else if (!!self.options.scopes[o.method]) {
              scopeName = o.method
              scope = self.options.scopes[scopeName].apply(self)
            }
          } else {
            scopeName = o
            scope = self.options.scopes[scopeName]
          }
        } else {
          scopeName = o
          scope = self.options.scopes[scopeName]
        }

        if (!!scope) {
          Utils.injectScope.call(self, scope, merge)
        }
        else if (scopeOptions.silent !== true && !!scopeName) {
          throw new Error("Invalid scope " + scopeName + " called.")
        }
      })
    }

    return self
  }

  // alias for findAll
  DAOFactory.prototype.all = function(options, queryOptions) {
    return this.findAll(options, queryOptions)
  }

  DAOFactory.prototype.findAll = function(options, queryOptions) {
    var hasJoin = false
      , tableNames  = { }

    tableNames[this.tableName] = true

    options = optClone(options)
    if (typeof options === 'object') {
      if (options.hasOwnProperty('include') && options.include) {
        hasJoin = true

        validateIncludedElements.call(this, options, tableNames)
      }

      // whereCollection is used for non-primary key updates
      this.options.whereCollection = options.where || null
    }

    options = paranoidClause.call(this, options)

    return this.QueryInterface.select(this, this.getTableName(), options, Utils._.defaults({
      type:    QueryTypes.SELECT,
      hasJoin: hasJoin,
      tableNames: Object.keys(tableNames)
    }, queryOptions, { transaction: (options || {}).transaction }))
  }

  //right now, the caller (has-many-double-linked) is in charge of the where clause
  DAOFactory.prototype.findAllJoin = function(joinTableName, options, queryOptions) {
    var optcpy = Utils._.clone(options)
    optcpy.attributes = optcpy.attributes || [this.QueryInterface.quoteIdentifier(this.tableName)+".*"]

    // whereCollection is used for non-primary key updates
    this.options.whereCollection = optcpy.where || null;

    return this.QueryInterface.select(this, [this.getTableName(), joinTableName], optcpy, Utils._.defaults({
      type: QueryTypes.SELECT
    }, queryOptions, { transaction: (options || {}).transaction }))
  }

 /**
  * Search for an instance.
  *
  * @param  {Object} options Options to describe the scope of the search.
  *   @param {Array} include A list of associations which shall get eagerly loaded. Supported is either { include: [ DaoFactory1, DaoFactory2, ...] } or { include: [ { daoFactory: DaoFactory1, as: 'Alias' } ] }.
  * @param  {Object} set the query options, e.g. raw, specifying that you want raw data instead of built DAOs
  * @return {Object}         A promise which fires `success`, `error`, `complete` and `sql`.
  */
  DAOFactory.prototype.find = function(options, queryOptions) {
    var hasJoin = false

    // no options defined?
    // return an emitter which emits null
    if ([null, undefined].indexOf(options) !== -1) {
      return new Utils.CustomEventEmitter(function(emitter) {
        setTimeout(function() { emitter.emit('success', null) }, 10)
      }).run()
    }

    var primaryKeys = this.primaryKeys
      , keys        = Object.keys(primaryKeys)
      , keysLength  = keys.length
      , tableNames  = { }

    tableNames[this.tableName] = true

    // options is not a hash but an id
    if (typeof options === 'number') {
      var oldOption = options
      options = { where: {} }
      if (keysLength === 1) {
        options.where[keys[0]] = oldOption
      } else {
        options.where.id = oldOption
      }
    } else if (Utils._.size(primaryKeys) && Utils.argsArePrimaryKeys(arguments, primaryKeys)) {
      var where = {}

      Utils._.each(arguments, function(arg, i) {
        var key = keys[i]
        where[key] = arg
      })

      options = { where: where }
    } else if (typeof options === 'string' && parseInt(options, 10).toString() === options) {
      var parsedId = parseInt(options, 10)

      if (!Utils._.isFinite(parsedId)) {
        throw new Error('Invalid argument to find(). Must be an id or an options object.')
      }

      options = { where: parsedId }
    } else if (typeof options === 'object') {
      options = Utils._.clone(options, function(thing) {
        if (Buffer.isBuffer(thing)) { return thing }
        return undefined;
      })

      if (options.hasOwnProperty('include') && options.include) {
        hasJoin = true

        validateIncludedElements.call(this, options, tableNames)
      }

      // whereCollection is used for non-primary key updates
      this.options.whereCollection = options.where || null
    } else if (typeof options === "string") {
      var where = {}

      if (this.primaryKeyCount === 1) {
        where[primaryKeys[keys[0]]] = options;
        options = where;
      } else if (this.primaryKeyCount < 1) {
        // Revert to default behavior which is {where: [int]}
        options = {where: parseInt(Number(options) || 0, 0)}
      }
    }

    options = paranoidClause.call(this, options)
    if (options.limit === undefined) {
      options.limit = 1
    }

    return this.QueryInterface.select(this, this.getTableName(), options, Utils._.defaults({
      plain: true,
      type: QueryTypes.SELECT,
      hasJoin: hasJoin,
      tableNames: Object.keys(tableNames)
    }, queryOptions, { transaction: (options || {}).transaction }))
  }

  DAOFactory.prototype.aggregate = function(field, aggregateFunction, options) {
    var tableField;

    if (field == '*') {
      tableField = field
    } else {
      tableField = this.QueryInterface.QueryGenerator.quoteIdentifier(field)
    }

    options = Utils._.extend({ attributes: [] }, options || {})
    options.attributes.push([aggregateFunction + '(' + tableField + ')', aggregateFunction])

    if (!options.dataType) {
      if (this.rawAttributes[field]) {
        options.dataType = this.rawAttributes[field]
      } else {
        // Use FLOAT as fallback
        options.dataType = DataTypes.FLOAT
      }
    }

    options = paranoidClause.call(this, options)

    return this.QueryInterface.rawSelect(this.getTableName(), options, aggregateFunction)
  }

  DAOFactory.prototype.count = function(options) {
    options = Utils._.clone(options || {})

    return new Utils.CustomEventEmitter(function (emitter) {
      var col = this.sequelize.col('*')
      if (options.include) {
        col = this.sequelize.col(this.tableName+'.'+(this.primaryKeyAttributes[0] || 'id'))
      }

      options.attributes = [
        [this.sequelize.fn('COUNT', col), 'count']
      ]

      if(options.distinct) {
        options.attributes = [
            [this.sequelize.fn('COUNT', this.sequelize.fn('DISTINCT', col) ), 'count']
        ]
      }

      options.includeIgnoreAttributes = false
      options.limit = null

      this.find(options, {raw: true, transaction: options.transaction}).proxy(emitter, {events: ['sql', 'error']}).success(function (result) {
        var count = (result && result.count) ? parseInt(result.count, 10) : 0
        emitter.emit('success', count)
      })
    }.bind(this)).run()
  }

  DAOFactory.prototype.findAndCountAll = function(findOptions, queryOptions) {
    var self  = this
      // no limit, offset, order, attributes for the options given to count()
      , countOptions = Utils._.omit(findOptions ? Utils._.merge({}, findOptions) : {}, ['offset', 'limit', 'order', 'attributes'])

    return new Utils.CustomEventEmitter(function (emitter) {
      var emit = {
        okay : function(count, results) {     // emit success
          emitter.emit('success', {
            count: count || 0,
            rows : (results && Array.isArray(results) ? results : [])
          })
        }
      }

      self.count(countOptions)
        .proxy(emitter, {events: ['sql', 'error']})
        .success(function(count) {
          if (count === 0) {
            return emit.okay(count) // no records, no need for another query
          }

          self.findAll(findOptions, queryOptions)
            .proxy(emitter, {events: ['sql', 'error']})
            .success(function(results) {
              emit.okay(count, results)
            })
        })

    }).run()
  }

  DAOFactory.prototype.max = function(field, options) {
    return this.aggregate(field, 'max', options)
  }

  DAOFactory.prototype.min = function(field, options) {
    return this.aggregate(field, 'min', options)
  }

  DAOFactory.prototype.sum = function(field, options) {
    return this.aggregate(field, 'sum', options)
  }

  DAOFactory.prototype.build = function(values, options) {
    options = options || { isNewRecord: true, isDirty: true }

    if (options.hasOwnProperty('include') && options.include && !options.includeValidated) {
      validateIncludedElements.call(this, options)
    }

    return new this.DAO(values, options)
  }

  DAOFactory.prototype.create = function(values, fieldsOrOptions) {
    Utils.validateParameter(values, Object, { optional: true })
    Utils.validateParameter(fieldsOrOptions, Object, { deprecated: Array, optional: true, index: 2, method: 'DAOFactory#create' })

    if (fieldsOrOptions instanceof Array) {
      fieldsOrOptions = { fields: fieldsOrOptions }
    }

    fieldsOrOptions = Utils._.extend({
      transaction: null
    }, fieldsOrOptions || {})

    return this.build(values).save(fieldsOrOptions)
  }

  DAOFactory.prototype.findOrInitialize = DAOFactory.prototype.findOrBuild = function (params, defaults, options) {
    defaults = defaults || {}
    options  = options  || {}

    var self          = this
      , defaultKeys   = Object.keys(defaults)
      , defaultLength = defaultKeys.length

    if (!options.transaction && defaults.transaction && (defaults.transaction instanceof Transaction)) {
      options.transaction = defaults.transaction
      delete defaults.transaction
    }

    return new Utils.CustomEventEmitter(function (emitter) {
      self.find({
        where: params
      }, options).success(function (instance) {
        if (instance === null) {
          var i = 0

          for (i = 0; i < defaultLength; i++) {
            params[defaultKeys[i]] = defaults[defaultKeys[i]]
          }

          var build = self.build(params)

          build.hookValidate({skip: Object.keys(params)}).success(function (instance) {
            emitter.emit('success', build, true)
          })
          .error(function (error) {
            emitter.emit('error', error)
          })
        } else {
          emitter.emit('success', instance, false)
        }
      }).error(function (error) {
        emitter.emit('error', error)
      })
    }).run()
  }

  DAOFactory.prototype.findOrCreate = function (where, defaults, options) {
    var self   = this
      , values = {}

    options = Utils._.extend({
      transaction: null
    }, options || {})

    if (!(where instanceof Utils.or) && !(where instanceof Utils.and) && !Array.isArray(where)) {
      for (var attrname in where) {
        values[attrname] = where[attrname]
      }
    }

    return new Utils.CustomEventEmitter(function (emitter) {
      self.find({
        where: where
      }, {
        transaction: options.transaction
      }).success(function (instance) {
        if (instance === null) {
          for (var attrname in defaults) {
            values[attrname] = defaults[attrname]
          }

          self
            .create(values, options)
            .success(function (instance) {
              emitter.emit('success', instance, true)
            })
            .error( function (error) {
              emitter.emit('error', error)
            })
        } else {
          emitter.emit('success', instance, false)
        }
      }).error(function (error) {
        emitter.emit('error', error)
      });
    }).run()
  }

  /**
   * Create and insert multiple instances
   *
   * @param  {Array} records List of objects (key/value pairs) to create instances from
   * @param  {Array} fields Fields to insert (defaults to all fields)
   * @return {Object}       A promise which fires `success`, `error`, `complete` and `sql`.
   *
   * Note: the `success` handler is not passed any arguments. To obtain DAOs for
   * the newly created values, you will need to query for them again. This is
   * because MySQL and SQLite do not make it easy to obtain back automatically
   * generated IDs and other default values in a way that can be mapped to
   * multiple records
   */
  DAOFactory.prototype.bulkCreate = function(records, fieldsOrOptions, options) {
    Utils.validateParameter(fieldsOrOptions, Object, { deprecated: Array, optional: true, index: 2, method: 'DAOFactory#bulkCreate' })
    Utils.validateParameter(options, 'undefined', { deprecated: Object, optional: true, index: 3, method: 'DAOFactory#bulkCreate' })

    if (!records.length) {
      return new Utils.CustomEventEmitter(function(emitter) {
        emitter.emit('success', [])
      }).run();
    }

    options = Utils._.extend({
      validate: false,
      hooks: false,
      ignoreDuplicates: false
    }, options || {})

    if (fieldsOrOptions instanceof Array) {
      options.fields = fieldsOrOptions
    } else {
      options.fields = options.fields || []
      options = Utils._.extend(options, fieldsOrOptions)
    }

    if(this.daoFactoryManager.sequelize.options.dialect === 'postgres' && options.ignoreDuplicates ) {
      return new Utils.CustomEventEmitter(function(emitter) {
        emitter.emit('error', new Error('Postgres does not support the \'ignoreDuplicates\' option.'))
      }).run();
    }

    var self          = this
      , updatedAtAttr = this._timestampAttributes.updatedAt
      , createdAtAttr = this._timestampAttributes.createdAt
      , errors        = []
      , daos          = records.map(function(v) { return self.build(v) })

    return new Utils.CustomEventEmitter(function(emitter) {
      var done = function() {
        self.runHooks('afterBulkCreate', daos, options.fields, function(err, newRecords, newFields) {
          if (!!err) {
            return emitter.emit('error', err)
          }

          daos           = newRecords || daos
          options.fields = newFields  || options.fields

          emitter.emit('success', daos, options.fields)
        })
      }

      var next = function() {
        if (options.hooks === false) {
          return runQuery()
        }

        var i = 0
        var iterate = function(i) {
          self.runHooks('beforeCreate', daos[i], function(err, newValues) {
            if (!!err) {
              return emitter.emit('error', err)
            }

            daos[i] = newValues || daos[i]
            daos[i].save({ transaction: options.transaction }).error(function(err) {
              emitter.emit('error', err)
            }).success(function() {
              self.runHooks('afterCreate', daos[i], function(err, newValues) {
                if (!!err) {
                  return emitter.emit('error', err)
                }

                daos[i] = newValues || daos[i]
                i++
                if (i >= daos.length) {
                  return done()
                }

                iterate(i)
              })
            })
          })
        }

        iterate(i)
      }

      var runQuery = function() {
        // we will re-create from DAOs, which may have set up default attributes
        records = []

        daos.forEach(function(dao) {
          var values = options.fields.length > 0 ? {} : dao.dataValues

          options.fields.forEach(function(field) {
            values[field] = dao.dataValues[field]
          })

          if (createdAtAttr && !values[createdAtAttr]) {
            values[createdAtAttr] = Utils.now(self.daoFactoryManager.sequelize.options.dialect)
          }

          if (updatedAtAttr && !values[updatedAtAttr]) {
            values[updatedAtAttr] = Utils.now(self.daoFactoryManager.sequelize.options.dialect)
          }

          records.push(values)
        })

        self.QueryInterface.bulkInsert(self.tableName, records, options)
        .on('sql', function(sql) {
          emitter.emit('sql', sql)
        })
        .error(function(err) {
          emitter.emit('error', err)
        }).success(function(rows) {
          done()
        })
      }

      self.runHooks('beforeBulkCreate', daos, options.fields, function(err, newRecords, newFields) {
        if (!!err) {
          return emitter.emit('error', err)
        }

        daos           = newRecords || daos
        options.fields = newFields  || options.fields

        if (options.validate === true) {
          if (options.fields.length) {
            var skippedFields = Utils._.difference(Object.keys(self.attributes), options.fields);
          }

          if (options.hooks === true) {
            var iterate = function(i) {

              daos[i].hookValidate({skip: skippedFields}).error(function(err) {
                errors[errors.length] = {record: v, errors: err}
                i++
                if (i > daos.length) {
                  if (errors.length > 0) {
                    return emitter.emit('error', errors)
                  }

                  return next()
                }
                iterate(i)
              })
            }
          } else {
            daos.forEach(function(v) {
              var valid = v.validate({skip: skippedFields})
              if (valid !== null) {
                errors[errors.length] = {record: v, errors: valid}
              }
            })

            if (errors.length > 0) {
              return emitter.emit('error', errors)
            }

            next()
          }
        } else {
          next()
        }
      })
    }).run()
  }

  /**
   * Delete multiple instances
   *
   * @param  {Object} where   Options to describe the scope of the search.
   * @param  {Object} options Possible options are:
                              - hooks: If set to true, destroy will find all records within the where parameter and will execute before/afterDestroy hooks on each row
                              - limit: How many rows to delete
                              - truncate: If set to true, dialects that support it will use TRUNCATE instead of DELETE FROM. If a table is truncated the where and limit options are ignored
   * @return {Object}         A promise which fires `success`, `error`, `complete` and `sql`.
   */
  DAOFactory.prototype.destroy = function(where, options) {
    options = options || {}
    options.force = options.force === undefined ? false : Boolean(options.force)
    options.type = QueryTypes.BULKDELETE

    var self  = this
      , query = null
      , args  = []

    return new Utils.CustomEventEmitter(function(emitter) {
      self.runHooks(self.options.hooks.beforeBulkDestroy, where, function(err, newWhere) {
        if (!!err) {
          return emitter.emit('error', err)
        }

        where = newWhere || where

        if (self._timestampAttributes.deletedAt && options.force === false) {
          var attrValueHash = {}
          attrValueHash[self._timestampAttributes.deletedAt] = Utils.now()
          query = 'bulkUpdate'
          args  = [self.tableName, attrValueHash, where]
        } else {
          query = 'bulkDelete'
          args  = [self.tableName, where, options]
        }

        var runQuery = function(err, records) {
          if (!!err) {
            return emitter.emit('error', err)
          }

          query = self.QueryInterface[query].apply(self.QueryInterface, args)
          query.on('sql', function(sql) {
            emitter.emit('sql', sql)
          })
          .error(function(err) {
            emitter.emit('error', err)
          })
          .success(function(results) {
            var finished = function(err) {
              if (!!err) {
                return emitter.emit('error', err)
              }

              self.runHooks(self.options.hooks.afterBulkDestroy, where, function(err) {
                if (!!err) {
                  return emitter.emit('error', err)
                }

                emitter.emit('success', results)
              })
            }

            if (options && options.hooks === true) {
              var tick = 0
              var next = function(i) {
                if (i >= records.length) {
                  return finished();
                }

                self.runHooks(self.options.hooks.afterDestroy, records[i], function(err, newValues) {
                  if (!!err) {
                    return finished(err)
                  }

                  records[i].dataValues = !!newValues ? newValues.dataValues : records[i].dataValues
                  tick++

                  next(tick)
                })
              }

              next(tick)
            } else {
              finished()
            }
          })
        }

        if (options && options.hooks === true) {
          var tick = 0
          self.all({where: where}).error(function(err) { emitter.emit('error', err) })
          .success(function(records) {
            var next = function(i) {
              if (i >= records.length) {
                return runQuery(null, records)
              }

              self.runHooks(self.options.hooks.beforeDestroy, records[i], function(err, newValues) {
                if (!!err) {
                  return runQuery(err)
                }

                records[i].dataValues = !!newValues ? newValues.dataValues : records[i].dataValues
                tick++

                next(tick)
              })
            }

            next(tick)
          })
          //
        } else {
          runQuery()
        }
      })
    }).run()
  }

  /**
   * Update multiple instances
   *
   * @param  {Object} attrValueHash A hash of fields to change and their new values
   * @param  {Object} where         Options to describe the scope of the search.
   * @return {Object}               A promise which fires `success`, `error`, `complete` and `sql`.
   */
  DAOFactory.prototype.update = function(attrValueHash, where, options) {
    var self  = this
      , query = null
      , tick  = 0

    options = options || {}
    options.validate  = options.validate === undefined ? true : Boolean(options.validate)
    options.hooks     = options.hooks === undefined ? false : Boolean(options.hooks)
    options.type      = QueryTypes.BULKUPDATE

    if (self._timestampAttributes.updatedAt) {
      attrValueHash[self._timestampAttributes.updatedAt] = Utils.now()
    }

    return new Utils.CustomEventEmitter(function(emitter) {
      var runSave = function() {
        self.runHooks(self.options.hooks.beforeBulkUpdate, attrValueHash, where, function(err, attributes, _where) {
          if (!!err) {
            return emitter.emit('error', err)
          }

          where         = _where || where
          attrValueHash = attributes || attrValueHash

          var runQuery = function(err, records) {
            if (!!err) {
              return emitter.emit('error', err)
            }

            query = self.QueryInterface.bulkUpdate(self.tableName, attrValueHash, where, options)
            query.on('sql', function(sql) {
              emitter.emit('sql', sql)
            })
            .error(function(err) {
              emitter.emit('error', err)
            })
            .success(function(results) {
              var finished = function(err, records) {
                if (!!err) {
                  return emitter.emit('error', err)
                }

                self.runHooks(self.options.hooks.afterBulkUpdate, attrValueHash, where, function(err) {
                  if (!!err) {
                    return emitter.emit('error', err)
                  }

                  emitter.emit('success', records)
                })
              }

              if (options && options.hooks === true && !!records && records.length > 0) {
                var tick = 0
                var next = function(i) {
                  if (i >= records.length) {
                    return finished(null, records)
                  }

                  self.runHooks(self.options.hooks.afterUpdate, records[i], function(err, newValues) {
                    if (!!err) {
                      return finished(err)
                    }

                    records[i].dataValues = !!newValues ? newValues.dataValues : records[i].dataValues
                    tick++

                    next(tick)
                  })
                }

                next(tick)
              } else {
                finished(null, results)
              }
            })
          }

          if (options.hooks === true) {
            self.all({where: where}).error(function(err) { emitter.emit('error', err) })
            .success(function(records) {
              if (records === null || records.length < 1) {
                return runQuery(null)
              }

              var next = function(i) {
                if (i >= records.length) {
                  return runQuery(null, records)
                }

                self.runHooks(self.options.hooks.beforeUpdate, records[i], function(err, newValues) {
                  if (!!err) {
                    return runQuery(err)
                  }

                  records[i].dataValues = !!newValues ? newValues.dataValues : records[i].dataValues
                  tick++

                  next(tick)
                })
              }

              next(tick)
            })
          } else {
            runQuery()
          }
        })
      }

      if (options.validate === true) {
        var build = self.build(attrValueHash)
        build.set(self._timestampAttributes.updatedAt, attrValueHash[self._timestampAttributes.updatedAt], { raw: true })

        // We want to skip validations for all other fields
        var updatedFields = Object.keys(attrValueHash)
        var skippedFields = Utils._.difference(Object.keys(self.attributes), updatedFields)

        build.hookValidate({skip: skippedFields}).error(function(err) {
          emitter.emit('error', err)
        }).success(function(attributes) {
          if (!!attributes && !!attributes.dataValues) {
            attrValueHash = Utils._.pick.apply(Utils._, [].concat(attributes.dataValues).concat(Object.keys(attrValueHash)))
          }

          runSave()
        })
      } else {
        runSave()
      }
    }).run()
  }

  DAOFactory.prototype.describe = function(schema) {
    return this.QueryInterface.describeTable(this.tableName, schema || this.options.schema || undefined)
  }

  DAOFactory.prototype.dataset = function() {
    if (!this.__sql) {
      this.__setSqlDialect()
    }

    var instance   = this.__sql.define({ name: this.tableName, columns: [] })
      , attributes = this.attributes

    Object.keys(attributes).forEach(function(key) {
      instance.addColumn(key, attributes[key])
    })

    return instance
  }

  DAOFactory.prototype.__setSqlDialect = function() {
    var dialect = this.daoFactoryManager.sequelize.options.dialect
    this.__sql = sql.setDialect(dialect === 'mariadb' ? 'mysql' : dialect)
  }

  // private

  var paranoidClause = function(options) {
    if (this.options.paranoid === true) {
      options = options || {}
      options.where = options.where || {}

      var deletedAtCol = this._timestampAttributes.deletedAt
        , quoteIdentifiedDeletedAtCol = this.QueryInterface.quoteIdentifier(deletedAtCol)

      // Don't overwrite our explicit deletedAt search value if we provide one
      if (!!options.where[deletedAtCol]) {
        return options
      }

      if(this.tableName) {
        quoteIdentifiedDeletedAtCol = this.QueryInterface.quoteIdentifier(this.tableName) + '.' + quoteIdentifiedDeletedAtCol
      }

      if (typeof options.where === "string") {
        options.where += ' AND ' + quoteIdentifiedDeletedAtCol + ' IS NULL '
      }
      else if (Array.isArray(options.where)) {

        // Don't overwrite our explicit deletedAt search value if we provide one
        if(options.where[0].indexOf(deletedAtCol) !== -1) {
          return options
        }
        options.where[0] += ' AND ' + quoteIdentifiedDeletedAtCol + ' IS NULL '
      } else {
        options.where[deletedAtCol] = null
      }
    }

    return options
  }

  var addOptionalClassMethods = function() {
    var self = this
    Utils._.each(this.options.classMethods || {}, function(fct, name) { self[name] = fct })
  }

  var addDefaultAttributes = function() {
    var self              = this
      , tail = {}
      , head = {
        id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true,
          _autoGenerated: true
        }
      }

    if (this.hasPrimaryKeys) {
      head = {}
    }

    if (this._timestampAttributes.createdAt) {
      tail[this._timestampAttributes.createdAt] = {type: DataTypes.DATE, allowNull: false}
    }
    if (this._timestampAttributes.updatedAt) {
      tail[this._timestampAttributes.updatedAt] = {type: DataTypes.DATE, allowNull: false}
    }
    if (this._timestampAttributes.deletedAt) {
      tail[this._timestampAttributes.deletedAt] = {type: DataTypes.DATE}
    }

    var existingAttributes = Utils._.clone(self.rawAttributes)
    self.rawAttributes = {}

    Utils._.each(head, function(value, attr) {
      self.rawAttributes[attr] = value
    })

    Utils._.each(existingAttributes, function(value, attr) {
      self.rawAttributes[attr] = value
    })

    Utils._.each(tail, function(value, attr) {
      if (Utils._.isUndefined(self.rawAttributes[attr])) {
        self.rawAttributes[attr] = value
      }
    })
  }

  var findAutoIncrementField = function() {
    var fields = this.QueryGenerator.findAutoIncrementField(this)

    this.autoIncrementField = null

    fields.forEach(function(field) {
      if (this.autoIncrementField) {
        throw new Error('Invalid DAO definition. Only one autoincrement field allowed.')
      } else {
        this.autoIncrementField = field
      }
    }.bind(this))
  }

  var validateIncludedElements = function(options, tableNames) {
    tableNames = tableNames || {}
    options.includeNames = []
    options.includeMap = {}
    options.hasSingleAssociation = false
    options.hasMultiAssociation = false

    // if include is not an array, wrap in an array
    if (!Array.isArray(options.include)) {
      options.include = [options.include]
    }

    // convert all included elements to { daoFactory: Model } form
    var includes = options.include = options.include.map(function(include) {
      if (include instanceof DAOFactory) {
        return { daoFactory: include }
      } else if (typeof include !== 'object') {
        throw new Error('Include unexpected. Element has to be either an instance of DAOFactory or an object.')
      } else if (include.hasOwnProperty('model')) {
        include.daoFactory = include.model
        delete include.model
      }
      return include
    })

    // validate all included elements
    for (var index = 0; index < includes.length; index++) {
      var include = includes[index]

      if (include.all) {
        includes.splice(index, 1)
        index--

        validateIncludedAllElement.call(this, includes, include)
        continue
      }

      include = includes[index] = validateIncludedElement.call(this, include, tableNames)

      include.parent = options
      // associations that are required or have a required child as is not a ?:M association are candidates for the subquery
      include.subQuery = !include.association.isMultiAssociation && (include.hasIncludeRequired || include.required)
      include.hasParentWhere = options.hasParentWhere || !!options.where
      include.hasParentRequired = options.hasParentRequired || !!options.required

      options.includeMap[include.as] = include
      options.includeNames.push(include.as)
      options.includeNames.push(include.as.substr(0,1).toLowerCase() + include.as.substr(1))

      if (include.association.isMultiAssociation || include.hasMultiAssociation) options.hasMultiAssociation = true
      if (include.association.isSingleAssociation || include.hasSingleAssociation) options.hasSingleAssociation = true

      options.hasIncludeWhere = options.hasIncludeWhere || include.hasIncludeWhere || !!include.where
      options.hasIncludeRequired = options.hasIncludeRequired || include.hasIncludeRequired || !!include.required
    }
  }

  var validateIncludedElement = function(include, tableNames) {
    if (!include.hasOwnProperty('daoFactory')) {
      throw new Error('Include malformed. Expected attributes: daoFactory, as!')
    }

    tableNames[include.daoFactory.tableName] = true

    if (include.hasOwnProperty('attributes')) {
      var primaryKeys;
      if (include.daoFactory.hasPrimaryKeys) {
        primaryKeys = []
        for (var field_name in include.daoFactory.primaryKeys) {
          primaryKeys.push(field_name)
        }
      } else {
        primaryKeys = ['id']
      }
      include.attributes = include.attributes.concat(primaryKeys)
    } else {
      include.attributes = Object.keys(include.daoFactory.attributes)
    }

    // pseudo include just needed the attribute logic, return
    if (include._pseudo) return include

    // check if the current daoFactory is actually associated with the passed daoFactory - or it's a pseudo include
    var association = this.getAssociation(include.daoFactory, include.as)
    if (association) {
      include.association = association
      include.as = association.as

      // If through, we create a pseudo child include, to ease our parsing later on
      if (Object(include.association.through) === include.association.through) {
        if (!include.include) include.include = []
        var through = include.association.through

        include.through = {
          daoFactory: through,
          as: Utils.singularize(through.tableName, through.options.language),
          association: {
            isSingleAssociation: true
          },
          _pseudo: true
        }

        include.include.push(include.through)
        tableNames[through.tableName] = true
      }

      if (include.required === undefined) {
        include.required = !!include.where
      }

      // Validate child includes
      if (include.hasOwnProperty('include')) {
        validateIncludedElements.call(include.daoFactory, include, tableNames)
      }

      return include
    } else {
      var msg = include.daoFactory.name

      if (include.as) {
        msg += " (" + include.as + ")"
      }

      msg += " is not associated to " + this.name + "!"

      throw new Error(msg)
    }
  }

  var validateIncludedAllElement = function(includes, include) {
    // check 'all' attribute provided is valid
    var all = include.all
    delete include.all

    if (all !== true) {
      if (!Array.isArray(all)) {
        all = [all]
      }

      var validTypes = {
        BelongsTo: true,
        HasOne: true,
        HasMany: true,
        One: ['BelongsTo', 'HasOne'],
        Has: ['HasOne', 'HasMany'],
        Many: ['HasMany']
      }

      for (var i = 0; i < all.length; i++) {
        var type = all[i]
        if (type == 'All') {
          all = true
          break
        }

        var types = validTypes[type]
        if (!types) {
          throw new Error('include all \'' + type + '\' is not valid - must be BelongsTo, HasOne, HasMany, One, Has, Many or All')
        }

        if (types !== true) {
          // replace type placeholder e.g. 'One' with it's constituent types e.g. 'HasOne', 'BelongsTo'
          all.splice(i, 1)
          i--
          for (var j = 0; j < types.length; j++) {
            if (all.indexOf(types[j]) == -1) {
              all.unshift(types[j])
              i++
            }
          }
        }
      }
    }

    // add all associations of types specified to includes
    var nested = include.nested
    if (nested) {
      delete include.nested

      if (!include.include) {
        include.include = []
      } else if (!Array.isArray(include.include)) {
        include.include = [include.include]
      }
    }

    var used = []
    ;(function addAllIncludes(parent, includes) {
      used.push(parent)
      Utils._.forEach(parent.associations, function(association) {
        if (all !== true && all.indexOf(association.associationType) == -1) {
          return
        }

        // check if model already included, and skip if so
        var model = association.target
        var as = association.options.as
        if (Utils._.find(includes, {daoFactory: model, as: as})) {
          return
        }

        // skip if recursing over a model already nested
        if (nested && used.indexOf(model) != -1) {
          return
        }

        // include this model
        var thisInclude = optClone(include)
        thisInclude.daoFactory = model
        if (as) {
          thisInclude.as = as
        }
        includes.push(thisInclude)

        // run recursively if nested
        if (nested) {
          addAllIncludes(model, thisInclude.include)
        }
      })
      used.pop()
    })(this, includes)
  }

  var replaceReferencesWithTableNames = function(attributes) {
    Object.keys(attributes).forEach(function(attrName) {
      if (attributes[attrName].references instanceof DAOFactory) {
        attributes[attrName].references = attributes[attrName].references.tableName
      }
    })

    return attributes
  }

  var optClone = function (options) {
    return Utils._.cloneDeep(options, function (elem) {
      // The DAOFactories used for include are pass by ref, so don't clone them.
      if (elem instanceof DAOFactory || elem instanceof Utils.col || elem instanceof Utils.literal || elem instanceof Utils.cast || elem instanceof Utils.fn || elem instanceof Utils.and || elem instanceof Utils.or) {
        return elem
      }
      // Unfortunately, lodash.cloneDeep doesn't preserve Buffer.isBuffer, which we have to rely on for binary data
      if (Buffer.isBuffer(elem)) { return elem; }

      // Otherwise return undefined, meaning, 'handle this lodash'
      return undefined
    })
  }

  Utils._.extend(DAOFactory.prototype, require("./associations/mixin"))
  Utils._.extend(DAOFactory.prototype, require(__dirname + '/hooks'))

  return DAOFactory
})()
