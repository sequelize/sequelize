const fs     = require("fs")
    , path   = require("path")
    , moment = require("moment")

var Utils          = require("./utils")
  , DataTypes      = require("./data-types")
  , QueryInterface = require("./query-interface")

module.exports = (function() {
  var Migrator = function(sequelize, options) {
    this.sequelize = sequelize
    this.queryInterface = new QueryInterface(this.sequelize)
    this.options   = Utils._.extend({
      path: __dirname + '/../migrations',
      from: null,
      to: null
    }, options || {})
  }

  Migrator.prototype.migrate = function() {
    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      self.getUndoneMigrations(function(migrations) {
        emitter.emit('success')
        console.log(migrations)
      })
    }).run()
  }

  Migrator.prototype.getUndoneMigrations = function(callback)  {
    var undoneMigrations = fs.readdirSync(this.options.path)

    if(this.options.from) {
      var fromDate = stringToDate(this.options.from.toString())

      undoneMigrations = undoneMigrations.filter(function(file) {
        var fileDate = stringToDate(file.split("-")[0])
        return (fileDate >= fromDate)
      })
    }

    if(this.options.to) {
      var toDate = stringToDate(this.options.to.toString())

      undoneMigrations = undoneMigrations.filter(function(file) {
        var fileDate = stringToDate(file.split("-")[0])
        return (fileDate <= toDate)
      })
    }

    callback && callback(undoneMigrations)
  }

  // private

  var executeMigration = function(path, method) {
    var migration = require(path)
    migration[method || 'up'](this.queryInterface, DataTypes)
  }

  var getLastMigrationId = function() {
    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      var SequelizeMeta = self.sequelize.modelManager.getModel('SequelizeMeta')

      var findLastMigrationId = function() {
        SequelizeMeta.find({ order: 'id DESC' }).success(function(sequelizeMeta) {
          emitter.emit('success', sequelizeMeta ? sequelizeMeta.lastMigrationId : null)
        }).error(function(err) { emitter.emit('failure', err) })
      }

      if(SequelizeMeta) {
        findLastMigrationId()
      } else {
        SequelizeMeta = self.sequelize.define('SequelizeMeta', {
          lastMigrationId: DataTypes.STRING
        })

        SequelizeMeta
          .sync()
          .success(function() { findLastMigrationId() })
          .error(function(err) { emitter.emit('failure', err) })
      }
    }).run()
  }

  var getFormattedDateString = function(s) {
    var result = null

    try {
      result = s.match(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/).slice(1, 6).join('-')
    } catch(e) {
      throw new Error(s + ' is no valid migration timestamp format! Use YYYYMMDDHHmmss!')
    }

    return result
  }

  var stringToDate = function(s) {
    return moment(getFormattedDateString(s), "YYYYMMDDHHmmss")
  }

  return Migrator
})()
