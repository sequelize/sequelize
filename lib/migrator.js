const fs     = require("fs")
    , path   = require("path")
    , moment = require("moment")

var Utils          = require("./utils")
  , Migration      = require("./migration")
  , DataTypes      = require("./data-types")

module.exports = (function() {
  var Migrator = function(sequelize, options) {
    this.sequelize = sequelize
    this.options   = Utils._.extend({
      path: __dirname + '/../migrations',
      from: null,
      to: null
    }, options || {})
  }

  Object.defineProperty(Migrator.prototype, "queryInterface", {
    get: function() {
      return this.sequelize.getQueryInterface()
    }
  })

  Migrator.prototype.migrate = function() {
    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      self.getUndoneMigrations(function(migrations) {
        var chainer = new Utils.QueryChainer

        migrations.forEach(function(migration) {
          chainer.add(migration.execute())
        })

        chainer
          .run()
          .success(function() {
            emitter.emit('success', null)
          }).error(function(err) {
            emitter.emit('failure', err)
          })
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
      return new Migration(self, self.options.path + '/' + file)
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
