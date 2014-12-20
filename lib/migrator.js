'use strict';

var fs = require('fs')
  , moment = require('moment');

var Utils = require(__dirname + '/utils')
  , Migration = require(__dirname + '/migration')
  , DataTypes = require(__dirname + '/data-types');

module.exports = (function() {
  var Migrator = function(sequelize, options) {
    this.sequelize = sequelize;
    this.options = Utils._.extend({
      path: __dirname + '/../migrations',
      from: null,
      to: null,
      logging: this.sequelize.log.bind(this.sequelize),
      filesFilter: /\.js$/
    }, options || {});
  };

  Object.defineProperty(Migrator.prototype, 'queryInterface', {
    get: function() {
      return this.sequelize.getQueryInterface();
    }
  });

  Migrator.prototype.migrate = function(options) {
    var self = this;

    options = Utils._.extend({
      method: 'up'
    }, options || {});

    return new Utils.CustomEventEmitter(function(emitter) {
      if(options.method === 'down') {
        self.getCompletedMigrations(function(err, migrations){
          migrations.reverse();
          self.processMigrations(err, migrations, options, emitter);
        });
      } else {
        self.getUndoneMigrations(function(err, migrations){
          self.processMigrations(err, migrations, options, emitter);
        });
      }
    }).run();
  };

  Migrator.prototype.processMigrations = function(err, migrations, options, emitter) {
    var self = this;
    if (err) {
      emitter.emit('error', err);
    } else {
      var chainer = new Utils.QueryChainer()
        , from = options.method === 'down' ? Utils._.last(migrations) : Utils._.first(migrations);

      if (migrations.length === 0) {
        self.options.logging('There are no pending migrations.');
      } else {
        self.options.logging('Running migrations...');
      }

      migrations.forEach(function(migration) {
        var migrationTime;

        chainer.add(migration, 'execute', [options], {
          before: function(migration) {
            self.options.logging(migration.filename || migration.id);
            migrationTime = process.hrtime();
          },

          after: function(migration) {
            migrationTime = process.hrtime(migrationTime);
            migrationTime = Math.round((migrationTime[0] * 1000) + (migrationTime[1] / 1000000));

            self.options.logging('Completed in ' + migrationTime + 'ms');
          },

          success: function(migration, callback) {
            if (options.method === 'down') {
              deleteUndoneMigration.call(self, from, migration, callback);
            } else {
              saveSuccessfulMigration.call(self, from, migration, callback);
            }
          }
        });
      });

      chainer
        .runSerially({ skipOnError: true })
        .success(function() { emitter.emit('success', null); })
        .error(function(err) { emitter.emit('error', err); });
    }
  };

  Migrator.prototype.getMigrations = function(callback) {
    return Utils._(fs.readdirSync(this.options.path))
      .filter(function(file) {
        return this.options.filesFilter.test(file);
      }, this)
      .map(function(file) {
        return new Migration(this, this.options.path + '/' + file);
      }, this)
      .sortBy(function(file) {
        return parseInt(file.filename.split('-')[0], 10);
      })
      .value();
  };

  Migrator.prototype._filterWithFromAndTo = function(migrations) {
    if (this.options.from) {
      migrations = Utils._.filter(migrations, function(m) { return m.isAfter(this.options.from); }, this);
    }
    if (this.options.to) {
      migrations = Utils._.filter(migrations, function(m) { return m.isBefore(this.options.to); }, this);
    }

    return migrations;
  };

  Migrator.prototype.getUndoneMigrations = function(callback)  {
    var self = this;

    var filterByMigrationId = function(migrations, migrationIds, callback) {
      var result = migrations.filter(function(migration) { return migrationIds.indexOf(migration.migrationId) === -1;
      });
      callback && callback(null, result);
    };

    var migrations = this.getMigrations();
    var getPendingMigrations = function(callback) {
      getAllMigrationIdsFromDatabase.call(self).success(function(allMigrationIds) {
        allMigrationIds = allMigrationIds.map(function(migration) {
          return parseInt(migration.to, 10);
        });
        if (allMigrationIds) {
          filterByMigrationId(migrations, allMigrationIds, callback);
        }
      });
    };

    if (this.options.from) {
      migrations = this._filterWithFromAndTo(migrations);
      callback && callback(null, migrations);
    } else {
      getPendingMigrations(function(err, pendingMigrations) {
        if (self.options.to) {
          pendingMigrations = pendingMigrations.filter(function(m) { return m.isBefore(self.options.to); });
        }
        callback && callback(err, pendingMigrations);
      });
    }
  };

  Migrator.prototype.getCompletedMigrations = function(callback)  {
    var self = this;

    var filterByMigrationId = function(migrations, allMigrationIds) {
      return migrations.filter(function(migration) {
        return allMigrationIds.indexOf(migration.migrationId) > -1;
      });
    };

    getAllMigrationIdsFromDatabase.call(self)
    .then(function(allMigrationIds) {
      allMigrationIds = allMigrationIds.map(function(migration) {
        return parseInt(migration.to, 10);
      });

      var migrations = filterByMigrationId(self.getMigrations(), allMigrationIds);
      migrations = self._filterWithFromAndTo(migrations);

      callback(null, migrations || []);
    });
  };

  Migrator.prototype.findOrCreateSequelizeMetaDAO = function(syncOptions) {
    var self = this;

    return new Utils.CustomEventEmitter(function(emitter) {
      var storedDAO = self.sequelize.daoFactoryManager.getDAO('SequelizeMeta')
        , SequelizeMeta = storedDAO;

      if (!storedDAO) {
        SequelizeMeta = self.sequelize.define('SequelizeMeta', {
          from: DataTypes.STRING,
          to: DataTypes.STRING
        }, {
          timestamps: false
        });
      }

      // force sync when model has newly created or if syncOptions are passed
      if (!storedDAO || syncOptions) {
        SequelizeMeta
          .sync(syncOptions || {})
          .success(function() { emitter.emit('success', SequelizeMeta); })
          .error(function(err) { emitter.emit('error', err); });
      } else {
        emitter.emit('success', SequelizeMeta);
      }
    }).run();
  };

  /**
   * Explicitly executes one or multiple migrations.
   *
   * @param filename {String|Array} Absolute filename(s) of the migrations script
   * @param options  {Object}       Can contain three functions, before, after and success, which are executed before
   *                                or after each migration respectively, with one parameter, the migration.
   */
  Migrator.prototype.exec = function(filename, options) {

    var self = this;
    return new Utils.CustomEventEmitter(function(emitter) {
      var chainer = new Utils.QueryChainer();
      var addMigration = function(filename) {
        var migration = new Migration(self, filename);

        self.options.logging('Adding migration script at ' + filename);

        chainer.add(migration, 'execute', [{ method: 'up' }], {
          before: function(migration) {
            if (options && Utils._.isFunction(options.before)) {
              options.before.call(self, migration);
            }
          },
          after: function(migration) {
            if (options && Utils._.isFunction(options.after)) {
              options.after.call(self, migration);
            }
          },
          success: function(migration, callback) {
            if (options && Utils._.isFunction(options.success)) {
              options.success.call(self, migration);
            }
            callback();
          }
        });
      };

      if (Utils._.isArray(filename)) {
        Utils._.each(filename, function(f) {
          addMigration(f);
        });
      } else {
        addMigration(filename);
      }

      chainer
        .runSerially({ skipOnError: true })
        .success(function() { emitter.emit('success', null); })
        .error(function(err) { emitter.emit('error', err); });
    }).run();
  };

  // private

  var getAllMigrationIdsFromDatabase = Migrator.prototype.getAllMigrationIdsFromDatabase = function() {
    var self = this;

    return new Utils.CustomEventEmitter(function(emitter) {
      self
        .findOrCreateSequelizeMetaDAO()
        .success(function(SequelizeMeta) {
          SequelizeMeta
            .findAll({
              order: 'id DESC',
              attributes: ['to']
            })
            .success(function(meta) {
              emitter.emit('success', meta ? meta : null);
            })
            .error(function(err) {
              emitter.emit('error', err);
            });
        })
        .error(function(err) {
          emitter.emit('error', err);
        });
    }).run();
  };

  var getLastMigrationFromDatabase = Migrator.prototype.getLastMigrationFromDatabase = function() {
    var self = this;

    return new Utils.CustomEventEmitter(function(emitter) {
      self
        .findOrCreateSequelizeMetaDAO()
        .success(function(SequelizeMeta) {
          SequelizeMeta
            .find({ order: 'id DESC' })
            .success(function(meta) {
              emitter.emit('success', meta ? meta : null);
            })
            .error(function(err) {
              emitter.emit('error', err);
            });
        })
        .error(function(err) {
          emitter.emit('error', err);
        });
    }).run();
  };

  var getLastMigrationIdFromDatabase = Migrator.prototype.getLastMigrationIdFromDatabase = function() {
    var self = this;

    return new Utils.CustomEventEmitter(function(emitter) {
      getLastMigrationFromDatabase
        .call(self)
        .success(function(meta) {
          emitter.emit('success', meta ? meta.to : null);
        })
        .error(function(err) {
          emitter.emit('error', err);
        });
    }).run();
  };

  var getFormattedDateString = Migrator.prototype.getFormattedDateString = function(s) {
    var result = null;

    try {
      result = s.match(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/).slice(1, 6).join('-');
    } catch (e) {
      throw new Error(s + ' is no valid migration timestamp format! Use YYYYMMDDHHmmss!');
    }

    return result;
  };

  var stringToDate = Migrator.prototype.stringToDate = function(s) {
    return moment(getFormattedDateString(s), 'YYYYMMDDHHmmss');
  };

  var saveSuccessfulMigration = Migrator.prototype.saveSuccessfulMigration = function(from, to, callback) {
    var self = this;

    self.findOrCreateSequelizeMetaDAO().success(function(SequelizeMeta) {
      SequelizeMeta
        .create({ from: from.migrationId, to: to.migrationId })
        .success(callback);
    });
  };

  var deleteUndoneMigration = Migrator.prototype.deleteUndoneMigration = function(from, to, callback) {
    var self = this;
    self.findOrCreateSequelizeMetaDAO().success(function(SequelizeMeta) {
      SequelizeMeta.find({ where: { from: from.migrationId.toString(), to: to.migrationId.toString() } })
      .success(function(meta) {
        if(meta){
          meta.destroy().success(callback);
        } else {
          callback();
        }
      });
    });
  };

  return Migrator;
})();

