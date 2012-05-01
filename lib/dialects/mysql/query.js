var Utils = require("../../utils")

module.exports = (function() {
  var Query = function(client, callee, options) {
    var self = this

    this.client = client
    this.callee = callee
    this.options = Utils._.extend({
      logging: console.log,
      plain: false,
      raw: false
    }, options || {})

    if(this.options.logging === true) {
      console.log('DEPRECATION WARNING: The logging-option should be either a function or false. Default: console.log')
      this.options.logging = console.log
    }

    if(this.options.logging == console.log) {
      // using just console.log will break in node < 0.6
      this.options.logging = function(s) { console.log(s) }
    }

    this.bindClientFunction = function(err) { onFailure.call(self, err) }
  }
  Utils._.extend(Query.prototype, require("../query").prototype)

  Query.prototype.run = function(sql) {
    var self = this

    this.sql = sql

    bindClient.call(this)

    if(this.options.logging !== false)
      this.options.logging('Executing: ' + this.sql)

    this.client.query(this.sql, function(err, results, fields) {
      self.emit('sql', self.sql)
      err ? onFailure.call(self, err) : onSuccess.call(self, results, fields)
    }).setMaxListeners(100)

    return this
  }

  //private

  var bindClient = function() {
    this.client.on('error', this.bindClientFunction)
  }

  var unbindClient = function() {
    this.client.removeListener('error', this.bindClientFunction)
  }

  var onSuccess = function(results, fields) {
    var result = this.callee
      , self   = this

    // add the inserted row id to the instance
    if (this.callee && (this.sql.indexOf('INSERT INTO') == 0) && (results.hasOwnProperty('insertId')))
      this.callee[this.callee.__factory.autoIncrementField] = results.insertId

    if (this.sql.indexOf('SELECT') == 0) {
      // transform results into real model instances
      // return the first real model instance if options.plain is set (e.g. Model.find)
      if(this.options.raw) {
        result = results
      } else {
        result = results.map(function(result) {
          return self.callee.build(result, { isNewRecord: false })
        })
      }

      if(this.options.plain)
        result = (result.length == 0) ? null : result[0]
    } else if(this.sql.indexOf('SHOW TABLES') == 0) {
      result = Utils._.flatten(results.map(function(resultSet) {
        return Utils._.values(resultSet)
      }))
    } else if((this.sql.indexOf('SHOW') == 0) || (this.sql.indexOf('DESCRIBE') == 0)) {
      result = results
    }

    unbindClient.call(this)
    this.emit('success', result)

  }

  var onFailure = function(err) {
    unbindClient.call(this)
    this.emit('failure', err, this.callee)
  }

  return Query
})()
