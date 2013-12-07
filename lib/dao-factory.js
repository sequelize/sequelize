var Utils       = require("./utils")
  , DAO         = require("./dao")
  , DataTypes   = require("./data-types")
  , Util        = require('util')
  , sql         = require('sql')
  , SqlString   = require('./sql-string')
  , Transaction = require('./transaction')

module.exports = (function() {
  var DAOFactory = function(name, attributes, options) {
    this.options = Utils._.extend({
      timestamps: true,
      createdAt: 'createdAt',
      updatedAt: 'updatedAt',
      deletedAt: 'deletedAt',
      touchedAt: 'touchedAt',
      instanceMethods: {},
      classMethods: {},
      validate: {},
      freezeTableName: false,
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
              type:        'SELECT'
            }, options || {})

            return self.QueryInterface.queryAndEmit([result.toSql(), self, options], 'snafu')
          }

          return result
        }
      })(methodName)
    }
  })()

  DAOFactory.prototype.init = function(daoFactoryManager) {
    var self = this;

    this.daoFactoryManager = daoFactoryManager
    this.primaryKeys       = {};

    Utils._.each(this.attributes, function(dataTypeString, attributeName) {
      if (dataTypeString.indexOf('PRIMARY KEY') !== -1) {
        self.primaryKeys[attributeName] = dataTypeString
      }
    })

    this.primaryKeyCount = Object.keys(this.primaryKeys).length;
    this.options.hasPrimaryKeys = this.hasPrimaryKeys = this.primaryKeyCount > 0;

    if (typeof this.options.defaultScope === "object") {
      Utils.injectScope.call(this, this.options.defaultScope)
    }

    addDefaultAttributes.call(this)
    addOptionalClassMethods.call(this)
    findAutoIncrementField.call(this)

    // DAO prototype
    // WTF ... ?
    this.DAO = function() {
      DAO.apply(this, arguments);
    }

    Util.inherits(this.DAO, DAO);

    this.DAO.prototype.rawAttributes = this.rawAttributes;

    if (this.options.instanceMethods) {
      Utils._.each(this.options.instanceMethods, function(fct, name) {
        self.DAO.prototype[name] = fct
      })
    }

    this.refreshAttributes();

    this.DAO.prototype.booleanValues = []
    this.DAO.prototype.defaultValues = {}
    this.DAO.prototype.validators    = {}

    Utils._.each(this.rawAttributes, function (definition, name) {
      if (((definition === DataTypes.BOOLEAN) || (definition.type === DataTypes.BOOLEAN))) {
        self.DAO.prototype.booleanValues.push(name);
      }
      if (definition.hasOwnProperty('defaultValue')) {
        self.DAO.prototype.defaultValues[name] = Utils._.partial(
          Utils.toDefaultValue, definition.defaultValue)
      }

      if (definition.hasOwnProperty('validate')) {
        self.DAO.prototype.validators[name] = definition.validate;
      }
    })

    this.DAO.prototype.__factory        = this
    this.DAO.prototype.hasDefaultValues = !Utils._.isEmpty(this.DAO.prototype.defaultValues)

    return this
  }

  DAOFactory.prototype.refreshAttributes = function() {
    var self = this
      , attributeManipulation = {};

    Utils._.each(['get', 'set'], function(type) {
      var opt   = type + 'terMethods'
        , funcs = Utils._.isObject(self.options[opt]) ? self.options[opt] : {}

      Utils._.each(self.rawAttributes, function(options, attribute) {
        if (options.hasOwnProperty(type)) {
          funcs[attribute] = options[type]
        } else if (typeof funcs[attribute] === "undefined") {
          if (type === 'get') {
            funcs[attribute] = function()  { return this.dataValues[attribute]; }
          }
          if (type === 'set') {
            funcs[attribute] = function(value) {
              if (Utils.hasChanged(this.dataValues[attribute], value)) {
                //Only dirty the object if the change is not due to id, touchedAt, createdAt or updatedAt being initiated
                var updatedAtAttr = Utils._.underscoredIf(this.__options.updatedAt, this.__options.underscored)
                  , createdAtAttr = Utils._.underscoredIf(this.__options.createdAt, this.__options.underscored)
                  , touchedAtAttr = Utils._.underscoredIf(this.__options.touchedAt, this.__options.underscored)

                if (this.dataValues[attribute] || (attribute != 'id' && attribute != touchedAtAttr && attribute != createdAtAttr && attribute != updatedAtAttr)) {
                  this.isDirty = true
                }
              }
              this.dataValues[attribute] = value
            }
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

    Object.defineProperties(this.DAO.prototype, attributeManipulation)
    this.DAO.prototype.attributes = Object.keys(this.DAO.prototype.rawAttributes)
  }

  DAOFactory.prototype.sync = function(options) {
    options = Utils._.extend({}, this.options, options || {})

    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      var doQuery = function() {
        self
          .QueryInterface
          .createTable(self.getTableName(), self.attributes, options)
          .success(function() { emitter.emit('success', self) })
          .error(function(err) { emitter.emit('error', err) })
          .on('sql', function(sql) { emitter.emit('sql', sql) })
      }

      if (options.force) {
        self
          .drop(options)
          .success(doQuery)
          .error(function(err) { emitter.emit('error', err) })
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

    options = optClone(options)
    if (typeof options === 'object') {
      if (options.hasOwnProperty('include')) {
        hasJoin = true

        options.include = options.include.map(function(include) {
          return validateIncludedElement.call(this, include)
        }.bind(this))
      }

      // whereCollection is used for non-primary key updates
      this.options.whereCollection = options.where || null
    }

    options = paranoidClause.call(this, options)

    return this.QueryInterface.select(this, this.tableName, options, Utils._.defaults({
      type:    'SELECT',
      hasJoin: hasJoin
    }, queryOptions, { transaction: (options || {}).transaction }))
  }

  //right now, the caller (has-many-double-linked) is in charge of the where clause
  DAOFactory.prototype.findAllJoin = function(joinTableName, options, queryOptions) {
    var optcpy = Utils._.clone(options)
    optcpy.attributes = optcpy.attributes || [this.QueryInterface.quoteIdentifier(this.tableName)+".*"]

    // whereCollection is used for non-primary key updates
    this.options.whereCollection = optcpy.where || null;

    return this.QueryInterface.select(this, [this.getTableName(), joinTableName], optcpy, Utils._.defaults({
      type: 'SELECT'
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
      options = Utils._.clone(options)

      if (options.hasOwnProperty('include')) {
        hasJoin = true

        options.include = options.include.map(function(include) {
          return validateIncludedElement.call(this, include)
        }.bind(this))
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
    options.limit = 1

    return this.QueryInterface.select(this, this.getTableName(), options, Utils._.defaults({
      plain: true,
      type: 'SELECT',
      hasJoin: hasJoin
    }, queryOptions))
  }

  DAOFactory.prototype.count = function(options) {
    options = Utils._.extend({ attributes: [] }, options || {})
    options.attributes.push(['count(*)', 'count'])
    options.parseInt = true

    options = paranoidClause.call(this, options)

    return this.QueryInterface.rawSelect(this.getTableName(), options, 'count')
  }

  DAOFactory.prototype.findAndCountAll = function(options) {
    var self  = this
      // no limit, offset, order, attributes or include for the options given to count()
      , copts = Utils._.omit(options || {}, ['offset', 'limit', 'order', 'include', 'attributes'])

    return new Utils.CustomEventEmitter(function (emitter) {
      var emit = {
          err  : function(e) {        // emit error
            emitter.emit('error', e);
          }
        , okay : function(c, r) {     // emit success
            emitter.emit('success', {
              count: c || 0,
              rows : (r && Array.isArray(r) ? r : [])
            });
          }
        , sql  : function(s) {        // emit SQL
            emitter.emit('sql', s);
          }
        }

      self.count(copts)
          .on('sql', emit.sql)
          .error(emit.err)
          .success(function(cnt) {
            if (cnt === 0) {
              return emit.okay(cnt) // no records, no need for another query
            }

            self.findAll(options)
                .on('sql', emit.sql)
                .error(emit.err)
                .success(function(rows) {
                  emit.okay(cnt, rows)
                })
          })

    }).run()
  }

  DAOFactory.prototype.max = function(field, options) {
    options = Utils._.extend({ attributes: [] }, options || {})
    options.attributes.push(['max(' + this.QueryInterface.QueryGenerator.quoteIdentifier(field) + ')', 'max'])
    options.parseFloat = true

    return this.QueryInterface.rawSelect(this.getTableName(), options, 'max')
  }
  DAOFactory.prototype.min = function(field, options) {
    options = Utils._.extend({ attributes: [] }, options || {})
    options.attributes.push(['min(' + this.QueryInterface.QueryGenerator.quoteIdentifier(field) + ')', 'min'])
    options.parseFloat = true

    return this.QueryInterface.rawSelect(this.getTableName(), options, 'min')
  }

  DAOFactory.prototype.build = function(values, options) {
    options = options || { isNewRecord: true, isDirty: true }

    var self     = this
      , instance = new this.DAO(values, this.options, options.isNewRecord)

    instance.isNewRecord    = options.isNewRecord
    instance.daoFactoryName = this.name
    instance.daoFactory     = this
    instance.isDirty        = options.isDirty

    return instance
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
      , params = {}

    options = Utils._.extend({
      transaction: null
    }, options || {})

    for (var attrname in where) {
      params[attrname] = where[attrname]
    }

    return new Utils.CustomEventEmitter(function (emitter) {
      self.find({
        where: params
      }, {
        transaction: options.transaction
      }).success(function (instance) {
        if (instance === null) {
          for (var attrname in defaults) {
            params[attrname] = defaults[attrname]
          }

          self
            .create(params, options)
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

    options = Utils._.extend({
      validate: false,
      hooks: false
    }, options || {})

    if (fieldsOrOptions instanceof Array) {
      options.fields = fieldsOrOptions
    } else {
      options.fields = options.fields || []
      options = Utils._.extend(options, fieldsOrOptions)
    }

    var self          = this
      , updatedAtAttr = Utils._.underscoredIf(self.options.updatedAt, self.options.underscored)
      , createdAtAttr = Utils._.underscoredIf(self.options.createdAt, self.options.underscored)
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

      var next = function(err) {
        if (err !== undefined && err !== null) {
          return emitter.emit('error', err)
        }

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

          if (self.options.timestamps) {
            if (!values[createdAtAttr]) {
              values[createdAtAttr] = Utils.now(self.daoFactoryManager.sequelize.options.dialect)
            }

            if (!values[updatedAtAttr]) {
              values[updatedAtAttr] = Utils.now(self.daoFactoryManager.sequelize.options.dialect)
            }
          }

          records.push(values)
        })

        self.QueryInterface.bulkInsert(self.tableName, records, options)
        .on('sql', function(sql) {
          emitter.emit('sql', sql)
        })
        .error(function(err) {
          emitter.emit('error', err)
        }).success(function() {
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
          if (options.hooks === true) {
            var iterate = function(i) {
              daos[i].hookValidate({skip: options.fields}).complete(function (err) {
                if (!!err) {
                  errors.push({record: v, errors: err})
                }

                i++
                if (i > daos.length) {
                  next(errors.length > 0 ? errors : null)
                }

                iterate(i)
              })
            }
          } else {
             var afterDaos = Utils._.after(daos.length, function() {
              next(errors.length > 0 ? errors : null)
            })

            daos.forEach(function(v) {
              v.validate({skip: options.fields}).success(function(err) {
                if (!!err) {
                  errors.push({record: v, errors: err})
                }
                afterDaos()
              })
            })
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
    var self  = this
      , query = null
      , args  = []

    return new Utils.CustomEventEmitter(function(emitter) {
      self.runHooks(self.options.hooks.beforeBulkDestroy, where, function(err, newWhere) {
        if (!!err) {
          return emitter.emit('error', err)
        }

        where = newWhere || where

        if (self.options.timestamps && self.options.paranoid) {
          var attr = Utils._.underscoredIf(self.options.deletedAt, self.options.underscored)
          var attrValueHash = {}
          attrValueHash[attr] = Utils.now()
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
                self.runHooks(self.options.hooks.afterDestroy, records[i], function(err, newValues) {
                  if (!!err) {
                    return finished(err)
                  }

                  records[i].dataValues = !!newValues ? newValues.dataValues : records[i].dataValues
                  tick++

                  if (tick >= records.length) {
                    return finished()
                  }

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
              self.runHooks(self.options.hooks.beforeDestroy, records[i], function(err, newValues) {
                if (!!err) {
                  return runQuery(err)
                }

                records[i].dataValues = !!newValues ? newValues.dataValues : records[i].dataValues
                tick++

                if (tick >= records.length) {
                  return runQuery(null, records)
                }

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

    if (self.options.timestamps) {
      var attr = Utils._.underscoredIf(self.options.updatedAt, self.options.underscored)
      attrValueHash[attr] = Utils.now()
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
                  self.runHooks(self.options.hooks.afterUpdate, records[i], function(err, newValues) {
                    if (!!err) {
                      return finished(err)
                    }

                    records[i].dataValues = !!newValues ? newValues.dataValues : records[i].dataValues
                    tick++

                    if (tick >= records.length) {
                      return finished(null, records)
                    }

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
                self.runHooks(self.options.hooks.beforeUpdate, records[i], function(err, newValues) {
                  if (!!err) {
                    return runQuery(err)
                  }

                  records[i].dataValues = !!newValues ? newValues.dataValues : records[i].dataValues
                  tick++

                  if (tick >= records.length) {
                    return runQuery(null, records)
                  }

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
        var build    = self.build(attrValueHash)
          , attrKeys = Object.keys(attrValueHash)

        build.hookValidate({
          skip: Object.keys(build.dataValues).filter(function(val) { return attrKeys.indexOf(val) !== -1 })
        }).error(function(err) {
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

      // Don't overwrite our explicit deletedAt search value if we provide one
      if (!!options.where[this.options.deletedAt]) {
        return options
      }

      if (typeof options.where === "string") {
        options.where += ' AND ' + this.QueryInterface.quoteIdentifier(this.options.deletedAt) + ' IS NULL '
      }
      else if (Array.isArray(options.where)) {
        options.where[0] += ' AND ' + this.QueryInterface.quoteIdentifier(this.options.deletedAt) + ' IS NULL '
      } else {
        options.where[this.options.deletedAt] = null
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
      , defaultAttributes = {
        id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          primaryKey: true,
          autoIncrement: true
        }
      }

    if (this.hasPrimaryKeys) {
      defaultAttributes = {}
    }

    if (this.options.timestamps) {
      defaultAttributes[Utils._.underscoredIf(this.options.createdAt, this.options.underscored)] = {type: DataTypes.DATE, allowNull: false}
      defaultAttributes[Utils._.underscoredIf(this.options.updatedAt, this.options.underscored)] = {type: DataTypes.DATE, allowNull: false}

      if (this.options.paranoid)
        defaultAttributes[Utils._.underscoredIf(this.options.deletedAt, this.options.underscored)] = {type: DataTypes.DATE}
    }

    Utils._.each(defaultAttributes, function(value, attr) {
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

  var validateIncludedElement = function(include) {
    if (include instanceof DAOFactory) {
      include = { daoFactory: include, as: include.tableName }
    }

    if (typeof include === 'object') {
      if (include.hasOwnProperty('model')) {
        include.daoFactory = include.model
        delete include.model
      }

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

      if (include.hasOwnProperty('daoFactory') && (include.hasOwnProperty('as'))) {
        var usesAlias   = (include.as !== include.daoFactory.tableName)
          , association = (usesAlias ? this.getAssociationByAlias(include.as) : this.getAssociation(include.daoFactory))

        // check if the current daoFactory is actually associated with the passed daoFactory
        if (!!association && (!association.options.as || (association.options.as === include.as))) {
          include.association = association

          return include
        } else {
          var msg = include.daoFactory.name

          if (usesAlias) {
            msg += " (" + include.as + ")"
          }

          msg += " is not associated to " + this.name + "!"

          throw new Error(msg)
        }
      } else {
        throw new Error('Include malformed. Expected attributes: daoFactory, as!')
      }
    } else {
      throw new Error('Include unexpected. Element has to be either an instance of DAOFactory or an object.')
    }
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
      // The DAOFactories used for include are pass by ref, so don't clone them. Otherwise return undefined, meaning, 'handle this lodash'
      return elem instanceof DAOFactory ? elem : undefined
    })
  }

  Utils._.extend(DAOFactory.prototype, require("./associations/mixin"))
  Utils._.extend(DAOFactory.prototype, require(__dirname + '/hooks'))

  return DAOFactory
})()
