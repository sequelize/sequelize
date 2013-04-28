var Utils     = require("./utils")
  , DAO       = require("./dao")
  , DataTypes = require("./data-types")
  , Util      = require('util')

module.exports = (function() {
  var DAOFactory = function(name, attributes, options) {
    var self = this

    this.options = Utils._.extend({
      timestamps: true,
      instanceMethods: {},
      classMethods: {},
      validate: {},
      freezeTableName: false,
      underscored: false,
      syncOnAssociation: true,
      paranoid: false,
      whereCollection: null,
      schema: null,
      schemaDelimiter: ''
    }, options || {})

    this.name = name
    if (!this.options.tableName) {
      this.tableName = this.options.freezeTableName ? name : Utils.pluralize(name)
    } else {
      this.tableName = this.options.tableName
    }
    this.rawAttributes = attributes
    this.daoFactoryManager = null // defined in init function
    this.associations = {}

    // extract validation
    this.validate = this.options.validate || {}
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

  DAOFactory.prototype.init = function(daoFactoryManager) {
    var self = this;

    this.daoFactoryManager = daoFactoryManager

    this.primaryKeys = {};
    Utils._.each(this.attributes, function(dataTypeString, attributeName) {
      if ((attributeName !== 'id') && (dataTypeString.indexOf('PRIMARY KEY') !== -1)) {
        self.primaryKeys[attributeName] = dataTypeString
      }
    })

    this.primaryKeyCount = Object.keys(this.primaryKeys).length;
    this.options.hasPrimaryKeys = this.hasPrimaryKeys = this.primaryKeyCount > 0;

    addDefaultAttributes.call(this)
    addOptionalClassMethods.call(this)
    findAutoIncrementField.call(this)

    // DAO prototype
    this.DAO = function() {
      DAO.apply(this, arguments);
    };
    Util.inherits(this.DAO, DAO);

    this.DAO.prototype.rawAttributes = this.rawAttributes;
    if (this.options.instanceMethods) {
      Utils._.each(this.options.instanceMethods, function(fct, name) {
        self.DAO.prototype[name] = fct
      })
    }
    this.DAO.prototype.attributes = Object.keys(this.DAO.prototype.rawAttributes);

    this.DAO.prototype.booleanValues = [];
    this.DAO.prototype.defaultValues = {};
    this.DAO.prototype.validators = {};
    Utils._.each(this.rawAttributes, function (definition, name) {
      if (((definition === DataTypes.BOOLEAN) || (definition.type === DataTypes.BOOLEAN))) {
        self.DAO.prototype.booleanValues.push(name);
      }
      if (definition.hasOwnProperty('defaultValue')) {
        self.DAO.prototype.defaultValues[name] = function() {
          return Utils.toDefaultValue(definition.defaultValue);
        }
      }

      if (definition.hasOwnProperty('validate')) {
        self.DAO.prototype.validators[name] = definition.validate;
      }
    });

    this.DAO.prototype.__factory = this;
    this.DAO.prototype.hasDefaultValues = !Utils._.isEmpty(this.DAO.prototype.defaultValues);

    return this
  }

  DAOFactory.prototype.sync = function(options) {
    options = Utils._.extend({}, this.options, options || {})

    var self = this
    return new Utils.CustomEventEmitter(function(emitter) {
      var doQuery = function() {
        self.QueryInterface
          .createTable(self.getTableName(), self.attributes, options)
          .success(function() { emitter.emit('success', self) })
          .error(function(err) { emitter.emit('error', err) })
          .on('sql', function(sql) { emitter.emit('sql', sql) })
      }

      if (options.force) {
        self.drop().success(doQuery).error(function(err) { emitter.emit('error', err) })
      } else {
        doQuery()
      }
    }).run()
  }

  DAOFactory.prototype.drop = function() {
    return this.QueryInterface.dropTable(this.tableName)
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

  // alias for findAll
  DAOFactory.prototype.all = function(options) {
    return this.findAll(options)
  }

  DAOFactory.prototype.findAll = function(options) {
    var hasJoin = false
    var options = Utils._.clone(options)

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

    return this.QueryInterface.select(this, this.tableName, options, {
      type:    'SELECT',
      hasJoin: hasJoin
    })
  }

  //right now, the caller (has-many-double-linked) is in charge of the where clause
  DAOFactory.prototype.findAllJoin = function(joinTableName, options) {
    var optcpy = Utils._.clone(options)
    optcpy.attributes = optcpy.attributes || [Utils.addTicks(this.tableName)+".*"]

    // whereCollection is used for non-primary key updates
    this.options.whereCollection = optcpy.where || null;

    return this.QueryInterface.select(this, [this.getTableName(), joinTableName], optcpy, { type: 'SELECT' })
  }

 /**
  * Search for an instance.
  *
  * @param  {Object} options Options to describe the scope of the search.
  *   @param {Array} include A list of associations which shall get eagerly loaded. Supported is either { include: [ DaoFactory1, DaoFactory2, ...] } or { include: [ { daoFactory: DaoFactory1, as: 'Alias' } ] }.
  * @return {Object}         A promise which fires `success`, `error`, `complete` and `sql`.
  */
  DAOFactory.prototype.find = function(options) {
    var hasJoin = false

    // no options defined?
    // return an emitter which emits null
    if ([null, undefined].indexOf(options) !== -1) {
      return new Utils.CustomEventEmitter(function(emitter) {
        setTimeout(function() { emitter.emit('success', null) }, 10)
      }).run()
    }

    var primaryKeys = this.primaryKeys

    // options is not a hash but an id
    if (typeof options === 'number') {
      options = { where: options }
    } else if (Utils._.size(primaryKeys) && Utils.argsArePrimaryKeys(arguments, primaryKeys)) {
      var where = {}
        , self  = this
        , keys = Object.keys(primaryKeys)

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
    }

    options.limit = 1

    return this.QueryInterface.select(this, this.getTableName(), options, {
      plain: true,
      type: 'SELECT',
      hasJoin: hasJoin
    })
  }

  DAOFactory.prototype.count = function(options) {
    options = Utils._.extend({ attributes: [] }, options || {})
    options.attributes.push(['count(*)', 'count'])
    options.parseInt = true

    return this.QueryInterface.rawSelect(this.getTableName(), options, 'count')
  }

  DAOFactory.prototype.max = function(field, options) {
    options = Utils._.extend({ attributes: [] }, options || {})
    options.attributes.push(['max(' + field + ')', 'max'])
    options.parseInt = true

    return this.QueryInterface.rawSelect(this.getTableName(), options, 'max')
  }
  DAOFactory.prototype.min = function(field, options) {
    options = Utils._.extend({ attributes: [] }, options || {})
    options.attributes.push(['min(' + field + ')', 'min'])
    options.parseInt = true

    return this.QueryInterface.rawSelect(this.getTableName(), options, 'min')
  }

  DAOFactory.prototype.build = function(values, options) {
    options = options || { isNewRecord: true }

    var self     = this
      , instance = new this.DAO(values, this.options, options.isNewRecord)

    instance.isNewRecord    = options.isNewRecord
    instance.daoFactoryName = this.name
    instance.daoFactory     = this

    return instance
  }

  DAOFactory.prototype.create = function(values, fields) {
    return this.build(values).save(fields)
  }

  DAOFactory.prototype.findOrCreate = function (params, defaults) {
    var self = this;

    return new Utils.CustomEventEmitter(function (emitter) {
      self.find({
        where: params
      }).success(function (instance) {
        if (instance === null) {
          for (var attrname in defaults) {
            params[attrname] = defaults[attrname]
          }

          self.create(params)
            .success(function (instance) {
              emitter.emit('success', instance)
            })
            .error( function (error) {
              emitter.emit('error', error)
            })
        } else {
          emitter.emit('success', instance)
        }
      }).error(function (error) {
        emitter.emit('error', error)
      });
    }).run()
  }

  // private

  var query = function() {
    var args      = Utils._.map(arguments, function(arg, _) { return arg })
      , sequelize = this.daoFactoryManager.sequelize

    // add this as the second argument
    if (arguments.length === 1) {
      args.push(this)
    }

    // add {} as options
    if (args.length === 2) {
      args.push({})
    }

    return sequelize.query.apply(sequelize, args)
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
      defaultAttributes[Utils._.underscoredIf('createdAt', this.options.underscored)] = {type: DataTypes.DATE, allowNull: false}
      defaultAttributes[Utils._.underscoredIf('updatedAt', this.options.underscored)] = {type: DataTypes.DATE, allowNull: false}

      if (this.options.paranoid)
        defaultAttributes[Utils._.underscoredIf('deletedAt', this.options.underscored)] = {type: DataTypes.DATE}
    }

    Utils._.each(defaultAttributes, function(value, attr) {
      self.rawAttributes[attr] = value
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

  Utils._.extend(DAOFactory.prototype, require("./associations/mixin"))

  return DAOFactory
})()
