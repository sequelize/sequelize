var moment         = require("moment")
  , Utils          = require("./utils")
  , DataTypes      = require("./data-types")
  , QueryInterface = require("./query-interface")

module.exports = (function() {
  var Migration = function(migrator, path) {
    var split = path.split('/')

    this.migrator       = migrator
    this.path           = path
    this.filename       = Utils._.last(this.path.split('/'))
    this.migrationId    = parseInt(this.filename.match(/(.*)-.*/)[1])
    this.date           = Migration.stringToDate(this.filename)
    this.queryInterface = this.migrator.queryInterface
    this.undoneMethods  = 0
  }

  ///////////////
  // static /////
  ///////////////

  Migration.getFormattedDateString = function(s) {
    var result = null

    try {
      result = s.match(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/).slice(1, 6).join('-')
    } catch(e) {
      throw new Error(s + ' is no valid migration timestamp format! Use YYYYMMDDHHmmss!')
    }

    return result
  }

  Migration.stringToDate = function(s) {
    return moment(Migration.getFormattedDateString(s), "YYYYMMDDHHmmss")
  }

  Migration.migrationHasInterfaceCalls = function(func) {
    var functionString = Utils.removeCommentsFromFunctionString(func.toString())
      , hasCalls       = false

    for(var method in QueryInterface.prototype) {
      var regex = new RegExp('[\\s\\n\\r]*\\.[\\s\\n\\r]*' + method)
      hasCalls = hasCalls || regex.test(functionString)
    }

    return hasCalls
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
    var self = this

    return new Utils.CustomEventEmitter(function(emitter) {
      options = Utils._.extend({
        method: 'up'
      }, options || {})

      var onSuccess = function() { emitter.emit('success', null) }
        , func      = self.migration[options.method]

      extendMigrationWithQueryInterfaceMethods.call(self, onSuccess)
      func.call(null, self, DataTypes)

      if(!Migration.migrationHasInterfaceCalls(func))
        onSuccess()
    }).run()
  }

  Migration.prototype.isBefore = function(dateString, options) {
    options = Utils._.extend({
      withoutEquals: false
    }, options || {})

    var date = Migration.stringToDate(dateString.toString())

    return options.withoutEqual ? (date > this.date) : (date >= this.date)
  }

  Migration.prototype.isAfter = function(dateString, options) {
    options = Utils._.extend({
      withoutEquals: false
    }, options || {})

    var date = Migration.stringToDate(dateString.toString())

    return options.withoutEqual ? (date < this.date) : (date <= this.date)
  }

  // extends the Migration prototype with all methods of QueryInterface.prototype
  // with additional tracking of start and finish. this is done in order to minimize
  // asynchronous handling in migrations
  var extendMigrationWithQueryInterfaceMethods = function(callback) {
    var self = this

    for(var method in QueryInterface.prototype) {
      (function(_method) {
        self[_method] = function() {
          var emitter = self.QueryInterface
            , args    = Utils._.map(arguments, function(arg, _) { return arg })

          self.undoneMethods++

          // bind listeners to the query interface
          // the event will have the same name like the method
          self.queryInterface.on(_method, function(err) {
            self.undoneMethods--
            if(err)
              throw new Error(err)
            else
              (self.undoneMethods == 0) && callback && callback()
          })

          self.queryInterface[_method].apply(self.queryInterface, args)
        }
      })(method)
    }
  }

  return Migration
})()
