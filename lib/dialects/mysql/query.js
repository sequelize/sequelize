var Utils         = require("../../utils")
  , AbstractQuery = require('../abstract/query')

module.exports = (function() {
  var Query = function(client, sequelize, callee, options) {
    this.client    = client
    this.callee    = callee
    this.sequelize = sequelize
    this.options   = Utils._.extend({
      logging: console.log,
      plain: false,
      raw: false
    }, options || {})

    this.checkLoggingOption()
  }

  Utils.inherit(Query, AbstractQuery)

  Query.prototype.run = function(sql) {
    this.sql = sql

    bindClient.call(this)

    if(this.options.logging !== false) {
      this.options.logging('Executing: ' + this.sql)
    }

    this.client.query(this.sql, function(err, results, fields) {
      unbindClient.call(this)

      this.emit('sql', this.sql)

      if (err) {
        this.emit('error', err, this.callee)
      } else {
        if (Array.isArray(results) && !!results[0] && Utils._.keys(results[0]).length === 1) {
          results = results.map(function(result){ return Utils._.values(result)[0] })
        }

        this.emit('success', this.formatResults(results))
      }
    }.bind(this)).setMaxListeners(100)

    return this
  }

  //private

  var onClientError = function(err) {
    unbindClient.call(this)
    this.emit('error', err, this.callee)
  }

  var bindClient = function() {
    this.client.on('error', onClientError.bind(this))
  }

  var unbindClient = function() {
    this.client.removeListener('error', onClientError.bind(this))
  }

  return Query
})()
