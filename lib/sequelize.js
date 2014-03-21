var url                = require("url")
  , Path               = require("path")
  , Utils              = require("./utils")
  , DAOFactory         = require("./dao-factory")
  , DAOValidator       = require("./dao-validator")
  , DataTypes          = require('./data-types')
  , DAOFactoryManager  = require("./dao-factory-manager")
  , QueryInterface     = require("./query-interface")
  , Transaction        = require("./transaction")
  , TransactionManager = require('./transaction-manager')
  , QueryTypes         = require('./query-types')

module.exports = (function() {
  /**
    Main class of the project.

    @param {String} database The name of the database.
    @param {String} username The username which is used to authenticate against the database.
    @param {String} [password=null] The password which is used to authenticate against the database.
    @param {Object} [options={}] An object with options.
      @param {String} [options.dialect='mysql'] The dialect of the relational database.
      @param {String} [options.dialectModulePath=null] If specified, load the dialect library from this path.
      @param {String} [options.host='localhost'] The host of the relational database.
      @param {Integer} [options.port=] The port of the relational database.
      @param {String} [options.protocol='tcp'] The protocol of the relational database.
      @param {Object} [options.define={}] Options, which shall be default for every model definition.
      @param {Object} [options.query={}] I have absolutely no idea.
      @param {Object} [options.sync={}] Options, which shall be default for every `sync` call.
      @param {Function} [options.logging=console.log] A function that gets executed everytime Sequelize would log something.
      @param {Boolean} [options.omitNull=false] A flag that defines if null values should be passed to SQL queries or not.
      @param {Boolean} [options.queue=true] I have absolutely no idea.
      @param {Boolean} [options.native=false] A flag that defines if native library shall be used or not.
      @param {Boolean} [options.replication=false] I have absolutely no idea.
      @param {Object} [options.pool={}] Something.
      @param {Boolean} [options.quoteIdentifiers=true] Set to `false` to make table names and attributes case-insensitive on Postgres and skip double quoting of them.

    @example
        // without password and options
        var sequelize = new Sequelize('database', 'username')

        // without options
        var sequelize = new Sequelize('database', 'username', 'password')

        // without password / with blank password
        var sequelize = new Sequelize('database', 'username', null, {})

        // with password and options
        var sequelize = new Sequelize('my_database', 'john', 'doe', {})

    @class Sequelize
    @constructor
  */
  var Sequelize = function(database, username, password, options) {
    var urlParts
    options = options || {}

    if (arguments.length === 1 || (arguments.length === 2 && typeof username === 'object')) {
      options = username || {}
      urlParts = url.parse(arguments[0])

      // SQLite don't have DB in connection url
      if (urlParts.pathname) {
        database = urlParts.pathname.replace(/^\//,  '')
      }

      dialect = urlParts.protocol
      options.dialect = urlParts.protocol.replace(/:$/, '')
      options.host = urlParts.hostname

      if (urlParts.port) {
        options.port = urlParts.port
      }

      if (urlParts.auth) {
        username = urlParts.auth.split(':')[0]
        password = urlParts.auth.split(':')[1]
      }
    }

    this.options = Utils._.extend({
      dialect: 'mysql',
      dialectModulePath: null,
      host: 'localhost',
      protocol: 'tcp',
      define: {},
      query: {},
      sync: {},
      logging: console.log,
      omitNull: false,
      queue: true,
      native: false,
      replication: false,
      ssl: undefined,
      pool: {},
      quoteIdentifiers: true,
      language: 'en'
    }, options || {})

    if (this.options.logging === true) {
      console.log('DEPRECATION WARNING: The logging-option should be either a function or false. Default: console.log')
      this.options.logging = console.log
    }

    this.config = {
      database: database,
      username: username,
      password: (( (["", null, false].indexOf(password) > -1) || (typeof password == 'undefined')) ? null : password),
      host    : this.options.host,
      port    : this.options.port,
      pool    : this.options.pool,
      protocol: this.options.protocol,
      queue   : this.options.queue,
      native  : this.options.native,
      ssl     : this.options.ssl,
      replication: this.options.replication,
      dialectModulePath: this.options.dialectModulePath,
      maxConcurrentQueries: this.options.maxConcurrentQueries,
      dialectOptions: this.options.dialectOptions,
    }

    try {
      var Dialect = require("./dialects/" + this.getDialect())
      this.dialect = new Dialect(this)
    } catch(err) {
      throw new Error("The dialect " + this.getDialect() + " is not supported.")
    }
    this.daoFactoryManager  = new DAOFactoryManager(this)
    this.transactionManager = new TransactionManager(this)

    this.importCache = {}
  }

  /**
    Reference to Utils
  */
  Sequelize.Utils = Utils

  Sequelize.QueryTypes = QueryTypes

  Sequelize.DAOValidator = DAOValidator

  Sequelize.DAOFactory = Sequelize.Model = DAOFactory

  for (var dataType in DataTypes) {
    Sequelize[dataType] = DataTypes[dataType]
  }

  /**
   * Polyfill for the default connector manager.
   */
  Object.defineProperty(Sequelize.prototype, 'connectorManager', {
    get: function() {
      return this.transactionManager.getConnectorManager()
    }
  })

  /**
   * Returns the specified dialect.
   *
   * @return {String} The specified dialect.
   */
  Sequelize.prototype.getDialect = function() {
    return this.options.dialect
  }

  /**
   Returns an instance of QueryInterface.

   @method getQueryInterface
   @return {QueryInterface} An instance (singleton) of QueryInterface.
   */
  Sequelize.prototype.getQueryInterface = function() {
    this.queryInterface = this.queryInterface || new QueryInterface(this)
    return this.queryInterface
  }

  /**
   Returns an instance (singleton) of Migrator.

   @method getMigrator
   @param {Object} [options={}] Some options
   @param {Boolean} [force=false] A flag that defines if the migrator should get instantiated or not.
   @return {Migrator} An instance of Migrator.
   */
  Sequelize.prototype.getMigrator = function(options, force) {
    var Migrator = require("./migrator")

    if (force) {
      this.migrator = new Migrator(this, options)
    } else {
      this.migrator = this.migrator || new Migrator(this, options)
    }

    return this.migrator
  }

  Sequelize.prototype.define = function(daoName, attributes, options) {
    options = options || {}
    var self = this
      , globalOptions = this.options

    if (globalOptions.define) {
      options = Utils._.extend({}, globalOptions.define, options)
      Utils._(['classMethods', 'instanceMethods']).each(function(key) {
        if (globalOptions.define[key]) {
          options[key] = options[key] || {}
          Utils._.extend(options[key], globalOptions.define[key])
        }
      })
    }

    options.omitNull = globalOptions.omitNull
    options.language = globalOptions.language

    // If you don't specify a valid data type lets help you debug it
    Utils._.each(attributes, function(dataType, name) {
      if (Utils.isHash(dataType)) {
        // We have special cases where the type is an object containing
        // the values (e.g. Sequelize.ENUM(value, value2) returns an object
        // instead of a function)
        // Copy these values to the dataType
        dataType.values = (dataType.type && dataType.type.values) || dataType.values;

        // We keep on working with the actual type object
        dataType = dataType.type
      }

      if (dataType === undefined) {
        throw new Error('Unrecognized data type for field '+ name)
      }

      if (dataType.toString() === "ENUM") {
        attributes[name].validate = attributes[name].validate || {
          _checkEnum: function(value) {
            var hasValue        = value !== undefined
              , isMySQL         = ['mysql', 'mariadb'].indexOf(self.options.dialect) !== -1
              , ciCollation     = !!options.collate && options.collate.match(/_ci$/i) !== null
              , valueOutOfScope


            if (isMySQL && ciCollation && hasValue) {
              var scopeIndex = (attributes[name].values || []).map(function(d) { return d.toLowerCase() }).indexOf(value.toLowerCase())
              valueOutOfScope = scopeIndex === -1
            } else {
              valueOutOfScope = ((attributes[name].values || []).indexOf(value) === -1)
            }

            if (hasValue && valueOutOfScope && !(attributes[name].allowNull === true && values[attrName] === null)) {
              throw new Error('Value "' + value + '" for ENUM ' + name + ' is out of allowed scope. Allowed values: ' + attributes[name].values.join(', '))
            }
          }
        }
      }
    })

    // if you call "define" multiple times for the same daoName, do not clutter the factory
    if(this.isDefined(daoName)) {
      this.daoFactoryManager.removeDAO(this.daoFactoryManager.getDAO(daoName))
    }

    var factory = new DAOFactory(daoName, attributes, options)
    this.daoFactoryManager.addDAO(factory.init(this.daoFactoryManager))

    return factory
  }

  /**
   Fetch a DAO factory

   @param {String} daoName The name of a model defined with Sequelize.define
   @returns {DAOFactory} The DAOFactory for daoName
   */
  Sequelize.prototype.model = function(daoName) {
    if(!this.isDefined(daoName)) {
      throw new Error(daoName + ' has not been defined')
    }

    return this.daoFactoryManager.getDAO(daoName)
  }

  Sequelize.prototype.isDefined = function(daoName) {
    var daos = this.daoFactoryManager.daos
    return (daos.filter(function(dao) { return dao.name === daoName }).length !== 0)
  }

  Sequelize.prototype.import = function(path) {
    // is it a relative path?
    if (Path.normalize(path).indexOf(path.sep) !== 0) {
      // make path relative to the caller
      var callerFilename = Utils.stack()[1].getFileName()
        , callerPath     = Path.dirname(callerFilename)

      path = Path.resolve(callerPath, path)
    }

    if (!this.importCache[path]) {
      var defineCall = (arguments.length > 1 ? arguments[1] : require(path))
      this.importCache[path] = defineCall(this, DataTypes)
    }

    return this.importCache[path]
  }

  Sequelize.prototype.migrate = function(options) {
    return this.getMigrator().migrate(options)
  }

  Sequelize.prototype.query = function(sql, callee, options, replacements) {
    if (arguments.length === 4) {
      if (Array.isArray(replacements)) {
        sql = Utils.format([sql].concat(replacements), this.options.dialect)
      }
      else {
        sql = Utils.formatNamedParameters(sql, replacements, this.options.dialect)
      }
    } else if (arguments.length === 3) {
      options = options
    } else if (arguments.length === 2) {
      options = {}
    } else {
      options = { raw: true }
    }

    options = Utils._.extend(Utils._.clone(this.options.query), options)
    options = Utils._.defaults(options, {
      logging: this.options.hasOwnProperty('logging') ? this.options.logging : console.log,
      type: (sql.toLowerCase().indexOf('select') === 0) ? QueryTypes.SELECT : false
    })

    return this.transactionManager.query(sql, callee, options)
  }

  Sequelize.prototype.createSchema = function(schema) {
    var chainer = new Utils.QueryChainer()

    chainer.add(this.getQueryInterface().createSchema(schema))

    return chainer.run()
  }

  Sequelize.prototype.showAllSchemas = function() {
    var chainer = new Utils.QueryChainer()

    chainer.add(this.getQueryInterface().showAllSchemas())

    return chainer.run()
  }

  Sequelize.prototype.dropSchema = function(schema) {
    var chainer = new Utils.QueryChainer()

    chainer.add(this.getQueryInterface().dropSchema(schema))

    return chainer.run()
  }

  Sequelize.prototype.dropAllSchemas = function() {
    var self = this

    var chainer = new Utils.QueryChainer()
    chainer.add(self.getQueryInterface().dropAllSchemas())
    return chainer.run()
  }

  Sequelize.prototype.sync = function(options) {
    options = options || {}

    if (this.options.sync) {
      options = Utils._.extend({}, this.options.sync, options)
    }

    options.logging = options.logging === undefined ? false : options.logging

    var chainer = new Utils.QueryChainer()

    // Topologically sort by foreign key constraints to give us an appropriate
    // creation order

    this.daoFactoryManager.forEachDAO(function(dao, daoName) {
      if (dao) {
        chainer.add(dao, 'sync', [options])
      } else {
        // DB should throw an SQL error if referencing inexistant table
      }
    })

    return chainer.runSerially()
  }

  Sequelize.prototype.drop = function() {
    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      var chainer = new Utils.QueryChainer

      self.daoFactoryManager.daos.forEach(function(dao) { chainer.add(dao.drop()) })

      chainer
        .run()
        .success(function() { emitter.emit('success', null) })
        .error(function(err) { emitter.emit('error', err) })
    }).run()
  }

  Sequelize.prototype.authenticate = function() {
    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      self
        .query('SELECT 1+1 AS result', null, { raw: true, plain: true })
        .complete(function(err, result) {
          if (!!err) {
            emitter.emit('error', new Error(err))
          } else {
            emitter.emit('success')
          }
        })
    }).run()
  }

  Sequelize.prototype.validate = Sequelize.prototype.authenticate;

  Sequelize.fn = Sequelize.prototype.fn = function (fn) {
    return new Utils.fn(fn, Array.prototype.slice.call(arguments, 1))
  }

  Sequelize.col = Sequelize.prototype.col = function (col) {
    return new Utils.col(col)
  }

  Sequelize.cast = Sequelize.prototype.cast = function (val, type) {
    return new Utils.cast(val, type)
  }

  Sequelize.literal = Sequelize.prototype.literal = function (val) {
    return new Utils.literal(val)
  }

  Sequelize.asIs = Sequelize.prototype.asIs = function (val) {
    return new Utils.asIs(val)
  }

  Sequelize.and = Sequelize.prototype.and = function() {
    return new Utils.and(Array.prototype.slice.call(arguments))
  }

  Sequelize.or = Sequelize.prototype.or = function() {
    return new Utils.or(Array.prototype.slice.call(arguments))
  }

  Sequelize.prototype.transaction = function(_options, _callback) {
    var options     = (typeof _options === 'function') ? {} : _options
      , callback    = (typeof _options === 'function') ? _options : _callback
      , wantsError  = (callback.length === 2)
      , transaction = new Transaction(this, options)
      , self        = this

    Utils.tick(function() {
      if (wantsError) {
        transaction.error(function(err) {
          callback(err, transaction)
        })
      }

      transaction.prepareEnvironment(function() {
        wantsError ? callback(null, transaction) : callback(transaction)
      })
    })

    return transaction
  }

  return Sequelize
})()
