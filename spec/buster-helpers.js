const Sequelize = require(__dirname + "/../index")
    , DataTypes = require(__dirname + "/../lib/data-types")
    , config    = require(__dirname + "/config/config")
    , fs        = require('fs')

var BusterHelpers = module.exports = {
  Sequelize: Sequelize,

  initTests: function(options) {
    var sequelize = this.createSequelizeInstance(options)

    this.clearDatabase(sequelize, function() {
      options.beforeComplete && options.beforeComplete(sequelize, DataTypes)
      options.onComplete && options.onComplete(sequelize, DataTypes)
    })
  },

  createSequelizeInstance: function(options) {
    options = options || {}

    options.dialect = options.dialect || 'mysql'
    options.logging = (options.hasOwnProperty('logging') ? options.logging : false)

    var sequelizeOptions = {
      logging: options.logging,
      dialect: options.dialect,
      port:    config[options.dialect].port
    }

    if (process.env.DIALECT === 'postgres-native') {
      sequelizeOptions.native = true
    }

    return new Sequelize(
      config[options.dialect].database,
      config[options.dialect].username,
      config[options.dialect].password,
      sequelizeOptions
    )
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

  getTestDialectTeaser: function() {
    var dialect = this.getTestDialect()

    if (process.env.DIALECT === 'postgres-native') {
      dialect = 'postgres-native'
    }

    return dialect.toUpperCase()
  },

  checkMatchForDialects: function(dialect, value, expectations) {
    if (!!expectations[dialect]) {
      expect(value).toMatch(expectations[dialect])
    } else {
      throw new Error('Undefined expectation for "' + dialect + '"!')
    }
  }
}
