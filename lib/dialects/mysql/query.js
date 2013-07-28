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

    if (this.options.logging !== false) {
      this.options.logging('Executing: ' + this.sql)
    }

    this.client.query(this.sql, function(err, results, fields) {
      this.emit('sql', this.sql)

      if (err) {
        this.emit('error', err, this.callee)
      } else {
        this.emit('success', this.formatResults(results))
      }
    }.bind(this)).setMaxListeners(100)
    return this
  }

  Query.prototype.formatResults = function(data) {
    var result = AbstractQuery.prototype.formatResults.call(this, data)

    if (this.sql.toLowerCase().indexOf('describe') === 0) {
      data.forEach(function(_result) {
        Utils._.extend(result[_result.Field], {
          primaryKey:    (_result.Key === 'PRI'),
          autoIncrement: (_result.Extra === 'auto_increment'),
        })
      })
    }

    return result
  }

  return Query
})()


