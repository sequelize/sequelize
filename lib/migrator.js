const fs     = require("fs")
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
      to: null,
      logging: console.log
    }, options || {})

    if (this.options.logging === true) {
      console.log('DEPRECATION WARNING: The logging-option should be either a function or false. Default: console.log')
      this.options.logging = console.log
    }

    if (this.options.logging == console.log) {
      // using just console.log will break in node < 0.6
      this.options.logging = function(s) { console.log(s) }
    }
  }

  Object.defineProperty(Migrator.prototype, "queryInterface", {
    get: function() {
      return this.sequelize.getQueryInterface()
    }
  })

  Migrator.prototype.migrate = function(options) {
    var self = this

    options = Utils._.extend({
      method: 'up'
    }, options || {})

    return new Utils.CustomEventEmitter(function(emitter) {
      self.getUndoneMigrations(function(err, migrations) {
        if (err) {
          emitter.emit('error', err)
        } else {
          var chainer = new Utils.QueryChainer
            , from    = migrations[0]

          if (options.method === 'down') {
            from = migrations[0]
            migrations.reverse()
          }

          migrations.forEach(function(migration) {
            chainer.add(migration, 'execute', [options], {
              before: function(migration) {
                if (self.options.logging !== false) {
                  self.options.logging('Executing migration: ' + migration.filename)
                }
              },
              after: function(migration) {
                if (self.options.logging !== false) {
                  self.options.logging('Executed migration: ' + migration.filename)
                }
              },
              success: function(migration, callback) {
                if (options.method === 'down') {
                  deleteUndoneMigration.call(self, from, migration, callback)
                } else {
                  saveSuccessfulMigration.call(self, from, migration, callback)
                }
              }
            })
          })

          chainer
            .runSerially({ skipOnError: true })
            .success(function() { emitter.emit('success', null) })
            .error(function(err) { emitter.emit('error', err) })
        }
      })
    }).run()
  }

  Migrator.prototype.getUndoneMigrations = function(callback)  {
    var self = this

    var filterFrom = function(migrations, from, callback, options) {
      var result = migrations.filter(function(migration) { return migration.isAfter(from, options) })
      callback && callback(null, result)
    }
    var filterTo = function(migrations, to, callback, options) {
      var result = migrations.filter(function(migration) { return migration.isBefore(to, options) })
      callback && callback(null, result)
    }

    var migrationFiles = fs.readdirSync(this.options.path).filter(function(file) {
      return /\.js$/.test(file)
    })

    var migrations = migrationFiles.map(function(file) {
      return new Migration(self, self.options.path + '/' + file)
    })

    migrations = migrations.sort(function(a,b){
      return parseInt(a.filename.split('-')[0]) - parseInt(b.filename.split('-')[0])
    })

    if (this.options.from) {
      filterFrom(migrations, this.options.from, function(err, migrations) {
        if (self.options.to) {
          filterTo(migrations, self.options.to, callback)
        } else {
          callback && callback(null, migrations)
        }
      })
    } else {
      getLastMigrationIdFromDatabase.call(this).success(function(lastMigrationId) {
        if (lastMigrationId) {
          filterFrom(migrations, lastMigrationId, function(err, migrations) {
            if (self.options.to) {
              filterTo(migrations, self.options.to, callback)
            } else {
              callback && callback(null, migrations)
            }
          }, { withoutEqual: true })
        } else {
          if (self.options.to) {
            filterTo(migrations, self.options.to, callback)
          } else {
            callback && callback(null, migrations)
          }
        }
      }).error(function(err) {
        callback && callback(err, null)
      })
    }
  }

  Migrator.prototype.findOrCreateSequelizeMetaDAO = function(syncOptions) {
    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      var storedDAO   = self.sequelize.daoFactoryManager.getDAO('SequelizeMeta')
        , SequelizeMeta = storedDAO

      if (!storedDAO) {
        SequelizeMeta = self.sequelize.define('SequelizeMeta', {
          from: DataTypes.STRING,
          to:   DataTypes.STRING
        }, {
          timestamps: false
        })
      }

      // force sync when model has newly created or if syncOptions are passed
      if (!storedDAO || syncOptions) {
        SequelizeMeta
          .sync(syncOptions || {})
          .success(function() { emitter.emit('success', SequelizeMeta) })
          .error(function(err) { emitter.emit('error', err) })
      } else {
        emitter.emit('success', SequelizeMeta)
      }
    }).run()
  }

  // private

  var getLastMigrationFromDatabase = function() {
    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      self.findOrCreateSequelizeMetaDAO().success(function(SequelizeMeta) {
        SequelizeMeta.find({ order: 'id DESC' }).success(function(meta) {
          emitter.emit('success', meta ? meta : null)
        }).error(function(err) { emitter.emit('error', err) })
      }).error(function(err) { emitter.emit(err) })
    }).run()
  }

  var getLastMigrationIdFromDatabase = function() {
    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      getLastMigrationFromDatabase.call(self)
        .success(function(meta) {
          emitter.emit('success', meta ? meta.to : null)
        })
        .error(function(err) {
          emitter.emit('error', err)
        })
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

  var saveSuccessfulMigration = function(from, to, callback) {
    var self = this

    self.findOrCreateSequelizeMetaDAO().success(function(SequelizeMeta) {
      SequelizeMeta
        .create({ from: from.migrationId, to: to.migrationId })
        .success(callback)
    })
  }

  var deleteUndoneMigration = function(from, to, callback) {
    var self = this

    self.findOrCreateSequelizeMetaDAO().success(function(SequelizeMeta) {
      SequelizeMeta
        .find({ where: { from: from.migrationId.toString(), to: to.migrationId.toString() } })
        .success(function(meta) {
          meta.destroy().success(callback)
        })
    })
  }

  return Migrator
})()
