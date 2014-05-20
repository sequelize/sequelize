var Utils       = require("./utils")
  , Instance    = require("./instance")
  , Attribute   = require("./model/attribute")
  , DataTypes   = require("./data-types")
  , Util        = require('util')
  , sql         = require('sql')
  , SqlString   = require('./sql-string')
  , Transaction = require('./transaction')
  , QueryTypes  = require('./query-types')
  , Promise = require("./promise")

module.exports = (function() {
  /**
   * A Model represents a table in the database. Sometimes you might also see it refererred to as model, or simply as factory. This class should _not_ be instantiated directly, it is created using `sequelize.define`, and already created models can be loaded using `sequelize.import`
   * 
   * @class Model
   * @mixes Hooks
   * @mixes Associations
   */
  var Model = function(name, attributes, options) {
    this.options = Utils._.extend({
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      deletedAt: 'deletedAt',
      instanceMethods: {},
      classMethods: {},
      validate: {},
      freezeTableName: false,
      underscored: false,
      underscoredAll: false,
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

    this.sequelize = options.sequelize
    this.underscored = this.underscored || this.underscoredAll

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
      this.tableName = this.options.freezeTableName ? name : Utils._.underscoredIf(Utils.pluralize(name, this.options.language), this.options.underscoredAll)
    } else {
      this.tableName = this.options.tableName
    }

    // If you don't specify a valid data type lets help you debug it
    Utils._.each(attributes, function(attribute, name) {
      var dataType;
      if (Utils.isHash(attribute)) {
        // We have special cases where the type is an object containing
        // the values (e.g. Sequelize.ENUM(value, value2) returns an object
        // instead of a function)
        // Copy these values to the dataType
        attribute.values = (attribute.type && attribute.type.values) || attribute.values;

        // We keep on working with the actual type object
        dataType = attribute.type
      } else {
        dataType = attribute;
      }

      if (dataType === undefined) {
        throw new Error('Unrecognized data type for field '+ name)
      }

      if (dataType.toString() === "ENUM") {
        if (!(Array.isArray(attribute.values) && (attribute.values.length > 0))) {
          throw new Error('Values for ENUM haven\'t been defined.')
        }
        attributes[name].validate = attributes[name].validate || {
          _checkEnum: function(value, next) {
            var hasValue        = value !== undefined
              , isMySQL         = ['mysql', 'mariadb'].indexOf(options.sequelize.options.dialect) !== -1
              , ciCollation     = !!options.collate && options.collate.match(/_ci$/i) !== null
              , valueOutOfScope


            if (isMySQL && ciCollation && hasValue) {
              var scopeIndex = (attributes[name].values || []).map(function(d) { return d.toLowerCase() }).indexOf(value.toLowerCase())
              valueOutOfScope = scopeIndex === -1
            } else {
              valueOutOfScope = ((attributes[name].values || []).indexOf(value) === -1)
            }

            if (hasValue && valueOutOfScope && !(attributes[name].allowNull === true && values[attrName] === null)) {
              return next('Value "' + value + '" for ENUM ' + name + ' is out of allowed scope. Allowed values: ' + attributes[name].values.join(', '))
            }
            next()
          }
        }
      }
    })

    Object.keys(attributes).forEach(function(attrName) {
      if (attributes[attrName].references instanceof Model) {
        attributes[attrName].references = attributes[attrName].references.tableName
      }
    })
    
    this.options.hooks = this.replaceHookAliases(this.options.hooks)

    this.attributes        =
    this.rawAttributes     = attributes
    this.modelManager      = 
    this.daoFactoryManager = null // defined in init function
    this.associations      = {}
    this.scopeObj          = {}
  }

  /**
   * A reference to the sequelize instance
   * @property sequelize
   * @return {Sequelize}
   */
  Object.defineProperty(Model.prototype, 'sequelize', {
    get: function() { return this.modelManager.sequelize }
  })

  Object.defineProperty(Model.prototype, 'QueryInterface', {
    get: function() { return this.modelManager.sequelize.getQueryInterface() }
  })

  Object.defineProperty(Model.prototype, 'QueryGenerator', {
    get: function() { return this.QueryInterface.QueryGenerator }
  })

  // inject the node-sql methods to the dao factory in order to
  // receive the syntax sugar ...

 ;(function() {
    var instance = sql.define({ name: "dummy", columns: [] })

    for (var methodName in instance) {
     ;(function(methodName) {
        Model.prototype[methodName] = function() {
          var dataset = this.dataset()
            , result  = dataset[methodName].apply(dataset, arguments)
            , dialect = this.modelManager.sequelize.options.dialect
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

            return self.sequelize.query(result.toSql(), self, options)
          }

          return result
        }
      })(methodName)
    }
  })()

  Model.prototype.init = function(modelManager) {
    var self = this

    this.modelManager       = 
    this.daoFactoryManager  = modelManager
    this.primaryKeys        = {}
    self.options.uniqueKeys = {}

    // Setup names of timestamp attributes
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
    }

    // Identify primary and unique attributes
    Utils._.each(this.rawAttributes, function(options, attribute) {
      if (options.hasOwnProperty('unique') && options.unique !== true && options.unique !== false) {
        var idxName = options.unique
        if (typeof options.unique === "object") {
          idxName = options.unique.name
        }

        self.options.uniqueKeys[idxName] = self.options.uniqueKeys[idxName] || {fields: [], msg: null}
        self.options.uniqueKeys[idxName].fields.push(attribute)
        self.options.uniqueKeys[idxName].msg = self.options.uniqueKeys[idxName].msg || options.unique.msg || null
      }

      if (options.primaryKey === true) {
        self.primaryKeys[attribute] = self.attributes[attribute]
      }
    })

    // Add head and tail default attributes (id, timestamps)
    addDefaultAttributes.call(this)
    addOptionalClassMethods.call(this)

    // Primary key convenience variables
    this.primaryKeyAttributes = Object.keys(this.primaryKeys)
    this.primaryKeyAttribute = this.primaryKeyAttributes[0]
    this.primaryKeyCount = this.primaryKeyAttributes.length
    this._hasPrimaryKeys = this.options.hasPrimaryKeys = this.hasPrimaryKeys = this.primaryKeyCount > 0

    this._isPrimaryKey = Utils._.memoize(function (key) {
      return self.primaryKeyAttributes.indexOf(key) !== -1
    })


    if (typeof this.options.defaultScope === "object") {
      Utils.injectScope.call(this, this.options.defaultScope)
    }

    // Instance prototype
    this.Instance = this.DAO = function() {
      Instance.apply(this, arguments);
    }

    Util.inherits(this.Instance, Instance);

    this._readOnlyAttributes = Utils._.values(this._timestampAttributes)
    this._hasReadOnlyAttributes = this._readOnlyAttributes && this._readOnlyAttributes.length
    this._isReadOnlyAttribute = Utils._.memoize(function (key) {
      return self._hasReadOnlyAttributes && self._readOnlyAttributes.indexOf(key) !== -1
    })

    if (this.options.instanceMethods) {
      Utils._.each(this.options.instanceMethods, function(fct, name) {
        self.Instance.prototype[name] = fct
      })
    }

    this.refreshAttributes();
    findAutoIncrementField.call(this);

    this._booleanAttributes = []
    this._dateAttributes = []
    this._hstoreAttributes = []
    this._defaultValues = {}
    this.Instance.prototype.validators    = {}

    Utils._.each(this.rawAttributes, function (definition, name) {
      if (((definition === DataTypes.BOOLEAN) || (definition.type === DataTypes.BOOLEAN))) {
        self._booleanAttributes.push(name);
      }
      if (((definition === DataTypes.DATE) || (definition.type === DataTypes.DATE) || (definition.originalType === DataTypes.DATE))) {
        self._dateAttributes.push(name);
      }
      if (((definition === DataTypes.HSTORE.type) || (definition.type === DataTypes.HSTORE.type) || (definition.originalType === DataTypes.HSTORE.type))) {
        self._hstoreAttributes.push(name);
      }
      if (definition.hasOwnProperty('defaultValue')) {
        self._defaultValues[name] = Utils._.partial(
          Utils.toDefaultValue, definition.defaultValue)
      }

      if (definition.hasOwnProperty('validate')) {
        self.Instance.prototype.validators[name] = definition.validate;
      }
    })

    this._hasBooleanAttributes = !!this._booleanAttributes.length
    this._isBooleanAttribute = Utils._.memoize(function (key) {
      return self._booleanAttributes.indexOf(key) !== -1
    })

    this._hasDateAttributes = !!this._dateAttributes.length
    this._isDateAttribute = Utils._.memoize(function (key) {
      return self._dateAttributes.indexOf(key) !== -1
    })

    this._hasHstoreAttributes = !!this._hstoreAttributes.length
    this._isHstoreAttribute = Utils._.memoize(function (key) {
      return self._hstoreAttributes.indexOf(key) !== -1
    })

    this.Instance.prototype.Model = this

    this._hasDefaultValues = !Utils._.isEmpty(this._defaultValues)

    return this
  }

  Model.prototype.refreshAttributes = function() {
    var self = this
      , attributeManipulation = {};

    this.Instance.prototype._customGetters = {}
    this.Instance.prototype._customSetters = {}

    Utils._.each(['get', 'set'], function(type) {
      var opt   = type + 'terMethods'
        , funcs = Utils._.clone(Utils._.isObject(self.options[opt]) ? self.options[opt] : {})
        , _custom = type === 'get' ? self.Instance.prototype._customGetters : self.Instance.prototype._customSetters

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
        options.Model = self
        options.fieldName = attribute
        options._modelAttribute = true

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
  
    this.attributes = this.rawAttributes;

    this.Instance.prototype._hasCustomGetters = Object.keys(this.Instance.prototype._customGetters).length
    this.Instance.prototype._hasCustomSetters = Object.keys(this.Instance.prototype._customSetters).length

    Object.defineProperties(this.Instance.prototype, attributeManipulation)

    this.Instance.prototype.rawAttributes = this.rawAttributes;
    this.Instance.prototype.attributes = Object.keys(this.Instance.prototype.rawAttributes)
    this.Instance.prototype._isAttribute = Utils._.memoize(function (key) {
      return self.Instance.prototype.attributes.indexOf(key) !== -1
    })
  }

  /**
   * Sync this Model to the DB, that is create the table. Upon success, the callback will be called with the model instance (this)
   * @see {Sequelize#sync} for options
   * @return {Promise<this>} 
   */
  Model.prototype.sync = function(options) {
    options = Utils._.extend({}, this.options, options || {})

    var self = this
      , doQuery = function() {
        return self.QueryInterface.createTable(self.getTableName(), self.attributes, options);
      }

    if (options.force) {
      return self.drop(options).then(function () {
        return doQuery().return(self)
      });
    } else {
      return doQuery().return(this)
    }
  }

  /**
   * Drop the table represented by this Model
   * @param {Object}  [options]
   * @param {Boolean} [options.cascade=false] Also drop all objects depending on this table, such as views. Only works in postgres
   * @return {Promise}
   */
  Model.prototype.drop = function(options) {
    return this.QueryInterface.dropTable(this.getTableName(), options)
  }

  Model.prototype.dropSchema = function(schema) {
    return this.QueryInterface.dropSchema(schema)
  }

  /**
   * Apply a schema to this model. For postgres, this will actually place the schema in front of the table name - `"schema"."tableName"`, 
   * while the schema will be prepended to the table name for mysql and sqlite - `'schema.tablename'`.
   *
   * @param {String} schema The name of the schema
   * @param {Object} [options]
   * @param {String} [options.schemaDelimiter='.'] The character(s) that separates the schema name from the table name
   * @return this
   */
  Model.prototype.schema = function(schema, options) {
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

  /**
   * Get the tablename of the model, taking schema into account. The method will return The name as a string if the model has no schema, 
   * or an object with `tableName`, `schema` and `delimiter` properties.
   *
   * @return {String|Object} 
   */
  Model.prototype.getTableName = function() {
    return this.QueryGenerator.addSchema(this)
  }

  /**
   * Apply a scope created in `define` to the model. First let's look at how to create scopes:
   * ```js
   * var Model = sequelize.define('model', attributes, {
   *   defaultScope: {
   *     where: {
   *       username: 'dan'
   *     },
   *     limit: 12
   *   },
   *   scopes: {
   *     isALie: {
   *       where: {
   *         stuff: 'cake'
   *       }
   *     },
   *     complexFunction: function(email, accessLevel) {
   *       return {
   *         where: ['email like ? AND access_level >= ?', email + '%', accessLevel]
   *       }
   *     },
   *   }
   * })
   * ```
   * Now, since you defined a default scope, every time you do Model.find, the default scope is appended to your query. Here's a couple of examples:
   * ```js
   * Model.findAll() // WHERE username = 'dan'
   * Model.findAll({ where: { age: { gt: 12 } } }) // WHERE age > 12 AND username = 'dan'
   * ``` 
   *
   * To invoke scope functions you can do:
   * ```js
   * Model.scope({ method: ['complexFunction' 'dan@sequelize.com', 42]}).findAll() 
   * // WHERE email like 'dan@sequelize.com%' AND access_level >= 42
   * ```
   *
   * @param {Array|Object|String|null}    options* The scope(s) to apply. Scopes can either be passed as consecutive arguments, or as an array of arguments. To apply simple scopes, pass them as strings. For scope function, pass an object, with a `method` property. The value can either be a string, if the method does not take any arguments, or an array, where the first element is the name of the method, and consecutive elements are arguments to that method. Pass null to remove all scopes, including the default.  
   * @return {Model}                      A reference to the model, with the scope(s) applied. Calling scope again on the returned model will clear the previous scope.
   */
  Model.prototype.scope = function(option) {
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

  Model.prototype.all = function(options, queryOptions) {
    return this.findAll(options, queryOptions)
  }

  /**
   * Search for multiple instances.
   *
   * __Simple search using AND and =__
   * ```js
   * Model.find({
   *   where: {
   *     attr1: 42,
   *     attr2: 'cake'
   *   }
   * })
   * ```
   * ```sql
   * WHERE attr1 = 42 AND attr2 = 'cake'
   *```
   * 
   * __Using greater than, less than etc.__
   * ```js
   *
   * Model.find({
   *   where: {
   *     attr1: {
   *       gt: 50
   *     },
   *     attr2: {
   *       lte: 45
   *     },
   *     attr3: {
   *       in: [1,2,3]
   *     },
   *     attr4: {
   *       ne: 5
   *     }
   *   }
   * }) 
   * ```
   * ```sql
   * WHERE attr1 > 50 AND attr2 <= 45 AND attr3 IN (1,2,3) AND attr4 != 5
   * ```
   * Possible options are: `gt, gte, lt, lte, ne, between/.., nbetween/notbetween/!.., in, not, like, nlike/notlike` 
   *
   * __Queries using OR__
   * ```js
   * Model.find({
   *   where: Sequelize.and(
   *     { name: 'a project' },
   *     Sequelize.or(
   *       { id: [1,2,3] },
   *       { id: { gt: 10 } }
   *     )
   *   )
   * })
   * ``` 
   * ```sql
   * WHERE name = 'a project' AND (id` IN (1,2,3) OR id > 10)
   * ```
   * 
   * The success listener is called with an array of instances if the query succeeds.
   * 
   * @param  {Object}                    [options] A hash of options to describe the scope of the search
   * @param  {Object}                    [options.where] A hash of attributes to describe your search. See above for examples.
   * @param  {Array<String>}             [options.attributes] A list of the attributes that you want to select
   * @param  {Array<Object|Model>}       [options.include] A list of associations to eagerly load. Supported is either { include: [ Model1, Model2, ...] } or { include: [ { model: Model1, as: 'Alias' } ] }. If your association are set up with an `as` (eg. `X.hasMany(Y, { as: 'Z }`, you need to specify Z in the as attribute when eager loading Y). When using the object form, you can also specify `attributes` to specify what columns to load, `where` to limit the relations, and `include` to load further nested relations
   * @param  {String|Array|Sequelize.fn} [options.order] Specifies an ordering. If a string is provided, it will be esacped. Using an array, you can provide several columns / functions to order by. Each element can be further wrapped in a two-element array. The first element is the column / function to order by, the second is the direction. For example: `order: [['name', 'DESC']]`. In this way the column will be escaped, but the direction will not.
   * @param  {Number}                    [options.limit]
   * @param  {Number}                    [options.offset]
   * @param  {Object}                    [queryOptions] Set the query options, e.g. raw, specifying that you want raw data instead of built Instances. See sequelize.query for options
   * @param  {Transaction}               [queryOptions.transaction]
   * @param  {String}                    [queryOptions.lock] Lock the selected rows in either share or update mode. Possible options are transaction.LOCK.UPDATE and transaction.LOCK.SHARE. See [transaction.LOCK for an example](https://github.com/sequelize/sequelize/wiki/API-Reference-Transaction#LOCK)
   *
   * @see    {Sequelize#query}
   * @return {Promise<Array<Instance>>}
   * @alias all
   */
  Model.prototype.findAll = function(options, queryOptions) {
    var hasJoin = false
      , tableNames  = { }

    tableNames[this.tableName] = true

    options = optClone(options || {})
    if (typeof options === 'object') {
      if (options.hasOwnProperty('include') && options.include) {
        hasJoin = true

        validateIncludedElements.call(this, options, tableNames)

        if (options.attributes) {
          if (options.attributes.indexOf(this.primaryKeyAttribute) === -1) {
            options.originalAttributes = options.attributes;
            options.attributes =  [this.primaryKeyAttribute].concat(options.attributes);
          }
        }
      }

      // whereCollection is used for non-primary key updates
      this.options.whereCollection = options.where || null
    }

    if (options.attributes === undefined) {
      options.attributes = Object.keys(this.rawAttributes);
    }
    mapFieldNames.call(this, options, this)

    options = paranoidClause.call(this, options)

    return this.QueryInterface.select(this, this.getTableName(), options, Utils._.defaults({
      type:    QueryTypes.SELECT,
      hasJoin: hasJoin,
      tableNames: Object.keys(tableNames)
    }, queryOptions, { transaction: (options || {}).transaction }))
  }

  //right now, the caller (has-many-double-linked) is in charge of the where clause
  Model.prototype.findAllJoin = function(joinTableName, options, queryOptions) {
    var optcpy = Utils._.clone(options)
    optcpy.attributes = optcpy.attributes || [this.QueryInterface.quoteTable(this.name)+".*"]
    // whereCollection is used for non-primary key updates
    this.options.whereCollection = optcpy.where || null;

    return this.QueryInterface.select(this, [[this.getTableName(), this.name], joinTableName], optcpy, Utils._.defaults({
      type: QueryTypes.SELECT
    }, queryOptions, { transaction: (options || {}).transaction }))
  }

 /**
  * Search for a single instance. This applies LIMIT 1, so the listener will always be called with a single instance.
  *
  * @param  {Object|Number}             [options] A hash of options to describe the scope of the search, or a number to search by id.
  * @param  {Object}                    [queryOptions]
  * 
  * @see {Model#findAll}           for an explanation of options and queryOptions
  * @return {Promise<Instance>}
  */
  Model.prototype.find = function(options, queryOptions) {
    var hasJoin = false

    // no options defined?
    // return an emitter which emits null
    if ([null, undefined].indexOf(options) !== -1) {
      return Utils.Promise.resolve(null)
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

    if (options.attributes === undefined) {
      options.attributes = Object.keys(this.rawAttributes);
    }
    mapFieldNames.call(this, options, this)

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

  /**
   * Run an aggregation method on the specified field
   * 
   * @param {String}          field The field to aggregate over. Can be a field name or *
   * @param {String}          aggregateFunction The function to use for aggregation, e.g. sum, max etc.
   * @param {Object}          [options] Query options. See sequelize.query for full options
   * @param {DataType|String} [options.dataType] The type of the result. If `field` is a field in this Model, the default will be the type of that field, otherwise defaults to float.
   *
   * @return {Promise<options.dataType>}
   */
  Model.prototype.aggregate = function(field, aggregateFunction, options) {
    options = Utils._.extend({ attributes: [] }, options || {})

    options.attributes.push([this.sequelize.fn(aggregateFunction, this.sequelize.col(field)), aggregateFunction])
    
    if (!options.dataType) {
      if (this.rawAttributes[field]) {
        options.dataType = this.rawAttributes[field]
      } else {
        // Use FLOAT as fallback
        options.dataType = DataTypes.FLOAT
      }
    }

    options = paranoidClause.call(this, options)

    return this.QueryInterface.rawSelect(this.getTableName(), options, aggregateFunction, this)
  }

  /**
   * Count the number of records matching the provided where clause.
   *
   * If you provide an `include` option, the number of matching associations will be counted instead.
   *
   * @param {Object}  [options]
   * @param {Object}  [options.include] Include options. See `find` for details
   *
   * @return {Promise<Integer>}
   */
  Model.prototype.count = function(options) {
    options = Utils._.clone(options || {})

    var col = '*'
    if (options.include) {
      col = this.name+'.'+this.primaryKeyAttribute
      validateIncludedElements.call(this, options)
    }

    options.dataType = DataTypes.INTEGER
    options.includeIgnoreAttributes = false
    options.limit = null

    return this.aggregate(col, 'COUNT', options)
  }

  /**
   * Find all the rows matching your query, within a specified offset / limit, and get the total number of rows matching your query. This is very usefull for paging
   * 
   * ```js
   * Model.findAndCountAll({
   *   where: ...,
   *   limit: 12,
   *   offset: 12
   * }).success(function (result) {
   * })
   * ```
   * In the above example, `result.rows` will contain rows 13 through 24, while `result.count` will return the total number of rows that matched your query.
   *
   * @param {Object} [findOptions] See findAll
   * @param {Object} [queryOptions] See Sequelize.query
   *
   * @see {Model#findAll} for a specification of find and query options 
   * @return {Promise<Object>}
   */
  Model.prototype.findAndCountAll = function(findOptions, queryOptions) {
    var self  = this
      // no limit, offset, order, attributes for the options given to count()
      , countOptions = Utils._.omit(findOptions ? Utils._.merge({}, findOptions) : {}, ['offset', 'limit', 'order', 'attributes'])

    return self.count(countOptions).then(function (count) {
      if (count === 0) {
        return {
          count: count || 0,
          rows: []
        }
      }
      return self.findAll(findOptions, queryOptions).then(function (results) {
        return {
          count: count || 0,
          rows: (results && Array.isArray(results) ? results : [])
        }
      })
    })
  }

  /**
   * Find the maximum value of field
   *
   * @param {String} field
   * @param {Object} [options] See aggregate
   * @see {Model#aggregate} for options
   *
   * @return {Promise<Any>}
   */
  Model.prototype.max = function(field, options) {
    return this.aggregate(field, 'max', options)
  }

  /**
   * Find the minimum value of field
   *
   * @param {String} field
   * @param {Object} [options] See aggregate
   * @see {Model#aggregate} for options
   *
   * @return {Promise<Any>}
   */
  Model.prototype.min = function(field, options) {
    return this.aggregate(field, 'min', options)
  }

  /**
   * Find the sum of field
   *
   * @param {String} field
   * @param {Object} [options] See aggregate
   * @see {Model#aggregate} for options
   *
   * @return {Promise<Number>}
   */
  Model.prototype.sum = function(field, options) {
    return this.aggregate(field, 'sum', options)
  }

  /**
   * Builds a new model instance. Values is an object of key value pairs, must be defined but can be empty.
    
   * @param {Object}  values
   * @param {Object}  [options]
   * @param {Boolean} [options.raw=false] If set to true, values will ignore field and virtual setters.
   * @param {Boolean} [options.isNewRecord=true]
   * @param {Boolean} [options.isDirty=true]
   * @param {Array}   [options.include] an array of include options - Used to build prefetched/included model instances. See `set`
   *
   * @return {Instance}    
   */
  Model.prototype.build = function(values, options) {
    if (Array.isArray(values)) {
      return this.bulkBuild(values, options)
    }
    options = options || { isNewRecord: true, isDirty: true }

    if (options.attributes) {
      options.attributes = options.attributes.map(function (attribute) {
        return Array.isArray(attribute) ? attribute[1] : attribute
      })
    }

    if (options.hasOwnProperty('include') && options.include && !options.includeValidated) {
      validateIncludedElements.call(this, options)
    }

    return new this.Instance(values, options)
  }


  Model.prototype.bulkBuild = function(valueSets, options) {
    options = options || { isNewRecord: true, isDirty: true }
    
    if (options.hasOwnProperty('include') && options.include && !options.includeValidated) {
      validateIncludedElements.call(this, options)
    }

    if (options.attributes) {
      options.attributes = options.attributes.map(function (attribute) {
        return Array.isArray(attribute) ? attribute[1] : attribute
      })
    }

    return valueSets.map(function (values) {
      return this.build(values, options)
    }.bind(this))
  }

  /**
   * Builds a new model instance and calls save on it.
    
   * @see {Instance#build}
   * @see {Instance#save}
   * 
   * @param {Object}        values
   * @param {Object}        [options]
   * @param {Boolean}       [options.raw=false] If set to true, values will ignore field and virtual setters.
   * @param {Boolean}       [options.isNewRecord=true]
   * @param {Boolean}       [options.isDirty=true]
   * @param {Array}         [options.fields] If set, only columns matching those in fields will be saved
   * @param {Array}         [options.include] an array of include options - Used to build prefetched/included model instances
   * @param {Transaction}   [options.transaction]
   *
   * @return {Promise<Instance>}
   */  
  Model.prototype.create = function(values, options) {
    Utils.validateParameter(values, Object, { optional: true })
    Utils.validateParameter(options, Object, { deprecated: Array, optional: true, index: 2, method: 'Model#create' })
    if (options instanceof Array) {
      options = { fields: options }
    }

    options = Utils._.extend({
      transaction: null
    }, options || {})

    return this.build(values, {
      isNewRecord: true,
      attributes: options.fields
    }).save(options)
  }

  /**
   * Find a row that matches the query, or build (but don't save) the row if none is found.
   * The successfull result of the promise will be (instance, initialized) - Make sure to use .spread()
   *
   * @param {Object}  where A hash of search attributes. Note that this method differs from finders, in that the syntax is `{ attr1: 42 }` and NOT `{ where: { attr1: 42}}`. This may be subject to change in 2.0
   * @param {Object}  [defaults] Default values to use if building a new instance
   * @param {Object}  [options] Options passed to the find call
   * @deprecated The syntax is due for change, in order to make `where` more consistent with the rest of the API
   *
   * @return {Promise<Instance>}
   * @method
   * @alias findOrBuild
   */
  Model.prototype.findOrInitialize = Model.prototype.findOrBuild = function (params, defaults, options) {
    defaults = defaults || {}
    options  = options  || {}

    var self          = this
      , defaultKeys   = Object.keys(defaults)
      , defaultLength = defaultKeys.length

    if (!options.transaction && defaults.transaction && (defaults.transaction instanceof Transaction)) {
      options.transaction = defaults.transaction
      delete defaults.transaction
    }

    return self.find({
      where: params
    }, options).then(function (instance) {
      if (instance === null) {
        var i = 0

        for (i = 0; i < defaultLength; i++) {
          params[defaultKeys[i]] = defaults[defaultKeys[i]]
        }

        var build = self.build(params)

        return build.hookValidate({skip: Object.keys(params)}).then(function () {
          return Utils.Promise.resolve([build, true])
        })
      }

      return Utils.Promise.resolve([instance, false])
    })
  }

  /**
   * Find a row that matches the query, or build and save the row if none is found
   * The successfull result of the promise will be (instance, created) - Make sure to use .spread()
   *
   * @param {Object}  where A hash of search attributes. Note that this method differs from finders, in that the syntax is `{ attr1: 42 }` and NOT `{ where: { attr1: 42}}`. This is subject to change in 2.0
   * @param {Object}  [defaults] Default values to use if creating a new instance
   * @param {Object}  [options] Options passed to the find and create calls
   * @deprecated The syntax is due for change, in order to make `where` more consistent with the rest of the API
   *
   * @return {Promise<Instance>}
   */
  Model.prototype.findOrCreate = function (where, defaults, options) {
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

    return self.find({
      where: where
    }, {
      transaction: options.transaction
    }).then(function (instance) {
      if (instance === null) {
        for (var attrname in defaults) {
          values[attrname] = defaults[attrname]
        }

        return self.create(values, options).then(function (instance) {
          return Utils.Promise.resolve([instance, true])
        });
      }

      return Utils.Promise.resolve([instance, false])
    })
  }

  /**
   * Create and insert multiple instances in bulk.
   *
   * The success handler is passed an array of instances, but please notice that these may not completely represent the state of the rows in the DB. This is because MySQL
   * and SQLite do not make it easy to obtain back automatically generated IDs and other default values in a way that can be mapped to multiple records.
   * To obtain Instances for the newly created values, you will need to query for them again. 
   *
   * @param  {Array}        records List of objects (key/value pairs) to create instances from
   * @param  {Object}       [options]
   * @param  {Array}        [options.fields] Fields to insert (defaults to all fields)
   * @param  {Boolean}      [options.validate=false] Should each row be subject to validation before it is inserted. The whole insert will fail if one row fails validation
   * @param  {Boolean}      [options.hooks=false] Run before / after create hooks for each individual Instance? BulkCreate hooks will still be run.
   * @param  {Boolean}      [options.ignoreDuplicates=false] Ignore duplicate values for primary keys? (not supported by postgres)
   * 
   * @return {Promise<Array<Instance>>}
   */
  Model.prototype.bulkCreate = function(records, fieldsOrOptions, options) {
    Utils.validateParameter(fieldsOrOptions, Object, { deprecated: Array, optional: true, index: 2, method: 'Model#bulkCreate' })
    Utils.validateParameter(options, 'undefined', { deprecated: Object, optional: true, index: 3, method: 'Model#bulkCreate' })

    if (!records.length) {
      return new Utils.Promise(function(resolve) {
        resolve([])
      })
    }

    options = Utils._.extend({
      validate: false,
      hooks: false,
      ignoreDuplicates: false
    }, options || {})

    if (fieldsOrOptions instanceof Array) {
      options.fields = fieldsOrOptions
    } else {
      options.fields = options.fields || Object.keys(this.attributes)
      options = Utils._.extend(options, fieldsOrOptions)
    }

    if (this.sequelize.options.dialect === 'postgres' && options.ignoreDuplicates) {
      return Utils.Promise.reject(new Error('Postgres does not support the \'ignoreDuplicates\' option.'))
    }

    var self          = this
      , updatedAtAttr = this._timestampAttributes.updatedAt
      , createdAtAttr = this._timestampAttributes.createdAt
      , errors        = []
      , daoPromises   = []
      , daos          = records.map(function(values) {
        return self.build(values, {
          isNewRecord: true
        })
      })

    if (options.validate && options.fields.length) {
      var skippedFields = Utils._.difference(Object.keys(self.attributes), options.fields)
    }

    var runAfterCreate = function() {
      return self.runHooks('afterBulkCreate', daos, options.fields).spread(function(newRecords) {
        return new Promise.resolve(newRecords || daos)
      })
    }

    return self.runHooks('beforeBulkCreate', daos, options.fields).spread(function(newRecords, newFields) {
      daos           = newRecords || daos
      options.fields = newFields  || options.fields

      var runHook = function (dao) {
        if (options.hooks === false) {
          var values = options.fields.length > 0 ? {} : dao.dataValues

          options.fields.forEach(function(field) {
            values[field] = dao.dataValues[field]
          })

          if (createdAtAttr && !values[createdAtAttr]) {
            values[createdAtAttr] = Utils.now(self.modelManager.sequelize.options.dialect)
          }

          if (updatedAtAttr && !values[updatedAtAttr]) {
            values[updatedAtAttr] = Utils.now(self.modelManager.sequelize.options.dialect)
          }

          records.push(values)

          return values
        }
        
        return dao.save({ transaction: options.transaction  })
      }

      var runValidation = function (dao) {
        if (options.validate === false) {
          return dao
        }

        var fn = options.hooks === true ? 'hookValidate' : 'validate'
        return dao[fn]({skip: skippedFields}).then(function (err) {
          if (!!err) {
            errors.push({record: dao, errors: err})
          }
        })
      }

      records = []
      daos.forEach(function (dao) {
        daoPromises.push(runValidation(dao))
        daoPromises.push(runHook(dao))
      })

      return Promise.all(daoPromises).then(function() {
        if (errors.length) {
          // Validation or hooks failed
          return Promise.reject(errors)
        } else if (records.length) {
          // Map field names
          records.forEach(function (values) {
            for (var attr in values) {
              if (values.hasOwnProperty(attr)) {
                if (self.rawAttributes[attr].field) {
                  values[self.rawAttributes[attr].field] = values[attr];
                  delete values[attr];
                }
              }
            }
          })

          // Insert all records at once
          return self.QueryInterface.bulkInsert(self.getTableName(), records, options, self).then(runAfterCreate)
        } else {
          // Records were already saved while running create / update hooks
          return runAfterCreate()
        }
      })
    })
  }

  /**
   * Delete multiple instances
   *
   * @param  {Object}   [where]             Options to describe the scope of the search.
   * @param  {Object}   [options]
   * @param  {Boolean}  [options.hooks]     If set to true, destroy will find all records within the where parameter and will execute before-/ after bulkDestroy hooks on each row
   * @param  {Number}   [options.limit]     How many rows to delete
   * @param  {Boolean}  [options.truncate]  If set to true, dialects that support it will use TRUNCATE instead of DELETE FROM. If a table is truncated the where and limit options are ignored
   *
   * @return {Promise<undefined>}
   */
  Model.prototype.destroy = function(where, options) {
    options = options || {}
    options.force = options.force === undefined ? false : Boolean(options.force)
    options.type = QueryTypes.BULKDELETE

    var self  = this
      , query = null
      , args  = []

    return self.runHooks(self.options.hooks.beforeBulkDestroy, where).then(function(newWhere) {
      where = newWhere || where

      if (self._timestampAttributes.deletedAt && options.force === false) {
        var attrValueHash = {}
        attrValueHash[self._timestampAttributes.deletedAt] = Utils.now()
        query = 'bulkUpdate'
        args  = [self.getTableName(), attrValueHash, where, self]
      } else {
        query = 'bulkDelete'
        args  = [self.getTableName(), where, options, self]
      }

      var runQuery = function(records) {
        return self.QueryInterface[query].apply(self.QueryInterface, args).then(function(results) {
          if (options && options.hooks === true) {
            var tick = 0
            var next = function(i) {
              return self.runHooks(self.options.hooks.afterDestroy, records[i]).then(function(newValues) {
                records[i].dataValues = !!newValues ? newValues.dataValues : records[i].dataValues
                tick++

                if (tick >= records.length) {
                  return self.runHooks(self.options.hooks.afterBulkDestroy, where).return(results)
                }

                return next(tick)
              })
            }

            return next(tick)
          } else {
            return self.runHooks(self.options.hooks.afterBulkDestroy, where).return(results)
          }
        })
      }

      if (options && options.hooks === true) {
        var tick = 0
        return self.all({where: where}).then(function(records) {
          var next = function(i) {
            return self.runHooks(self.options.hooks.beforeDestroy, records[i]).then(function(newValues) {
              records[i].dataValues = !!newValues ? newValues.dataValues : records[i].dataValues
              tick++

              if (tick >= records.length) {
                return runQuery(records)
              }

              return next(tick)
            })
          }

          return next(tick)
        })
      } else {
        return runQuery()
      }
    })
  }

  /**
   * Update multiple instances that match the where options.
   *
   * @param  {Object}   attrValueHash           A hash of fields to change and their new values
   * @param  {Object    where                   Options to describe the scope of the search. Note that these options are not wrapped in a { where: ... } is in find / findAll calls etc. This is probably due to change in 2.0
   * @param  {Object}   [options]       
   * @param  {Boolean}  [options.validate=true] Should each row be subject to validation before it is inserted. The whole insert will fail if one row fails validation
   * @param  {Boolean}  [options.hooks=false]   Run before / after bulkUpdate hooks?
   * @param  {Number}   [options.limit]         How many rows to update (only for mysql and mariadb)
   * @deprecated The syntax is due for change, in order to make `where` more consistent with the rest of the API
   *
   * @return {Promise}
   */
  Model.prototype.update = function(attrValueHash, where, options) {
    var self  = this
      , tick  = 0

    options = options || {}
    options.validate  = options.validate === undefined ? true : Boolean(options.validate)
    options.hooks     = options.hooks === undefined ? false : Boolean(options.hooks)
    options.type      = QueryTypes.BULKUPDATE

    if (self._timestampAttributes.updatedAt) {
      attrValueHash[self._timestampAttributes.updatedAt] = Utils.now()
    }

    var runSave = function() {
      return self.runHooks(self.options.hooks.beforeBulkUpdate, attrValueHash, where).spread(function(attributes, _where) {
        where         = _where || where
        attrValueHash = attributes || attrValueHash

        var runQuery = function(records) {
          return self.QueryInterface.bulkUpdate(self.getTableName(), attrValueHash, where, options, self.rawAttributes).then(function(results) {
            if (options && options.hooks === true && !!records && records.length > 0) {
              var tick = 0
              var next = function(i) {
                return self.runHooks(self.options.hooks.afterUpdate, records[i]).then(function(newValues) {
                  records[i].dataValues = (!!newValues && newValues.dataValues) ? newValues.dataValues : records[i].dataValues
                  tick++

                  if (tick >= records.length) {
                    return self.runHooks(self.options.hooks.afterBulkUpdate, attrValueHash, where).return(records)
                  }

                  return next(tick)
                })
              }

              return next(tick)
            } else {
              return self.runHooks(self.options.hooks.afterBulkUpdate, attrValueHash, where).return(results)
            }
          })
        }

        if (options.hooks === true) {
          return self.all({where: where}).then(function(records) {
            if (records === null || records.length < 1) {
              return runQuery()
            }

            var next = function(i) {
              return self.runHooks(self.options.hooks.beforeUpdate, records[i]).then(function(newValues) {
                records[i].dataValues = (!!newValues && newValues.dataValues) ? newValues.dataValues : records[i].dataValues
                tick++

                if (tick >= records.length) {
                  return runQuery(records)
                }

                return next(tick)
              })
            }

            return next(tick)
          })
        } else {
          return runQuery()
        }
      })
    }

    if (options.validate === true) {
      var build = self.build(attrValueHash)

      // We want to skip validations for all other fields
      var updatedFields = Object.keys(attrValueHash)
      var skippedFields = Utils._.difference(Object.keys(self.attributes), updatedFields)

      return build.hookValidate({skip: skippedFields}).then(function(attributes) {
        if (!!attributes && !!attributes.dataValues) {
          attrValueHash = Utils._.pick.apply(Utils._, [].concat(attributes.dataValues).concat(Object.keys(attrValueHash)))
        }

        return runSave()
      })
    } else {
      return runSave()
    }
  }

  /**
   * Run a describe query on the table. The result will be return to the listener as a hash of attributes and their types.
   * 
   * @return {Promise}
   */
  Model.prototype.describe = function(schema) {
    return this.QueryInterface.describeTable(this.tableName, schema || this.options.schema || undefined)
  }

  /**
   * A proxy to the node-sql query builder, which allows you to build your query through a chain of method calls. 
   * The returned instance already has all the fields property populated with the field of the model.
   * 
   * @see https://github.com/brianc/node-sql
   * @return {node-sql} A node-sql instance
   */
  Model.prototype.dataset = function() {
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

  Model.prototype.__setSqlDialect = function() {
    var dialect = this.modelManager.sequelize.options.dialect
    this.__sql = sql.setDialect(dialect === 'mariadb' ? 'mysql' : dialect)
  }

  var mapFieldNames = function(options, Model) {
    if (options.attributes) {
      options.attributes = options.attributes.map(function (attr) {
        if (Model.rawAttributes[attr] && Model.rawAttributes[attr].field) {
          return [Model.rawAttributes[attr].field, attr];
        }
        return attr;
      });
    }

    if (options.where) {
      for (var attr in options.where) {
        if (Model.rawAttributes[attr] && Model.rawAttributes[attr].field) {
          options.where[Model.rawAttributes[attr].field] = options.where[attr];
          delete options.where[attr];
        }
      }
    }
    return options
  }

  // private

  var paranoidClause = function ( options ) {
    if ( ! this.options.paranoid ) return options || {};

    options = options || {}
    options.where = options.where || {}

    // Apply on each include
    // This should be handled before handling where conditions because of logic with returns
    // otherwise this code will never run on includes of a already conditionable where
    if ( options.include && options.include.length ) {
      options.include.forEach(function(include) {
        if( typeof include == 'object' && include.model ){
          paranoidClause.call( include.model, include )
        }
      })
    }

    var deletedAtCol = this._timestampAttributes.deletedAt
      , quoteIdentifiedDeletedAtCol = this.QueryInterface.quoteIdentifier(deletedAtCol)

    // Don't overwrite our explicit deletedAt search value if we provide one
    if (!!options.where[deletedAtCol]) {
      return options
    }

    if(this.name || this.tableName) {
      quoteIdentifiedDeletedAtCol = this.QueryInterface.quoteIdentifier(this.name || this.tableName) + '.' + quoteIdentifiedDeletedAtCol
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

    return options;
  }

  var addOptionalClassMethods = function() {
    var self = this
    Utils._.each(this.options.classMethods || {}, function(fct, name) { self[name] = fct })
  }

  var addDefaultAttributes = function() {
    var self              = this
      , tail = {}
      , head = {}

    // Add id if no primary key was manually added to definition
    if (!Object.keys(this.primaryKeys).length) {
      head = {
        id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true,
          _autoGenerated: true
        }
      }
    }

    if (this._timestampAttributes.createdAt) {
      tail[this._timestampAttributes.createdAt] = {
        type: DataTypes.DATE,
        allowNull: false,
        _autoGenerated: true
      }
    }
    if (this._timestampAttributes.updatedAt) {
      tail[this._timestampAttributes.updatedAt] = {
        type: DataTypes.DATE,
        allowNull: false,
        _autoGenerated: true
      }
    }
    if (this._timestampAttributes.deletedAt) {
      tail[this._timestampAttributes.deletedAt] = {
        type: DataTypes.DATE,
        autoGenerated: true
      }
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

    if (!Object.keys(this.primaryKeys).length) {
      self.primaryKeys.id = self.rawAttributes.id
    }
  }

  var findAutoIncrementField = function() {
    var fields = this.QueryGenerator.findAutoIncrementField(this)

    this.autoIncrementField = null

    fields.forEach(function(field) {
      if (this.autoIncrementField) {
        throw new Error('Invalid Instance definition. Only one autoincrement field allowed.')
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

    // convert all included elements to { Model: Model } form
    var includes = options.include = options.include.map(function(include) {
      if (include instanceof Model) {
        include = { model: include }
      } else if (typeof include !== 'object') {
        throw new Error('Include unexpected. Element has to be either an instance of Model or an object.')
      } else if (include.hasOwnProperty('daoFactory')) {
        include.model = include.daoFactory
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
      options.includeMap[include.as.substr(0,1).toLowerCase() + include.as.substr(1)] = include
      options.includeNames.push(include.as)
      options.includeNames.push(include.as.substr(0,1).toLowerCase() + include.as.substr(1))

      if (include.association.isMultiAssociation || include.hasMultiAssociation) {
        options.hasMultiAssociation = true
      }
      if (include.association.isSingleAssociation || include.hasSingleAssociation) {
        options.hasSingleAssociation = true
      }

      options.hasIncludeWhere = options.hasIncludeWhere || include.hasIncludeWhere || !!include.where
      options.hasIncludeRequired = options.hasIncludeRequired || include.hasIncludeRequired || !!include.required
    }
  }
  Model.$validateIncludedElements = validateIncludedElements;

  var validateIncludedElement = function(include, tableNames) {
    if (!include.hasOwnProperty('model')) {
      throw new Error('Include malformed. Expected attributes: model')
    }

    tableNames[include.model.tableName] = true

    if (include.hasOwnProperty('attributes')) {
      include.originalAttributes = include.attributes.slice(0);
      include.model.primaryKeyAttributes.forEach(function (attr) {
        if (include.attributes.indexOf(attr) === -1) {
          include.attributes.unshift(attr);
        }
      });
    } else {
      include.attributes = Object.keys(include.model.attributes)
    }

    include = mapFieldNames(include, include.model);

    // pseudo include just needed the attribute logic, return
    if (include._pseudo) {
      return include
    }

    // check if the current Model is actually associated with the passed Model - or it's a pseudo include
    var association = this.getAssociation(include.model, include.as)
    if (association) {
      include.association = association
      include.as = association.as

      // If through, we create a pseudo child include, to ease our parsing later on
      if (Object(include.association.through) === include.association.through) {
        if (!include.include) include.include = []
        var through = include.association.through

        include.through = Utils._.defaults(include.through || {}, {
          model: through,
          as: Utils.singularize(through.tableName, through.options.language),
          association: {
            isSingleAssociation: true
          },
          _pseudo: true
        })

        include.include.push(include.through)
        tableNames[through.tableName] = true
      }

      if (include.required === undefined) {
        include.required = !!include.where
      }

      // Validate child includes
      if (include.hasOwnProperty('include')) {
        validateIncludedElements.call(include.model, include, tableNames)
      }

      return include
    } else {
      var msg = include.model.name

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
        if (Utils._.find(includes, {model: model, as: as})) {
          return
        }

        // skip if recursing over a model already nested
        if (nested && used.indexOf(model) != -1) {
          return
        }

        // include this model
        var thisInclude = optClone(include)
        thisInclude.model = model
        if (as) {
          thisInclude.as = as
        }
        includes.push(thisInclude)

        // run recursively if nested
        if (nested) {
          addAllIncludes(model, thisInclude.include)
          if (thisInclude.include.length == 0) delete thisInclude.include
        }
      })
      used.pop()
    })(this, includes)
  }

  var optClone = function (options) {
    return Utils._.cloneDeep(options, function (elem) {
      // The InstanceFactories used for include are pass by ref, so don't clone them.
      if (elem && 
        (
          elem._isSequelizeMethod ||
          elem instanceof Model || 
          elem instanceof Transaction
        )
      ) {
        return elem
      }
      // Unfortunately, lodash.cloneDeep doesn't preserve Buffer.isBuffer, which we have to rely on for binary data
      if (Buffer.isBuffer(elem)) { return elem; }

      // Otherwise return undefined, meaning, 'handle this lodash'
      return undefined
    })
  }

  Utils._.extend(Model.prototype, require("./associations/mixin"))
  Utils._.extend(Model.prototype, require(__dirname + '/hooks'))

  return Model
})()
