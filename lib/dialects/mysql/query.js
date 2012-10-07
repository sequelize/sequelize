var Utils         = require("../../utils")
  , AbstractQuery = require('../abstract/query')

module.exports = (function() {
  var Query = function(client, sequelize, callee, options) {
    var self = this

    this.client    = client
    this.callee    = callee
    this.sequelize = sequelize
    this.options   = Utils._.extend({
      logging: console.log,
      plain: false,
      raw: false
    }, options || {})

    this.checkLoggingOption()
    this.bindClientFunction = function(err) { onFailure.call(self, err) }
  }

  Utils.inherit(Query, require('../abstract/query'))

  Query.prototype.run = function(sql) {
    var self = this

    this.sql = sql

    bindClient.call(this)

    if(this.options.logging !== false) {
      this.options.logging('Executing: ' + this.sql)
    }

    this.client.query({ sql: this.sql, nestTables: true }, function(err, results, fields) {
      self.emit('sql', self.sql)

      if (err) {
        onFailure.call(self, err)
      } else {
        if (Array.isArray(results) && !!results[0] && Utils._.keys(results[0]).length === 1) {
          results = results.map(function(result){ return Utils._.values(result)[0] })
        }

        onSuccess.call(self, results, fields)
      }
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
    unbindClient.call(this)
    this.emit('success', this.formatResults(results))

  }

  var onFailure = function(err) {
    unbindClient.call(this)
    this.emit('error', err, this.callee)
  }

  return Query
})()
