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
      self.getUndoneMigrations(function(migrationFiles) {
        migrationFiles.forEach(function() { self.executeMigration() })
        emitter.emit('success')
      })
    }).run()
  }

  Migrator.prototype.getUndoneMigrations = function(callback)  {
    var self = this

    var filterFrom = function(files, from, callback, options) {
      var fromDate = stringToDate(from.toString())
        , result   = []

      result = files.filter(function(file) {
        var fileDate = stringToDate(file.split("-")[0])
        return (options||{}).withoutEqual ? (fileDate > fromDate) : (fileDate >= fromDate)
      })

      callback && callback(result)
    }

    var filterTo = function(files, to, callback) {
      var toDate = stringToDate(to.toString())
        , result = []

      result = files.filter(function(file) {
        var fileDate = stringToDate(file.split("-")[0])
        return (fileDate <= toDate)
      })

      callback && callback(result)
    }

    var migrationFiles = fs.readdirSync(this.options.path)

    if(this.options.from) {
      filterFrom(migrationFiles, this.options.from, function(files) {
        if(self.options.to)
          filterTo(files, self.options.to, callback)
        else
          callback && callback(files)
      })
    } else {
      getLastMigrationIdFromDatabase.call(this).success(function(lastMigrationId) {
        if(lastMigrationId) {
          filterFrom(migrationFiles, lastMigrationId, function(files) {
            if(self.options.to)
              filterTo(files, self.options.to, callback)
            else
              callback && callback(files)
          }, { withoutEqual: true })
        } else {
          callback && callback(migrationFiles)
        }
      })
    }
  }

  Migrator.prototype.findOrCreateSequelizeMetaModel = function(syncOptions) {
    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      var SequelizeMeta = self.sequelize.modelManager.getModel('SequelizeMeta')

      if(SequelizeMeta) {
        emitter.emit('success', SequelizeMeta)
      } else {
        SequelizeMeta = self.sequelize.define('SequelizeMeta', {
          lastMigrationId: DataTypes.STRING
        })

        SequelizeMeta
          .sync(syncOptions || {})
          .success(function() { emitter.emit('success', SequelizeMeta) })
          .error(function(err) { emitter.emit('failure', err) })
      }
    }).run()
  }

  Migrator.prototype.executeMigration = function(path, method) {
    var migration = require(path)
    migration[method || 'up'](this.queryInterface, DataTypes)
  }

  // private

  var getLastMigrationIdFromDatabase = function() {
    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      self.findOrCreateSequelizeMetaModel().success(function(SequelizeMeta) {
        SequelizeMeta.find({ order: 'id DESC' }).success(function(meta) {
          emitter.emit('success', meta ? meta.lastMigrationId : null)
        }).error(function(err) { emitter.emit('failure', err) })
      }).error(function(err) { emitter.emit(err) })
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
