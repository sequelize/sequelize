const fs     = require("fs")
    , path   = require("path")
    , moment = require("moment")

var Utils          = require("./utils")
  , DataTypes      = require("./data-types")
  , QueryInterface = require("./query-interface")
  , Migration      = require("./migration")

module.exports = (function() {
  var Migrator = function(sequelize, options) {
    this.sequelize = sequelize
    this.queryInterface = sequelize.getQueryInterface()
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
        console.log(migrations)
        emitter.emit('success')
      })
    }).run()
  }

  Migrator.prototype.getUndoneMigrations = function(callback)  {
    var self = this

    var filterFrom = function(migrations, from, callback, options) {
      var result = migrations.filter(function(migration) { return migration.isAfter(from, options) })
      callback && callback(result)
    }
    var filterTo = function(migrations, to, callback, options) {
      var result = migrations.filter(function(migration) { return migration.isBefore(to, options) })
      callback && callback(result)
    }

    var migrationFiles = fs.readdirSync(this.options.path)

    var migrations = migrationFiles.map(function(file) {
      return new Migration(self.options.path + '/' + file)
    })

    if(this.options.from) {
      filterFrom(migrations, this.options.from, function(migrations) {
        if(self.options.to)
          filterTo(migrations, self.options.to, callback)
        else
          callback && callback(migrations)
      })
    } else {
      getLastMigrationIdFromDatabase.call(this).success(function(lastMigrationId) {
        if(lastMigrationId) {
          filterFrom(migrations, lastMigrationId, function(migrations) {
            if(self.options.to)
              filterTo(migrations, self.options.to, callback)
            else
              callback && callback(migrations)
          }, { withoutEqual: true })
        } else {
          callback && callback(migrations)
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
    console.log(path)
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

  var observeQueryInterfaceForSuccess = function(callback) {
    var self = this

    for(var method in QueryInterface.prototype) {
      self[method] = function() {
        var emitter = self.queryInterface



        // bind listeners to the query interface
        // the event will have the same name like the method
        self.queryInterface.on(method, function(err) {
          if(err) {
            throw new Error(err)
          } else {

          }
        })
      }
    }
      console.log(proto)
    //this.queryInterface.prototype.each ...
  }

  return Migrator
})()
