var fs        = require('fs')
  , path      = require('path')
  , Sequelize = require(__dirname + "/../index")
  , DataTypes = require(__dirname + "/../lib/data-types")
  , Config    = require(__dirname + "/config/config")

var Support = {
  Sequelize: Sequelize,

  initTests: function(options) {
    var sequelize = this.createSequelizeInstance(options)

    this.clearDatabase(sequelize, function() {
      if (options.context) {
        options.context.sequelize = sequelize
      }

      if (options.beforeComplete) {
        options.beforeComplete(sequelize, DataTypes)
      }

      if (options.onComplete) {
        options.onComplete(sequelize, DataTypes)
      }
    })
  },

  prepareTransactionTest: function(sequelize, callback) {
    var dialect = Support.getTestDialect()

    if (dialect === 'sqlite') {
      var options    = Sequelize.Utils._.extend({}, sequelize.options, { storage: path.join(__dirname, 'tmp', 'db.sqlite') })
        , _sequelize = new Sequelize(sequelize.config.datase, null, null, options)

      _sequelize.sync({ force: true }).success(function() { callback(_sequelize) })
    } else {
      callback(sequelize)
    }
  },

  createSequelizeInstance: function(options) {
    options = options || {}
    options.dialect = options.dialect || 'mysql'

    var config = Config[options.dialect]

    options.logging = (options.hasOwnProperty('logging') ? options.logging : false)
    options.pool    = options.pool || config.pool

    var sequelizeOptions = {
      host:           options.host || config.host,
      logging:        options.logging,
      dialect:        options.dialect,
      port:           options.port || process.env.SEQ_PORT || config.port,
      pool:           options.pool,
      dialectOptions: options.dialectOptions || {}
    }

    if (!!options.define) {
      sequelizeOptions.define = options.define
    }

    if (!!config.storage) {
      sequelizeOptions.storage = config.storage
    }

    if (process.env.DIALECT === 'postgres-native') {
      sequelizeOptions.native = true
    }

    return this.getSequelizeInstance(config.database, config.username, config.password, sequelizeOptions)
  },

  getSequelizeInstance: function(db, user, pass, options) {
    options = options || {}
    options.dialect = options.dialect || this.getTestDialect()
    return new Sequelize(db, user, pass, options)
  },

  clearDatabase: function(sequelize, callback) {
    sequelize
      .getQueryInterface()
      .dropAllTables()
      .success(function() {
        sequelize.daoFactoryManager.daos = []
        callback && callback()
      })
      .error(function(err) { console.log(err) })
  },

  getSupportedDialects: function() {
    return fs.readdirSync(__dirname + '/../lib/dialects').filter(function(file) {
      return ((file.indexOf('.js') === -1) && (file.indexOf('abstract') === -1))
    })
  },

  checkMatchForDialects: function(dialect, value, expectations) {
    if (!!expectations[dialect]) {
      expect(value).to.match(expectations[dialect])
    } else {
      throw new Error('Undefined expectation for "' + dialect + '"!')
    }
  },

  getTestDialect: function() {
    var envDialect = process.env.DIALECT || 'mysql'

    if (envDialect === 'postgres-native') {
      envDialect = 'postgres'
    }

    if (this.getSupportedDialects().indexOf(envDialect) === -1) {
      throw new Error('The dialect you have passed is unknown. Did you really mean: ' + envDialect)
    }

    return envDialect
  },

  dialectIsMySQL: function(strict) {
    var envDialect = process.env.DIALECT || 'mysql'
    if (strict === undefined) {
      strict = false
    }

    if (strict) {
      return envDialect === 'mysql'
    } else {
      return ['mysql', 'mariadb'].indexOf(envDialect) !== -1
    }
  },

  getTestDialectTeaser: function(moduleName) {
    var dialect = this.getTestDialect()

    if (process.env.DIALECT === 'postgres-native') {
      dialect = 'postgres-native'
    }

    return "[" + dialect.toUpperCase() + "] " + moduleName
  },

  getTestUrl: function(config) {
    var url,
        dbConfig = config[config.dialect];

    if (config.dialect === 'sqlite') {
      url = 'sqlite://' + dbConfig.storage;
    } else {
      url = config.dialect + "://" + dbConfig.username
      + "@" + dbConfig.host + ":" + dbConfig.port + "/" + dbConfig.database;
    }
    return url;
  }
}

var sequelize = Support.createSequelizeInstance({ dialect: Support.getTestDialect() })

// For Postgres' HSTORE functionality and to properly execute it's commands we'll need this...
before(function(done) {
  var dialect = Support.getTestDialect()
  if (dialect !== "postgres" && dialect !== "postgres-native") {
    return done()
  }

  sequelize.query('CREATE EXTENSION IF NOT EXISTS hstore', null, {raw: true}).success(function() {
    done()
  })
})

beforeEach(function(done) {
  this.sequelize = sequelize

  Support.clearDatabase(this.sequelize, function() {
    done()
  })
})

module.exports = Support
