var moment         = require("moment")
  , Utils          = require("./utils")
  , DataTypes      = require("./data-types")
  , QueryInterface = require("./query-interface")

module.exports = (function() {
  var Migration = function(migrator, path) {
    this.migrator       = migrator
    this.path           = path
    this.filename       = Utils._.last(this.path.split('/'))

    var parsed          = Migration.parseFilename(this.filename)

    this.migrationId    = parsed.id
    this.date           = parsed.date;
    this.queryInterface = this.migrator.queryInterface
  }

  for (var methodName in QueryInterface.prototype) {
    if (QueryInterface.prototype.hasOwnProperty(methodName) && (typeof QueryInterface.prototype[methodName]) === 'function') {
      (function(methodName) {
        Migration.prototype[methodName] = function() {
          return this.queryInterface[methodName].apply(this.queryInterface, arguments)
        }
      })(methodName)
    }
  }

  ///////////////
  // static /////
  ///////////////

  Migration.parseFilename = function(s) {
    var matches = s.match(/^((\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2}))[-_].+/)

    if (matches === null) {
      throw new Error(s + ' is not a valid migration name! Use YYYYMMDDHHmmss-migration-name format.')
    }

    return {
      id: parseInt(matches[1], 10),
      date: moment(matches.slice(2, 8).join('-'), 'YYYYMMDDHHmmss')
    }
  }

  ///////////////
  // member /////
  ///////////////

  Object.defineProperty(Migration.prototype, 'migration', {
    get: function() {
      return require(this.path)
    }
  })

  Migration.prototype.execute = function(options) {
    return new Utils.CustomEventEmitter(function(emitter) {
      options = Utils._.extend({
        method: 'up'
      }, options || {})

      this.migration[options.method].call(null, this, DataTypes, function(err) {
        if (err) {
          emitter.emit('error', err)
        } else {
          emitter.emit('success', null)
        }
      })
    }.bind(this)).run()
  }

  Migration.prototype.isBefore = function(dateString, options) {
    options = Utils._.extend({
      withoutEquals: false
    }, options || {})

    var date = Migration.parseFilename(dateString.toString() + '-foo.js').date

    return options.withoutEqual ? (date > this.date) : (date >= this.date)
  }

  Migration.prototype.isAfter = function(dateString, options) {
    options = Utils._.extend({
      withoutEquals: false
    }, options || {})

    var date = Migration.parseFilename(dateString.toString() + '-foo.js').date

    return options.withoutEqual ? (date < this.date) : (date <= this.date)
  }

  return Migration
})()
