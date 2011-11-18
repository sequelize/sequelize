var fs        = require("fs")
  , path      = require("path")
  , moment    = require("moment")
  , Utils     = require("./utils")
  , DataTypes = require("./data-types")

module.exports = (function() {
  var Migrator = function(sequelize, options) {
    this.sequelize = sequelize
    this.options   = Utils._.extend({
      path: __dirname + '/../migrations',
      from: null,
      to: null
    }, options || {})
  }

  Migrator.prototype.migrate = function() {
    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      var execMigrations = function(from) {
        var nonMigratedFiles = getMigrationsFilesSince.call(self, from)

        nonMigratedFiles.forEach(function(file) {
          executeMigration.call(self, self.options.path + '/' + file)
        })

        emitter.emit('success')
      }

      if(self.options.from) {
        execMigrations(self.options.from)
      } else {
        getLastMigrationId.call(self).success(function(migrationId) {
          migrationId = migrationId || '19700101000000'
          execMigrations.call(self, migrationId)
        })
      }
    }).run()
  }

  Migrator.prototype.createTable = function() {

  }

  Migrator.prototype.dropTable = function() {

  }

  Migrator.prototype.renameTable = function() {

  }

  Migrator.prototype.addColumn = function() {

  }

  Migrator.prototype.removeColumn = function() {

  }

  Migrator.prototype.changeColumn = function() {

  }

  Migrator.prototype.renameColumn = function() {

  }

  Migrator.prototype.addIndex = function() {

  }

  Migrator.prototype.removeIndex = function() {

  }

  // private

  var executeMigration = function(path, method) {
    var migration = require(path)
    migration[method || 'up'](this)

  }

  var getLastMigrationId = function() {
    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      var SequelizeMeta       = self.sequelize.modelManager.getModel('SequelizeMeta')

      var findLastMigrationId = function() {
        SequelizeMeta.find({ order: 'id DESC' }).success(function(sequelizeMeta) {
          emitter.emit('success', sequelizeMeta ? sequelizeMeta.lastMigrationId : null)
        })
      }

      if(SequelizeMeta) {
        findLastMigrationId()
      } else {
        SequelizeMeta = self.sequelize.define('SequelizeMeta', {
          lastMigrationId: DataTypes.STRING
        })

        SequelizeMeta.sync().success(function() {
          findLastMigrationId()
        }).error(function(err) {
          emitter.emit('failure', err)
        })
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
    var formattedString = getFormattedDateString(s)
      , date            = moment(formattedString, "YYYYMMDDHHmmss")

    return date
  }

  var getMigrationsFilesSince = function(sinceString)  {
    var result = []
      , since  = stringToDate(sinceString)

    var undoneMigrationFiles = fs.readdirSync(this.options.path).filter(function(file) {
      var fileDateString = file.split("-")[0]
        , fileDate       = stringToDate(fileDateString)

      return fileDate.diff(since) > 0
    })

    return undoneMigrationFiles
  }

  return Migrator
})()
