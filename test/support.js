var fs        = require('fs')
  , Sequelize = require(__dirname + "/../index")
  , DataTypes = require(__dirname + "/../lib/data-types")
  , config    = require(__dirname + "/config/config")

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

  createSequelizeInstance: function(options) {
    options = options || {}

    options.dialect = options.dialect || 'mysql'
    options.logging = (options.hasOwnProperty('logging') ? options.logging : false)
    options.pool    = options.pool || config.pool

    var sequelizeOptions = {
      logging: options.logging,
      dialect: options.dialect,
      port:    options.port || process.env.SEQ_PORT || config[options.dialect].port,
      pool:    options.pool
    }

    if (!!options.host) {
      sequelizeOptions.host = options.host
    }

    if (!!options.define) {
      sequelizeOptions.define = options.define
    }

    if (process.env.DIALECT === 'postgres-native') {
      sequelizeOptions.native = true
    }

    return this.getSequelizeInstance(
      process.env.SEQ_DB || config[options.dialect].database,
      process.env.SEQ_USER  || process.env.SEQ_USERNAME || config[options.dialect].username,
      process.env.SEQ_PW    || process.env.SEQ_PASSWORD || config[options.dialect].password,
      sequelizeOptions
    )
  },

  getSequelizeInstance: function(db, user, pass, options) {
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

  getTestDialectTeaser: function(moduleName) {
    var dialect = this.getTestDialect()

    if (process.env.DIALECT === 'postgres-native') {
      dialect = 'postgres-native'
    }

    return "[" + dialect.toUpperCase() + "] " + moduleName
  }
}

var sequelize = Support.createSequelizeInstance({ dialect: Support.getTestDialect() })

before(function(done) {
  this.sequelize = sequelize
  done()
})

afterEach(function(done) {
  Support.clearDatabase(this.sequelize, done)
})

module.exports = Support
