const Sequelize = require(__dirname + "/../index")
    , DataTypes = require(__dirname + "/../lib/data-types")
    , config    = require(__dirname + "/config/config")

var BusterHelpers = module.exports = {
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

    return new Sequelize(
      config[options.dialect].database,
      config[options.dialect].username,
      config[options.dialect].password,
      {
        logging:  false,
        dialect:  options.dialect,
        port:     config[options.dialect].port
      }
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
  }
}
